import { expect, test } from '@playwright/test'
import { register } from './helpers.ts'

// The offline catalog has no pictures; give every chart item a backdrop so the showcase shows.
const BACKDROP = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="9"><rect width="16" height="9" fill="#345"/></svg>',
)}`

test('the Discover showcase rotates popular titles, pauses under the pointer and adds to the library', async ({
  page,
}) => {
  await page.clock.install()
  await register(page)
  await page.route('**/api/catalog/charts*', async (route) => {
    const response = await route.fetch()
    const body = (await response.json()) as { items: { backdrop: string | null }[] }
    for (const item of body.items) item.backdrop = BACKDROP
    await route.fulfill({ response, json: body })
  })
  await page.goto('/discover')
  const showcase = page.getByTestId('showcase')
  await expect(showcase).toBeVisible()
  const dots = showcase.getByTestId('showcase-dots').getByRole('button')
  await expect(dots).toHaveCount(5)
  const heading = showcase.getByRole('heading', { level: 2 })
  const first = await heading.textContent()
  await expect(dots.first()).toHaveAttribute('aria-current', 'true')

  // Reduced motion (the suite's default): it stays put.
  await page.mouse.move(0, 0)
  await page.clock.runFor(20_000)
  await expect(heading).toHaveText(first!)

  // Otherwise every 8 s the next title (read once per page load, as the motion hook does).
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.reload()
  await expect(dots.first()).toHaveAttribute('aria-current', 'true')
  await page.mouse.move(0, 0)
  await page.clock.runFor(8_100)
  await expect(heading).not.toHaveText(first!)
  await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true')

  // Under the pointer it stays.
  const second = await heading.textContent()
  await heading.hover()
  await page.clock.runFor(20_000)
  await expect(heading).toHaveText(second!)

  // A dot picks its title; the library action works on the one shown.
  await dots.nth(3).click()
  await expect(dots.nth(3)).toHaveAttribute('aria-current', 'true')
  const picked = (await dots.nth(3).getAttribute('aria-label'))!
  await expect(heading).toHaveText(picked)
  await showcase.getByTestId('add-to-library').click()
  await expect(page.getByText('Добавлено в библиотеку')).toBeVisible()

  // A search shows results, not the showcase.
  await page.getByRole('searchbox', { name: 'Поиск' }).fill('Интерстеллар')
  await expect(showcase).toHaveCount(0)
})
