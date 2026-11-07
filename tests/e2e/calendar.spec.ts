import { expect, test, type Page } from '@playwright/test'
import { api, expectNoHorizontalOverflow, register } from './helpers.ts'

// Fixture catalog: season 1 of Breaking Bad airs weekly from Monday, 7 January 2008.
const SERIES = 'series-tt0903747'

async function followWithFirstEpisodeWatched(page: Page) {
  await register(page)
  expect(
    (await api(page, 'POST', '/library', { titleId: SERIES, status: 'in_progress' })).status,
  ).toBe(201)
  // Loading the list stores it; the calendar is built from stored lists.
  expect((await api(page, 'GET', `/titles/${SERIES}/episodes`)).status).toBe(200)
  await api(page, 'POST', `/library/${SERIES}/episodes`, {
    episodes: [{ season: 1, number: 1 }],
    watched: true,
  })
}

test('the calendar shows a month of episodes and marks one from the chosen day', async ({
  page,
}) => {
  await followWithFirstEpisodeWatched(page)
  await page.goto('/calendar?month=2008-01')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Январь 2008')
  const grid = page.getByTestId('calendar-grid')
  const first = grid.locator('[data-day="2008-01-07"]')
  await expect(first).toHaveAccessibleName(/7 января, 1 серия, Во все тяжкие/)

  // Today is in another month: the first day with episodes is chosen.
  const panel = page.getByTestId('calendar-day')
  await expect(panel.getByRole('heading')).toHaveText('Понедельник, 7 января')
  await expect(panel).toContainText('S1 · E1')
  await expect(panel.getByRole('button', { name: /Просмотрено/ })).toHaveCount(0)
  await expect(panel).toContainText('Просмотрено')

  // The arrow keys walk the grid: a week down is the next episode, not yet watched.
  await first.focus()
  await page.keyboard.press('ArrowDown')
  await expect(grid.locator('[data-day="2008-01-14"]')).toBeFocused()
  await expect(panel.getByRole('heading')).toHaveText('Понедельник, 14 января')
  await panel.getByRole('button', { name: /Просмотрено: Во все тяжкие · S1 · E2/ }).click()
  await expect(page.getByText('Серия отмечена')).toBeVisible()
  await expect(panel.getByRole('button', { name: /Просмотрено/ })).toHaveCount(0)
  await expect
    .poll(
      async () =>
        (await api<{ entry: { watchedEpisodes: number } }>(page, 'GET', `/library/${SERIES}`)).body
          .entry.watchedEpisodes,
    )
    .toBe(2)

  await page.getByRole('button', { name: 'Следующий месяц' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Февраль 2008')
  await expect(page).toHaveURL(/month=2008-02/)
  // PageUp goes back a month, to the same day.
  await grid.locator('[data-day="2008-02-04"]').click()
  await page.keyboard.press('PageUp')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Январь 2008')
  await expect(grid.locator('[data-day="2008-01-04"]')).toBeFocused()
})

test('phones get the month as a list of the days that have episodes', async ({ page }) => {
  await followWithFirstEpisodeWatched(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/calendar?month=2008-01')
  await expect(page.getByTestId('calendar-grid')).toBeHidden()
  const agenda = page.getByRole('list').filter({ hasText: 'Понедельник, 7 января' }).first()
  await expect(agenda).toContainText('Во все тяжкие')
  await expect(agenda).toContainText('Понедельник, 28 января')
  await expectNoHorizontalOverflow(page)
})

test('a month without episodes says so; Home and «G, then C» lead to the calendar', async ({
  page,
}) => {
  await register(page)
  await page.keyboard.press('g')
  await page.keyboard.press('c')
  await expect(page).toHaveURL(/\/calendar$/)
  await expect(page.getByText('В этом месяце серий нет')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Сегодня', exact: true })).toBeDisabled()
})
