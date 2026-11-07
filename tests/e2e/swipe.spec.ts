import { expect, test, type Locator } from '@playwright/test'
import { register } from './helpers.ts'

const picture = (fill: string, width = 16, height = 9) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${fill}"/></svg>`,
  )}`

/** A finger moving `dx` pixels across the element (a mouse with `pointerType: 'mouse'`). */
async function swipe(target: Locator, dx: number, pointerType = 'touch') {
  const box = (await target.boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  const init = (clientX: number) => ({
    pointerType,
    pointerId: 7,
    isPrimary: true,
    clientX,
    clientY: y,
    bubbles: true,
  })
  await target.dispatchEvent('pointerdown', init(x))
  await target.dispatchEvent('pointerup', init(x + dx))
}

test('a swipe turns the Discover showcase; a mouse drag does not', async ({ page }) => {
  await register(page)
  await page.route('**/api/catalog/charts*', async (route) => {
    const response = await route.fetch()
    const body = (await response.json()) as { items: { backdrop: string | null }[] }
    for (const item of body.items) item.backdrop = picture('#345')
    await route.fulfill({ response, json: body })
  })
  await page.goto('/discover')
  const showcase = page.getByTestId('showcase')
  const dots = showcase.getByTestId('showcase-dots').getByRole('button')
  await expect(dots.first()).toHaveAttribute('aria-current', 'true')

  await swipe(showcase, -160)
  await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true')
  await swipe(showcase, 160)
  await expect(dots.first()).toHaveAttribute('aria-current', 'true')
  // Backwards from the first goes round to the last.
  await swipe(showcase, 160)
  await expect(dots.last()).toHaveAttribute('aria-current', 'true')

  await swipe(showcase, -160, 'mouse')
  await expect(dots.last()).toHaveAttribute('aria-current', 'true')
  // Too short to count.
  await swipe(showcase, -20)
  await expect(dots.last()).toHaveAttribute('aria-current', 'true')
})

test('a swipe moves through the frames in the full-screen gallery', async ({ page }) => {
  await register(page)
  await page.route('**/api/titles/movie-tt0816692?*', async (route) => {
    const response = await route.fetch()
    const body = (await response.json()) as { title: { screenshots?: string[] } }
    body.title.screenshots = [picture('#a33'), picture('#3a3'), picture('#33a')]
    await route.fulfill({ response, json: body })
  })
  await page.goto('/title/movie-tt0816692')
  await page.getByRole('button', { name: 'Кадры 1' }).click()
  const viewer = page.getByTestId('gallery-viewer')
  await expect(viewer).toContainText('1 / 3')
  await swipe(viewer, -200)
  await expect(viewer).toContainText('2 / 3')
  await swipe(viewer, 200)
  await expect(viewer).toContainText('1 / 3')
})
