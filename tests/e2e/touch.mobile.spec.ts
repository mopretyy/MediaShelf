import { expect, test, type Locator } from '@playwright/test'
import { api, register } from './helpers.ts'

async function size(locator: Locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('not rendered')
  return { width: Math.round(box.width), height: Math.round(box.height) }
}

// Pixel 7 emulation: a coarse pointer, so the touch sizes apply.
test('touch screens get thumb-sized targets in the title bar, chips, segments and small buttons', async ({
  page,
}) => {
  await register(page)
  expect(
    (await api(page, 'POST', '/library', { titleId: 'series-tt0944947', status: 'in_progress' }))
      .status,
  ).toBe(201)
  // One episode marked, so Home offers the next one.
  await api(page, 'POST', '/library/series-tt0944947/episodes', {
    episodes: [{ season: 1, number: 1 }],
    watched: true,
  })
  await page.reload()

  const header = page.locator('main header')
  for (const target of [
    header.getByRole('link', { name: 'Главная' }),
    header.getByRole('button', { name: 'Поиск' }),
    header.getByRole('button', { name: /^Аккаунт/ }),
  ])
    expect(await size(target)).toEqual({ width: 44, height: 44 })
  // The bigger boxes don't move the icons: the avatar still ends 14 px from the edge.
  const avatar = header
    .getByRole('button', { name: /^Аккаунт/ })
    .locator('span')
    .first()
  const avatarBox = (await avatar.boundingBox())!
  expect(Math.round(page.viewportSize()!.width - (avatarBox.x + avatarBox.width))).toBe(14)

  expect((await size(page.getByRole('button', { name: 'Игры', exact: true }))).height).toBe(40)
  const trending = page.getByRole('radiogroup', { name: 'Популярное сейчас' })
  expect((await size(trending.getByRole('radio').first())).height).toBe(40)
  // An xs button on a card («+1 серия»): from 28 px up to 40.
  const continueCards = page.locator('section[aria-labelledby="continue-heading"]')
  expect((await size(continueCards.getByRole('button', { name: '+1 серия' }))).height).toBe(40)

  await page.goto('/library')
  for (const view of ['Сетка', 'Список', 'Доска'])
    expect((await size(header.getByRole('radio', { name: view }))).height).toBe(40)

  await page.goto('/title/series-tt0944947')
  expect(await size(header.getByRole('button', { name: 'Назад' }))).toEqual({
    width: 44,
    height: 44,
  })
})
