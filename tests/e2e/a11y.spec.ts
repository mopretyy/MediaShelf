import { expect, test, type Locator, type Page } from '@playwright/test'
import { api, openTitle, register } from './helpers.ts'

/** The outline lands a frame after the focus does: read it with expect.poll. */
const focusOutline = (locator: Locator) =>
  locator.evaluate((element) => {
    const style = getComputedStyle(element)
    return { style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor }
  })

/** Focus that counts as keyboard focus (:focus-visible): land on the control with Tab. */
async function tabTo(page: Page, control: Locator) {
  await control.focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await expect(control).toBeFocused()
}

test('fields, selects, the slider and both search boxes show the buttons’ focus outline', async ({
  page,
}) => {
  await register(page)
  expect(
    (await api(page, 'POST', '/library', { titleId: 'steam-292030', status: 'in_progress' }))
      .status,
  ).toBe(201)
  // The text colour (--fg) is what the outline must be drawn in: well over 3:1 on every surface.
  const fg = await page.evaluate(() => getComputedStyle(document.body).color)
  const ring = { style: 'solid', width: '2px', color: fg }

  await openTitle(page, 'steam-292030')
  for (const control of [
    page.getByRole('combobox', { name: 'Платформа' }),
    page.getByRole('slider', { name: 'Прогресс' }),
    page.getByRole('textbox', { name: 'Часов в игре' }),
  ]) {
    await tabTo(page, control)
    await expect.poll(() => focusOutline(control)).toEqual(ring)
  }
  // A button for comparison: the same treatment.
  const favourite = page.getByRole('button', { name: 'В избранное' }).first()
  await tabTo(page, favourite)
  await expect.poll(() => focusOutline(favourite)).toEqual(ring)

  await page.goto('/library')
  const sort = page.getByRole('combobox', { name: 'Сортировка' })
  await tabTo(page, sort)
  await expect.poll(() => focusOutline(sort)).toEqual(ring)
  // Text fields show it for a click too, the way browsers treat them.
  const librarySearch = page.getByRole('searchbox', { name: 'Искать в библиотеке' })
  await librarySearch.click()
  await expect(librarySearch).toBeFocused()
  await expect.poll(() => focusOutline(librarySearch)).toEqual(ring)

  await page.goto('/discover')
  const discoverSearch = page.getByRole('searchbox', { name: 'Поиск' })
  await discoverSearch.focus()
  await expect.poll(() => focusOutline(discoverSearch)).toEqual(ring)
})

test('the year story is a modal: focus starts on «Дальше», stays inside, returns to the entry', async ({
  page,
}) => {
  await register(page)
  for (const titleId of ['movie-tt1375666', 'movie-tt0816692'])
    expect(
      (await api(page, 'POST', '/library', { titleId, status: 'completed', rating: 9 })).status,
    ).toBe(201)
  await page.goto('/stats')
  const entry = page.getByRole('link', { name: /Ваш \d{4} в MediaShell/ })
  await entry.focus()
  await page.keyboard.press('Enter')

  const story = page.getByRole('dialog', { name: /Итоги \d{4}/ })
  const next = story.getByRole('button', { name: 'Дальше' })
  await expect(next).toBeFocused()
  await expect(story.getByRole('heading', { level: 1 })).toHaveText(/Итоги \d{4}/)
  // The shell underneath leaves the accessibility tree (only the toast live region stays), and
  // Tab never reaches it.
  await expect(page.getByRole('main')).toHaveCount(0)
  await expect(page.getByRole('complementary', { name: 'Меню' })).toHaveCount(0)
  await expect(page.getByRole('region', { name: /^Уведомления/ })).toBeAttached()
  for (let step = 0; step < 6; step++) {
    await page.keyboard.press('Tab')
    expect(await story.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('Shift+Tab')
  expect(await story.evaluate((element) => element.contains(document.activeElement))).toBe(true)

  // Every slide has one h2 headline; «Дальше» keeps focus up to and on the last slide.
  const counter = story.getByText(/^\d+ \/ \d+$/)
  const total = Number((await counter.textContent())!.split('/')[1])
  expect(total).toBeGreaterThan(3)
  const headlines: string[] = []
  await next.focus()
  for (let slide = 1; slide <= total; slide++) {
    await expect(counter).toHaveText(`${slide} / ${total}`)
    const heading = story.getByRole('heading', { level: 2 })
    await expect(heading).toHaveCount(1)
    headlines.push((await heading.textContent())!)
    await page.keyboard.press('Enter')
  }
  expect(headlines[0]).toBe('Итоги года')
  expect(headlines).toContain('Завершено за год')
  expect(headlines.at(-1)).toMatch(/^Это был ваш \d{4}$/)
  await expect(next).toBeFocused()
  await expect(next).toHaveAttribute('aria-disabled', 'true')
  await expect(counter).toHaveText(`${total} / ${total}`)
  // Space on a focused button presses that button: «Назад» goes back.
  await story.getByRole('button', { name: 'Назад' }).focus()
  await page.keyboard.press('Space')
  await expect(counter).toHaveText(`${total - 1} / ${total}`)

  await page.keyboard.press('Escape')
  await expect(story).toHaveCount(0)
  await expect(page).toHaveURL(/\/stats$/)
  await expect(entry).toBeFocused()
  await expect(page.getByRole('main')).toHaveCount(1)

  // Back (the phone gesture) closes it the same way.
  await page.keyboard.press('Enter')
  await expect(next).toBeFocused()
  await page.goBack()
  await expect(story).toHaveCount(0)
  await expect(entry).toBeFocused()

  // And so does the close button.
  await entry.click()
  await story.getByRole('button', { name: 'Закрыть' }).click()
  await expect(story).toHaveCount(0)
  await expect(entry).toBeFocused()
})

test('the toast region is named in the interface language', async ({ page }) => {
  await register(page)
  await expect(page.getByRole('region', { name: /^Уведомления/ })).toBeAttached()
  expect((await api(page, 'PATCH', '/me', { preferences: { locale: 'en' } })).status).toBe(200)
  await page.reload()
  await expect(page.getByRole('link', { name: 'Library' })).toBeVisible()
  await expect(page.getByRole('region', { name: /^Notifications/ })).toBeAttached()
})

test('desktop keeps the compact control sizes', async ({ page }) => {
  await register(page)
  const kinds = page.getByRole('button', { name: 'Игры', exact: true })
  expect((await kinds.boundingBox())?.height).toBe(32)
  const trending = page.getByRole('radiogroup', { name: 'Популярное сейчас' })
  expect((await trending.getByRole('radio').first().boundingBox())?.height).toBe(28)
})
