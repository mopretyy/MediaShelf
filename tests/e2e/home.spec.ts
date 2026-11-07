import { expect, test } from '@playwright/test'
import { api, expectNoHorizontalOverflow, register } from './helpers.ts'

test('the Home hero leads with the show in progress and marks its next episode', async ({
  page,
}) => {
  await register(page)
  expect(
    (await api(page, 'POST', '/library', { titleId: 'series-tt0903747', status: 'in_progress' }))
      .status,
  ).toBe(201)
  await page.goto('/')
  const hero = page.getByTestId('home-hero')
  // The greeting is the page's one h1, inside the hero.
  await expect(hero.getByRole('heading', { level: 1, name: /Дмитрий/ })).toBeVisible()
  await expect(hero).toContainText('1 в процессе')
  const title = page.getByTestId('home-hero-title')
  await expect(title).toContainText('Продолжить')
  await expect(title.getByRole('link', { name: /Во все тяжкие/ })).toHaveAttribute(
    'href',
    '/title/series-tt0903747',
  )
  await expect(title).toContainText('S1 · E1')

  await title.getByRole('button', { name: '+1 серия' }).click()
  await expect(page.getByText('Серия отмечена')).toBeVisible()
  await expect(title).toContainText('S1 · E2')
  await expect
    .poll(
      async () =>
        (
          await api<{ entry: { watchedEpisodes: number } }>(
            page,
            'GET',
            '/library/series-tt0903747',
          )
        ).body.entry.watchedEpisodes,
    )
    .toBe(1)

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 800 })
    await expectNoHorizontalOverflow(page)
  }
})

test('with nothing in progress the hero shows something popular to open', async ({ page }) => {
  await register(page)
  await page.goto('/')
  const hero = page.getByTestId('home-hero')
  await expect(hero.getByRole('heading', { level: 1, name: /Дмитрий/ })).toBeVisible()
  await expect(hero).toContainText('Ваша библиотека пока пуста')
  const title = page.getByTestId('home-hero-title')
  await expect(title).toContainText('Популярное сейчас')
  await expect(title.getByRole('link', { name: 'Открыть' })).toHaveAttribute('href', /^\/title\//)
  await expect(title.getByRole('link', { name: 'Обзор' })).toHaveAttribute('href', '/discover')
})

test('Stats opens on the year banner, which leads into the year story', async ({ page }) => {
  await register(page)
  await api(page, 'POST', '/library', { titleId: 'movie-tt1375666', status: 'completed' })
  await page.goto('/stats')
  const banner = page.getByTestId('year-banner')
  await expect(banner).toBeVisible()
  await expect(banner).toHaveAttribute('href', '/stats/year')
  await expect(banner).toContainText(/Ваш \d{4} в MediaShell/)
  await banner.click()
  await expect(page.getByRole('dialog', { name: /Итоги \d{4}/ })).toBeVisible()
})
