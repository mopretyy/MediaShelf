import { expect, test, type Page } from '@playwright/test'
import { register } from './helpers.ts'

/** A keydown as Chrome reports it with the Russian (ЙЦУКЕН) layout active. */
async function pressRussian(page: Page, key: string, code: string) {
  await page.evaluate(
    ([key, code]) =>
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true }),
      ),
    [key, code] as const,
  )
}

test('«?» lists the shortcuts, and «G, then a letter» goes to a page', async ({ page }) => {
  await register(page)
  await expect(page.getByTestId('home-hero')).toBeVisible()

  await page.keyboard.press('Shift+Slash')
  const dialog = page.getByRole('dialog', { name: 'Сочетания клавиш' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByTestId('shortcuts')).toContainText('Поиск и команды')
  await expect(dialog.getByTestId('shortcuts')).toContainText('Бросить жребий')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  await page.keyboard.press('g')
  await page.keyboard.press('l')
  await expect(page).toHaveURL(/\/library$/)
  await page.keyboard.press('g')
  await page.keyboard.press('s')
  await expect(page).toHaveURL(/\/stats$/)

  // ЙЦУКЕН: «п» and «р» sit on the G and H keys.
  await pressRussian(page, 'п', 'KeyG')
  await pressRussian(page, 'р', 'KeyH')
  await expect(page).toHaveURL(/\/$/)

  // A lone second key, or one that comes too late, does nothing.
  await page.keyboard.press('d')
  await expect(page).toHaveURL(/\/$/)
})

test('shortcut keys stay quiet while typing', async ({ page }) => {
  await register(page)
  const search = page.getByRole('textbox', { name: 'Поиск' }).first()
  await search.click()
  await page.keyboard.type('gl?')
  await expect(search).toHaveValue('gl?')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('the palette and the account menu open the shortcut list', async ({ page }) => {
  await register(page)
  await page.keyboard.press('Control+k')
  await page.getByPlaceholder('Поиск по библиотеке и каталогу…').fill('сочет')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Сочетания клавиш' })).toBeVisible()
  await page.keyboard.press('Escape')

  // The page rows in the palette show their chord.
  await page.keyboard.press('Control+k')
  await expect(page.getByRole('option', { name: /Библиотека/ })).toContainText('GL')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Аккаунт' }).click()
  await page.getByRole('menuitem', { name: /Сочетания клавиш/ }).click()
  await expect(page.getByRole('dialog', { name: 'Сочетания клавиш' })).toBeVisible()
})
