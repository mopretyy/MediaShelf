import { expect, test, type Page } from '@playwright/test'
import type { LibraryEntry, UserProfile } from '../../shared/types.ts'
import { api, register } from './helpers.ts'

const BACKDROP = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="9"><rect width="16" height="9" fill="#345"/></svg>',
)}`

async function myId(page: Page) {
  return (await api<{ user: { id: string } }>(page, 'GET', '/auth/session')).body.user.id
}

const LONG = 'Провожающая в последний путь Фрирен: Призрачное путешествие'

test('profile activity: the day heading gives the date, the rows no second time', async ({
  page,
}) => {
  await register(page)
  for (const titleId of ['movie-tt1375666', 'movie-tt0816692'])
    await api(page, 'POST', '/library', { titleId, status: 'completed' })
  // The oldest line moves to an earlier year, the way a long-kept profile has it.
  await page.route('**/api/users/*/profile*', async (route) => {
    const response = await route.fetch()
    const profile = (await response.json()) as UserProfile
    profile.activity.at(-1)!.createdAt = '2025-02-19T12:00:00.000Z'
    // A long name, like most anime have in Russian: it gets two lines, not an ellipsis.
    const first = profile.activity[0]!
    if (first.title) first.title = { ...first.title, names: { ...first.title.names, ru: LONG } }
    await route.fulfill({ response, json: profile })
  })
  await page.goto(`/users/${await myId(page)}`)

  const activity = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Последние действия' }) })
  const today = activity.getByText('Сегодня', { exact: true })
  await expect(today).toBeVisible()
  await expect(today).toHaveCSS('text-transform', 'none')
  await expect(activity.getByText('19 февраля 2025', { exact: true })).toBeVisible()
  await expect(activity.getByRole('link', { name: /Начало/ })).toBeVisible()
  await expect(activity.locator('time')).toHaveCount(0)
  const long = activity.getByText(LONG, { exact: true })
  await expect(long).toBeVisible()
  expect(
    await long.evaluate(
      (el) => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight + 1,
    ),
  ).toBe(true)

  // Home lists the same lines without day headings, so it keeps the relative time.
  await page.goto('/')
  await expect(page.locator('section[aria-labelledby="activity-heading"] time').first()).toHaveText(
    'сейчас',
  )
})

test('cover picker: the favourite tile uses a favourite with a backdrop or says why not', async ({
  page,
}) => {
  await register(page)
  await page.goto('/settings/profile')
  const covers = page.getByRole('radiogroup', { name: 'Обложка профиля' })
  const favourite = covers.getByRole('radio', { name: /Фон избранного/ })
  await expect(favourite).toContainText('Отметьте тайтл избранным')
  // Every tile the same size; the upload tile names the formats once, under it.
  const widths = await covers
    .getByRole('radio')
    .evaluateAll((tiles) => tiles.map((tile) => Math.round(tile.getBoundingClientRect().width)))
  expect(new Set(widths).size).toBe(1)
  await expect(covers.getByRole('radio', { name: /Своя картинка/ })).toContainText('Загрузить')
  await expect(covers.getByText('JPG, PNG или WebP')).toHaveCount(1)

  // Favourites without a backdrop: not «mark a favourite» any more.
  for (const titleId of ['movie-tt0816692', 'movie-tt1375666'])
    await api(page, 'POST', '/library', { titleId, favorite: true })
  await page.reload()
  await expect(favourite).toContainText('У избранного нет фоновой картинки')

  // The newest favourite (Начало) has none: the tile skips to one that has.
  await page.route('**/api/library', async (route) => {
    const response = await route.fetch()
    const body = (await response.json()) as { entries: LibraryEntry[] }
    for (const entry of body.entries)
      if (entry.titleId === 'movie-tt0816692') entry.title.backdrop = BACKDROP
    await route.fulfill({ response, json: body })
  })
  await page.reload()
  await expect(favourite.locator('img')).toHaveAttribute('src', BACKDROP)
  await expect(favourite).toContainText('Интерстеллар')
  await expect(favourite).not.toContainText('Начало')
})

test('games settings: one card per connectable store, one line for the rest', async ({ page }) => {
  await register(page)
  const later = 'Скоро: GOG, Epic Games Store, Microsoft Store, PlayStation Store и Nintendo eShop'
  for (const path of ['/settings/games', '/welcome?step=stores']) {
    await page.goto(path)
    await expect(page.getByRole('button', { name: 'Войти через Steam' })).toBeVisible()
    await expect(page.getByText(later, { exact: true })).toBeVisible()
    await expect(page.getByText('Скоро', { exact: true })).toHaveCount(0)
  }
})
