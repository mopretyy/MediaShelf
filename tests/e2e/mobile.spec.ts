import { expect, test } from '@playwright/test'
import { api, expectNoHorizontalOverflow, register } from './helpers.ts'

test('mobile layout: tab bar navigation and no horizontal overflow', async ({ page }) => {
  await register(page)
  const tabs = page.getByRole('navigation', { name: 'Меню' })
  for (const [label, path] of [
    ['Обзор', '/discover'],
    ['Библиотека', '/library'],
    ['Жребий', '/shuffle'],
    ['Статистика', '/stats'],
    ['Главная', '/'],
  ]) {
    await tabs.getByRole('link', { name: label }).click()
    await expect(page).toHaveURL(new RegExp(`${path === '/' ? '/$' : path}`))
    await expectNoHorizontalOverflow(page)
  }
  for (const id of ['series-tt0903747', 'steam-292030', 'anime-52991']) {
    await page.goto(`/title/${id}`)
    await expect(page.locator('main h1').last()).toBeVisible()
    await expectNoHorizontalOverflow(page)
  }
})

test('mobile layout: the palette language list works by touch', async ({ page }) => {
  await register(page)
  await page.locator('header').getByRole('button', { name: 'Поиск' }).tap()
  const command = page.getByRole('option', { name: /^Язык…/ })
  await command.tap()
  await expect(page.getByPlaceholder('Выберите язык…')).toBeVisible()
  // Without an Escape key the way back is a button.
  await page.getByRole('dialog').getByRole('button', { name: 'Назад' }).tap()
  await expect(page.getByPlaceholder('Поиск по библиотеке и каталогу…')).toBeVisible()
  await command.tap()
  await page.getByRole('option', { name: /^English/ }).tap()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(
    page.getByRole('navigation', { name: 'Menu' }).getByRole('link', { name: 'Library' }),
  ).toBeVisible()
})

test('mobile layout: profile page fits every phone width in both themes', async ({ page }) => {
  await register(page, 'Константинопольский')
  // A long two-word name must truncate, never wrap or overflow.
  const name = 'Константинопольский Александрович-Петровский'
  expect((await api(page, 'PATCH', '/me', { name })).status).toBe(200)
  const session = await api<{ user: { id: string } }>(page, 'GET', '/auth/session')
  const url = `/users/${session.body.user.id}`

  const check = async () => {
    const heading = page.getByRole('heading', { level: 1, name })
    await expect(heading).toBeVisible()
    expect((await heading.boundingBox())?.height ?? 0).toBeLessThan(60)
    // Buttons and chips stay on one line.
    for (const button of await page.locator('main a[href="/settings/profile"], main button').all())
      if (await button.isVisible())
        expect((await button.boundingBox())?.height ?? 0).toBeLessThan(48)
    await expectNoHorizontalOverflow(page)
  }

  // Empty library: the onboarding card and Top-4 slots.
  await page.goto(url)
  const onboarding = page.locator('section', {
    has: page.getByRole('heading', { name: 'Соберите свою полку' }),
  })
  await expect(onboarding).toBeVisible()
  for (const width of [320, 360, 393, 412])
    for (const colorScheme of ['dark', 'light'] as const) {
      await page.setViewportSize({ width, height: 800 })
      await page.emulateMedia({ colorScheme })
      await check()
      // The steps wrap: no sentence loses its end to an ellipsis.
      const cut = await onboarding
        .locator('h2, li span')
        .evaluateAll((nodes) =>
          nodes
            .filter((node) => node.scrollWidth > node.clientWidth + 1)
            .map((node) => node.textContent),
        )
      expect(cut).toEqual([])
    }

  // A filled library: stats strip, Top-4, Now.
  for (const [titleId, status] of [
    ['series-tt0903747', 'completed'],
    ['steam-292030', 'in_progress'],
    ['anime-52991', 'completed'],
  ] as const)
    await api(page, 'POST', '/library', { titleId, status, favorite: true, rating: 9 })
  await page.goto(url)
  await expect(page.getByRole('heading', { name: 'Топ-4' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Сейчас' })).toBeVisible()
  for (const width of [320, 360, 393, 412]) {
    await page.setViewportSize({ width, height: 800 })
    await check()
  }
})

test('mobile layout: toasts sit above the tab bar on phones and small tablets', async ({
  page,
}) => {
  await register(page)
  const tabs = page.getByRole('navigation', { name: 'Меню' })
  // 700 px: Sonner's own mobile layout stops at 600 px, the tab bar only at 768 px.
  for (const [width, titleId] of [
    [412, 'movie-tt1375666'],
    [700, 'movie-tt0816692'],
  ] as const) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`/title/${titleId}`)
    await page.getByTestId('add-to-library').click()
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: 'Добавлено в библиотеку' })
    await expect(toast).toBeVisible()
    const toastBox = (await toast.boundingBox())!
    const barBox = (await tabs.boundingBox())!
    expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(barBox.y)
  }
})

test('mobile layout: title pages of every kind fit 320 and 360 px phones', async ({ page }) => {
  test.setTimeout(120_000)
  await register(page)
  // One title of each kind, each with a trailer in the fixtures: the fullest hero.
  const titles = ['movie-tt1375666', 'series-tt0903747', 'steam-292030', 'anime-52991']
  const hero = page.getByTestId('title-hero')

  const check = async (titleId: string, saved: boolean) => {
    await page.goto(`/title/${titleId}`)
    await expect(hero.getByRole('heading', { level: 1 })).toBeVisible()
    const trailer = hero.getByRole('button', { name: 'Трейлер' })
    await expect(trailer).toBeVisible()
    await expect(hero.getByTestId(saved ? 'status-button' : 'add-to-library')).toBeVisible()
    await expectNoHorizontalOverflow(page)
    // The hero clips its content to its rounded frame: no control may reach past it.
    const frame = (await hero.boundingBox())!
    for (const button of await hero.getByRole('button').all()) {
      const box = (await button.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(frame.x)
      expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width)
    }
    // The trailer is an icon on a phone, so favourite, rating, trailer and "…" share one row.
    const row = [
      ...(saved
        ? [hero.getByRole('button', { name: /избранное/ }), hero.getByTestId('rating-button')]
        : []),
      trailer,
      hero.getByRole('button', { name: 'Ещё', exact: true }),
    ]
    const boxes = await Promise.all(row.map(async (button) => (await button.boundingBox())!))
    expect((await trailer.boundingBox())!.width).toBeCloseTo(44, 0)
    for (const box of boxes) {
      expect(box.height).toBeCloseTo(44, 0)
      expect(box.y).toBeCloseTo(boxes[0]!.y, 0)
    }
  }

  for (const width of [320, 360]) {
    await page.setViewportSize({ width, height: 800 })
    for (const titleId of titles) await check(titleId, false)
  }
  // Saved, the row gains the heart and the rating: "Оценить" is the widest at 360 px, a score
  // at 320 px (where "Оценить" folds into the star).
  for (const [titleId, status, rating] of [
    ['movie-tt1375666', 'completed', 10],
    ['series-tt0903747', 'in_progress', null],
    ['steam-292030', 'in_progress', 10],
    ['anime-52991', 'in_progress', null],
  ] as const)
    expect((await api(page, 'POST', '/library', { titleId, status, rating })).status).toBe(201)
  for (const width of [320, 360]) {
    await page.setViewportSize({ width, height: 800 })
    for (const titleId of titles) await check(titleId, true)
  }
})

test('mobile layout: rating, episode and playthrough controls are sized for touch at 320 px', async ({
  page,
}) => {
  await register(page)
  for (const [titleId, status] of [
    ['movie-tt1375666', 'completed'],
    ['series-tt0903747', 'in_progress'],
    ['steam-292030', 'in_progress'],
  ] as const)
    expect((await api(page, 'POST', '/library', { titleId, status })).status).toBe(201)
  await page.setViewportSize({ width: 320, height: 640 })

  // The rating popover fits the screen: a 5 × 2 grid of 44 px targets.
  await page.goto('/title/movie-tt1375666')
  const rating = page.getByTestId('rating-button')
  await expect(rating).toHaveAccessibleName('Оценить')
  await rating.tap()
  const popover = page.getByRole('dialog')
  const scale = popover.getByRole('radiogroup', { name: 'Ваша оценка' })
  await expect(scale).toBeVisible()
  const box = (await popover.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(320)
  const radios = await scale.getByRole('radio').all()
  expect(radios).toHaveLength(10)
  for (const radio of radios) expect((await radio.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await scale.getByRole('radio', { name: '8 из 10', exact: true }).tap()
  await expect(scale).toHaveCount(0)
  await expect(rating).toHaveAccessibleName('Ваша оценка: 8 из 10')

  // An episode row is one big checkbox; its menu is a separate 36 px target.
  await page.goto('/title/series-tt0903747')
  const episodes = page.getByRole('region', { name: 'Серии' })
  const second = episodes.getByRole('checkbox', { name: 'S1 · E2, Episode 2' })
  expect((await second.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await episodes.getByText('Episode 2', { exact: true }).tap()
  await expect(second).toBeChecked()
  const menu = (await episodes
    .getByRole('button', { name: 'Ещё: S1 · E2', exact: true })
    .boundingBox())!
  expect(Math.min(menu.width, menu.height)).toBeGreaterThanOrEqual(36)
  await expectNoHorizontalOverflow(page)

  // The playthroughs header stays on one line: "Добавить" on screen, the full name for AT.
  await page.goto('/title/steam-292030')
  const heading = page.getByRole('heading', { name: 'Прохождения' })
  const add = page.getByRole('button', { name: 'Добавить прохождение' })
  await expect(add).toBeVisible()
  expect((await add.boundingBox())!.width).toBeLessThan(140)
  expect(Math.abs((await add.boundingBox())!.y - (await heading.boundingBox())!.y)).toBeLessThan(16)
  await expectNoHorizontalOverflow(page)
})
