import { expect, test, type Page } from '@playwright/test'
import { api, register } from './helpers.ts'

async function savedLocale(page: Page) {
  const { body } = await api<{ user: { preferences: { locale: string } } }>(
    page,
    'GET',
    '/auth/session',
  )
  return body.user.preferences.locale
}

test('the palette picks the interface language from a list of languages named in themselves', async ({
  page,
}) => {
  await register(page)
  const search = page.getByPlaceholder('Поиск по библиотеке и каталогу…')
  const languages = page.getByPlaceholder('Выберите язык…')
  const command = page.getByRole('option', { name: /^Язык…/ })

  // One «Язык…» row that names the current language, not seven languages in the main list.
  await page.keyboard.press('Control+K')
  await expect(command).toContainText('Русский')
  await expect(page.getByRole('option', { name: /Deutsch/ })).toHaveCount(0)

  // Enter opens the list on the language in use.
  await search.fill('язык')
  await expect(command).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Enter')
  await expect(languages).toBeFocused()
  await expect(page.getByRole('option')).toHaveText([
    /^Русский/,
    /^English/,
    /^Українська/,
    /^Deutsch/,
    /^Español/,
    /^Français/,
    /^Română/,
  ])
  const russian = page.getByRole('option', { name: /^Русский/ })
  await expect(russian).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('option', { checked: true })).toHaveText(/^Русский/)

  // Escape steps back to the main list, onto «Язык…», and only then closes the palette.
  await page.keyboard.press('Escape')
  await expect(search).toBeFocused()
  await expect(command).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Enter')
  await expect(languages).toBeFocused()

  // Backspace in the empty field steps back too, but holding it only clears the text.
  await page.keyboard.type('de')
  await expect(page.getByRole('option')).toHaveText([/^Deutsch/])
  for (let press = 0; press < 4; press++) await page.keyboard.down('Backspace')
  await page.keyboard.up('Backspace')
  await expect(languages).toHaveValue('')
  await expect(page.getByRole('option')).toHaveCount(7)
  await page.keyboard.press('Backspace')
  await expect(search).toBeFocused()

  // The back button, for a pointer and for Tab and Enter.
  const backButton = page.getByRole('dialog').getByRole('button', { name: 'Назад' })
  await page.keyboard.press('Enter')
  await backButton.click()
  await expect(search).toBeFocused()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Shift+Tab')
  await expect(backButton).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(search).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(search).toHaveCount(0)

  // Arrow down, Enter: the interface switches and the account remembers it.
  await page.keyboard.press('Control+K')
  await search.fill('язык')
  await expect(command).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('option', { name: /^English/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.keyboard.press('Enter')
  await expect(languages).toHaveCount(0)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Library' })).toBeVisible()
  await expect.poll(() => savedLocale(page)).toBe('en')

  // A language typed by name stays as the filter: «deutsch», Enter, Enter.
  await page.keyboard.press('Control+K')
  await page.getByPlaceholder('Search your library and the catalog…').fill('deutsch')
  await expect(page.getByRole('option', { name: /^Language…/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.keyboard.press('Enter')
  await expect(page.getByRole('option')).toHaveText([/^Deutsch/])
  await page.keyboard.press('Enter')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')

  // Whatever the interface shows, the way back is the language's own name. (No German copy is
  // matched here: the German palette is still partial and its labels will change.)
  await page.keyboard.press('Control+K')
  await page.getByRole('combobox').fill('русский')
  await expect(page.getByRole('option', { name: /Deutsch/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.keyboard.press('Enter')
  await expect(page.getByRole('option', { checked: true })).toHaveCount(0)
  await expect(page.getByRole('option')).toHaveText([/^Русский/])
  await page.keyboard.press('Enter')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Библиотека' })).toBeVisible()
  await expect.poll(() => savedLocale(page)).toBe('ru')
})

test('a first visit opens in the browser’s language when the interface has it', async ({
  browser,
}) => {
  for (const [locale, title] of [
    ['uk-UA', 'З поверненням'],
    ['de-DE', 'Willkommen zurück'],
    ['ro-RO', 'Bine ai revenit'],
    ['pt-BR', 'Welcome back'],
  ] as const) {
    const context = await browser.newContext({ locale })
    const page = await context.newPage()
    await page.goto('/login')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
    await expect(page.locator('html')).toHaveAttribute(
      'lang',
      locale.slice(0, 2) === 'pt' ? 'en' : locale.slice(0, 2),
    )
    await context.close()
  }
})

test('only the dictionary in use is downloaded', async ({ page }) => {
  const dictionaries: string[] = []
  page.on('request', (request) => {
    const match = /\/assets\/(uk|de|es|fr|ro)-[\w-]+\.js$/.exec(new URL(request.url()).pathname)
    if (match) dictionaries.push(match[1])
  })
  await register(page)
  await page.goto('/discover')
  await expect(page.getByRole('heading', { name: /популярное сейчас/ }).first()).toBeVisible()
  // Russian and English come with the app; nothing else was needed.
  expect(dictionaries).toEqual([])

  await page.keyboard.press('Control+k')
  await page.getByPlaceholder('Поиск по библиотеке и каталогу…').fill('deutsch')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.getByRole('link', { name: 'Entdecken' }).first()).toBeVisible()
  expect(dictionaries).toEqual(['de'])
})
