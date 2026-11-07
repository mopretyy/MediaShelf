import { expect, test, type Locator } from '@playwright/test'
import { api, expectNoHorizontalOverflow, register } from './helpers.ts'

/** The details line under a card's name in the library grid. */
const metaOf = (card: Locator) => card.locator('p[id]')

test('library cards keep the status word whole and drop what does not fit', async ({ page }) => {
  await register(page)
  for (const [titleId, status, patch] of [
    ['steam-367520', 'completed', { rating: 9, store: 'steam', progress: 100 }],
    ['steam-413150', 'paused', { rating: 7, store: 'steam', progress: 30 }],
    ['series-tt0903747', 'completed', { rating: 10 }],
  ] as const) {
    expect((await api(page, 'POST', '/library', { titleId, status })).status).toBe(201)
    expect((await api(page, 'PATCH', `/library/${titleId}`, patch)).status).toBe(200)
  }

  await page.goto('/library')
  const main = page.getByRole('main')
  const hollow = main.getByRole('link', { name: /^Hollow Knight/ })
  // Status, rating and the store as a mark; «100 %» would only repeat «Пройдено».
  await expect(metaOf(hollow)).toContainText('Пройдено')
  await expect(metaOf(hollow)).toContainText('★ 9')
  await expect(metaOf(hollow)).not.toContainText('%')
  await expect(metaOf(hollow).getByRole('img', { name: 'Steam' })).toBeVisible()
  await expect(hollow).toHaveAccessibleDescription(/Пройдено.*Ваша оценка: 9 из 10.*Steam/)
  // A title under way keeps its progress (the dots are drawn by the line, not in its text).
  await expect(metaOf(main.getByRole('link', { name: /^Stardew Valley/ }))).toContainText(
    /^Отложено·30 %·★ 7/,
  )
  await expect(metaOf(main.getByRole('link', { name: /^Во все тяжкие/ }))).not.toContainText('/')

  for (const width of [1440, 768, 390, 360, 320]) {
    await page.setViewportSize({ width, height: 900 })
    for (const meta of await main.locator('p[id]').all()) {
      // The status (first item) is never cut, and whatever shows sits on the first line.
      const status = meta.locator(':scope > span').first()
      const cut = await status.evaluate((element) => {
        const text = element.querySelector('span') ?? element
        return text.scrollWidth > text.clientWidth
      })
      expect(cut, `${await meta.textContent()} at ${width}px`).toBe(false)
      expect((await meta.boundingBox())?.height).toBeLessThanOrEqual(16)
    }
    await expectNoHorizontalOverflow(page)
  }

  // The list view names the store with the same icon as the grid, not a word.
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/library?view=list')
  const row = page.getByRole('main').getByRole('link', { name: /^Hollow Knight/ })
  await expect(row.getByRole('img', { name: 'Steam' })).toBeVisible()
  // The icon's <title> is in textContent; the visible text has no word.
  expect(await row.innerText()).not.toContain('Steam')
})

test('discover charts: equal posters over the numerals, names on two lines', async ({ page }) => {
  await register(page)
  for (const [width, poster] of [
    [1440, 172],
    [320, 132],
  ]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/discover')
    const games = page.getByRole('list', { name: 'Игры' })
    await expect(games.getByRole('listitem')).toHaveCount(6)
    await expect(games.getByText('Место 1', { exact: true })).toBeAttached()
    for (const link of await games.getByRole('link').all()) {
      expect((await link.boundingBox())?.width).toBeCloseTo(poster, 0)
      // Two lines are enough for every fixture name: nothing is clamped.
      const name = link.locator('p').first()
      const clamped = await name.evaluate((element) => element.scrollHeight > element.clientHeight)
      expect(clamped, (await name.textContent()) ?? '').toBe(false)
    }
    await expectNoHorizontalOverflow(page)
  }
})

test('the poster quick-add shows on touch tablets and stays out of the way on desktop', async ({
  page,
  browser,
  baseURL,
}) => {
  await page.goto('/discover?kind=game')
  const add = page.getByRole('button', { name: 'Добавить в библиотеку: Hollow Knight' })
  // Hover devices: invisible and click-through until the card is hovered.
  await expect(add).toHaveCSS('opacity', '0')
  await expect(add).toHaveCSS('pointer-events', 'none')
  await page
    .getByRole('main')
    .getByRole('link', { name: /^Hollow Knight/ })
    .hover()
  await expect(add).toHaveCSS('opacity', '1')
  await expect(add).toHaveCSS('pointer-events', 'auto')

  // A touch tablet cannot hover: the button is on view, with a 44 px target.
  const tablet = await browser.newContext({
    baseURL,
    locale: 'ru-RU',
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    viewport: { width: 1024, height: 768 },
    isMobile: true,
    hasTouch: true,
  })
  const touch = await tablet.newPage()
  await touch.goto('/discover?kind=game')
  const button = touch.getByRole('button', { name: 'Добавить в библиотеку: Hollow Knight' })
  await expect(button).toBeVisible()
  await expect(button).toHaveCSS('opacity', '1')
  const target = await button.evaluate((element) => {
    const box = element.getBoundingClientRect()
    const ring = getComputedStyle(element, '::before')
    // Just outside the drawn circle, still inside the target.
    const hit = document.elementFromPoint(box.right + 4, box.top - 4)
    return { size: box.width + 2 * -parseFloat(ring.left), hit: element.contains(hit) }
  })
  expect(target.size).toBeGreaterThanOrEqual(44)
  expect(target.hit).toBe(true)
  await tablet.close()
})
