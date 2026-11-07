import { expect, test } from '@playwright/test'
import { register } from './helpers.ts'

// The offline catalog has no pictures, and moods only show titles with a poster: give them one.
const POSTER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="3"><rect width="2" height="3" fill="#543"/></svg>',
)}`

test('Discover offers moods; a mood lists what fits, and switching or leaving it is one tap', async ({
  page,
}) => {
  await register(page)
  await page.route('**/api/catalog/charts*', async (route) => {
    const response = await route.fetch()
    const body = (await response.json()) as { items: { poster: string | null }[] }
    for (const item of body.items) item.poster = POSTER
    await route.fulfill({ response, json: body })
  })
  await page.goto('/discover')
  const row = page.locator('section', {
    has: page.getByRole('heading', { name: 'Под настроение' }),
  })
  await expect(row).toBeVisible()
  // Only moods with at least three titles get a tile.
  await expect(row.getByTestId('mood-tense')).toContainText('Триллеры, ужасы, детективы')
  await expect(row.getByTestId('mood-laugh')).toHaveCount(0)

  await row.getByTestId('mood-tense').click()
  await expect(page).toHaveURL(/[?&]mood=tense/)
  const view = page.getByTestId('mood-view')
  await expect(view.getByRole('heading', { level: 2 })).toHaveText('Напряжённое')
  await expect(view.getByRole('link', { name: /Во все тяжкие/ })).toBeVisible()
  await expect(row).toHaveCount(0)

  await view.getByRole('button', { name: 'Эпичное' }).click()
  await expect(page).toHaveURL(/[?&]mood=epic/)
  await expect(view.getByRole('heading', { level: 2 })).toHaveText('Эпичное')
  await expect(view.getByRole('button', { name: 'Эпичное' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(view.getByRole('link', { name: /Ведьмак 3/ })).toBeVisible()

  await view.getByRole('link', { name: 'Все настроения' }).click()
  await expect(page).not.toHaveURL(/mood=/)
  await expect(row.getByTestId('mood-tense')).toBeVisible()

  // Choosing a kind leaves the mood.
  await page.goto('/discover?mood=tense')
  await expect(page.getByTestId('mood-view')).toBeVisible()
  await page.getByRole('radio', { name: 'Игры' }).click()
  await expect(page).toHaveURL(/kind=game/)
  await expect(page).not.toHaveURL(/mood=/)
})
