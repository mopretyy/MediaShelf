import { expect, test } from '@playwright/test'
import { api, register } from './helpers.ts'

test('Stats shows the year of activity, today shaded', async ({ page }) => {
  await register(page)
  for (const titleId of ['movie-tt1375666', 'movie-tt0816692'])
    expect(
      (await api(page, 'POST', '/library', { titleId, status: 'completed', rating: 9 })).status,
    ).toBe(201)
  await page.goto('/stats')
  const heatmap = page.getByTestId('year-heatmap')
  await expect(heatmap).toHaveAttribute('aria-label', /Год активности: 1 активный день/)
  const today = new Date()
  const day = new Date(today.getTime() - today.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10)
  const cell = heatmap.locator(`[data-day="${day}"]`)
  await expect(cell).toHaveAttribute('data-level', '4')
  await expect(cell).toHaveAttribute('title', /действи/)
  // 53 weeks of days up to today.
  expect(await heatmap.locator('[data-level]').count()).toBeGreaterThan(52 * 7)
})
