import { expect, test, type Page } from '@playwright/test'
import type { LibraryEntry } from '../../shared/types.ts'
import { api, openTitle, register } from './helpers.ts'

const sidebar = (page: Page) => page.getByRole('complementary', { name: 'Меню' })

const savedEntry = async (page: Page, titleId: string) =>
  (await api<{ entry: LibraryEntry }>(page, 'GET', `/library/${titleId}`)).body.entry

test('a note typed right before leaving a title is saved to that title only', async ({ page }) => {
  await register(page)
  for (const titleId of ['movie-tt0816692', 'movie-tt1375666'])
    expect((await api(page, 'POST', '/library', { titleId, status: 'completed' })).status).toBe(201)
  await api(page, 'PATCH', '/library/movie-tt0816692', { notes: 'B original note' })
  const notes = page.getByRole('textbox', { name: 'Заметки' })

  await openTitle(page, 'movie-tt0816692')
  await expect(notes).toHaveValue('B original note')
  await sidebar(page)
    .getByRole('link', { name: /Начало/ })
    .click()
  await expect(page.getByRole('heading', { level: 1, name: 'Начало' })).toBeVisible()
  await expect(notes).toHaveValue('')

  // Type, then go Back well within the 0.9 s autosave delay and without a blur, as a mouse
  // back button or a swipe does.
  await notes.fill('Note for Inception')
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1, name: 'Интерстеллар' })).toBeVisible()
  await expect(notes).toHaveValue('B original note')
  await expect
    .poll(async () => (await savedEntry(page, 'movie-tt1375666')).notes)
    .toBe('Note for Inception')
  await page.waitForTimeout(1_500) // past any autosave that could still fire
  expect((await savedEntry(page, 'movie-tt0816692')).notes).toBe('B original note')
  await expect(notes).toHaveValue('B original note')

  // Leaving by a click blurs the box first. With a slow server the save is still in flight
  // when the next title opens: that title must show its own note, not the one being saved.
  await page.route('**/api/library/movie-tt0816692', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400))
    await route.continue()
  })
  await notes.fill('B edited')
  await sidebar(page)
    .getByRole('link', { name: /Начало/ })
    .click()
  await expect(page.getByRole('heading', { level: 1, name: 'Начало' })).toBeVisible()
  await expect(notes).toHaveValue('Note for Inception')
  await expect.poll(async () => (await savedEntry(page, 'movie-tt0816692')).notes).toBe('B edited')
  await page.waitForTimeout(1_500)
  expect((await savedEntry(page, 'movie-tt1375666')).notes).toBe('Note for Inception')
  await expect(notes).toHaveValue('Note for Inception')
})

test('a series added from the palette offers its first episode instead of "all watched"', async ({
  page,
}) => {
  await register(page)
  await page.getByRole('button', { name: 'Добавить', exact: true }).click()
  await page.getByPlaceholder('Найдите игру, фильм, сериал или аниме…').fill('шерлок')
  await page.getByRole('option', { name: /Шерлок/ }).click()
  await expect(page.getByText('Добавлено в библиотеку')).toBeVisible()

  // Opened within the app, so the page works from the library entry cached at adding time.
  await sidebar(page)
    .getByRole('link', { name: /Шерлок/ })
    .click()
  await expect(page.getByRole('heading', { level: 1, name: 'Шерлок' })).toBeVisible()
  const episodes = page.getByRole('region', { name: 'Серии' })
  await expect(episodes.getByText('Просмотрено 0 из 12')).toBeVisible()
  await expect(episodes.getByText('Следующая')).toBeVisible()
  await expect(episodes.getByText('S1 · E1')).toBeVisible()
  await expect(page.getByText('Вы посмотрели все вышедшие серии')).toHaveCount(0)

  await episodes.getByRole('button', { name: 'Отметить просмотренной' }).click()
  await expect(page.getByTestId('status-button')).toContainText('Смотрю')
  await expect(episodes.getByText('Просмотрено 1 из 12')).toBeVisible()
  await expect(episodes.getByText('S1 · E2')).toBeVisible()
  await expect(sidebar(page).getByRole('link', { name: /Шерлок/ })).toContainText('S1 · E2')
})

test('a series saved before its episode list arrived gets "+1 серия" on Home without a reload', async ({
  page,
}) => {
  await register(page)
  // A slow episode source: the page's list request is held, so the title is saved before the
  // server has any list for it, and the list only comes in afterwards.
  let release = () => {}
  const held = new Promise<void>((resolve) => (release = resolve))
  await page.route('**/api/titles/series-tt0944947/episodes**', async (route) => {
    await held
    await route.continue()
  })
  await openTitle(page, 'series-tt0944947')
  await page.getByRole('button', { name: 'Добавить как…' }).click()
  await page.getByRole('menuitemradio', { name: 'Смотрю' }).click()
  await expect(page.getByTestId('status-button')).toContainText('Смотрю')
  release()
  await expect(page.getByRole('region', { name: 'Серии' }).getByText('S1 · E1')).toBeVisible()

  await sidebar(page).getByRole('link', { name: 'Главная' }).click()
  await expect(page.getByRole('heading', { name: 'Продолжить' })).toBeVisible()
  await expect(
    page
      .locator('section[aria-labelledby="continue-heading"]')
      .getByRole('button', { name: '+1 серия' }),
  ).toBeVisible()
  await expect(sidebar(page).getByRole('link', { name: /Игра престолов/ })).toContainText('S1 · E1')
})

test('the season picked on one series does not stick to the next one', async ({ page }) => {
  await register(page)
  for (const titleId of ['series-tt1475582', 'series-tt0903747'])
    expect((await api(page, 'POST', '/library', { titleId })).status).toBe(201)
  await openTitle(page, 'series-tt1475582')
  await page.getByRole('radio', { name: 'Сезон 2' }).click()
  await expect(page.getByRole('radio', { name: 'Сезон 2' })).toHaveAttribute('aria-checked', 'true')

  await sidebar(page)
    .getByRole('link', { name: /Во все тяжкие/ })
    .click()
  await expect(page.getByRole('heading', { level: 1, name: 'Во все тяжкие' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Сезон 1' })).toHaveAttribute('aria-checked', 'true')
})

test('dates: the finish cannot precede the start, and a refused date does not stick', async ({
  page,
}) => {
  await register(page)
  await api(page, 'POST', '/library', { titleId: 'movie-tt1375666', status: 'completed' })
  await api(page, 'PATCH', '/library/movie-tt1375666', {
    startedAt: '2025-03-10T12:00:00.000Z',
    finishedAt: '2025-03-20T12:00:00.000Z',
  })
  await openTitle(page, 'movie-tt1375666')
  const started = page.getByLabel('Начато', { exact: true })
  const finished = page.getByLabel('Завершено', { exact: true })
  await expect(finished).toHaveValue('2025-03-20')
  await expect(finished).toHaveAttribute('min', '2025-03-10')
  await expect(started).toHaveAttribute('max', '2025-03-20')

  await finished.fill('2025-03-01')
  await finished.press('Enter')
  await expect(page.getByText('Раньше даты начала')).toBeVisible()
  await expect(finished).toHaveValue('2025-03-20')

  await started.fill('2025-03-25')
  await started.press('Enter')
  await expect(page.getByText('Позже даты завершения')).toBeVisible()
  await expect(started).toHaveValue('2025-03-10')

  const saved = await savedEntry(page, 'movie-tt1375666')
  expect([saved.startedAt, saved.finishedAt]).toEqual([
    '2025-03-10T12:00:00.000Z',
    '2025-03-20T12:00:00.000Z',
  ])

  // A day inside the range still saves.
  await finished.fill('2025-03-15')
  await finished.press('Enter')
  await expect
    .poll(async () => (await savedEntry(page, 'movie-tt1375666')).finishedAt?.slice(0, 10))
    .toBe('2025-03-15')
})

test('the back arrow stays in the app when the page came from another site', async ({
  page,
  baseURL,
}) => {
  await page.setContent(`<a href="${baseURL}/title/movie-tt1375666">Inception</a>`)
  await page.getByRole('link', { name: 'Inception' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Начало' })).toBeVisible()
  await page.getByRole('button', { name: 'Назад', exact: true }).click()
  await expect(page).toHaveURL(/\/discover$/)

  // Inside the app it is the browser's Back.
  await page
    .getByRole('main')
    .getByRole('link', { name: /^Интерстеллар/ })
    .first()
    .click()
  await expect(page.getByRole('heading', { level: 1, name: 'Интерстеллар' })).toBeVisible()
  await page.getByRole('button', { name: 'Назад', exact: true }).click()
  await expect(page).toHaveURL(/\/discover$/)
})

test('a note typed right before a reload is not lost', async ({ page }) => {
  await register(page)
  expect(
    (await api(page, 'POST', '/library', { titleId: 'movie-tt1375666', status: 'completed' }))
      .status,
  ).toBe(201)
  await openTitle(page, 'movie-tt1375666')
  const notes = page.getByRole('textbox', { name: 'Заметки' })
  // No blur and well within the 0.9 s autosave delay: only the page-hide flush can save it.
  await notes.fill('Written just before closing the tab')
  await page.reload()
  await expect(notes).toHaveValue('Written just before closing the tab')
})

test('a series added as watched shows every episode watched, not "0 of 12"', async ({ page }) => {
  await register(page)
  await openTitle(page, 'series-tt1475582')
  const episodes = page.getByRole('region', { name: 'Серии' })
  await expect(episodes.getByRole('checkbox', { name: /^S1 · E1,/ })).toBeVisible()
  // Hold the add so the page reads the (still empty) marks before the server marks every
  // aired episode as watched.
  await page.route('**/api/library', async (route) => {
    if (route.request().method() === 'POST')
      await new Promise((resolve) => setTimeout(resolve, 800))
    await route.continue()
  })
  const marksRead = page.waitForResponse((response) =>
    response.url().endsWith('/api/library/series-tt1475582/episodes'),
  )
  await page.getByRole('button', { name: 'Добавить как…' }).click()
  await page.getByRole('menuitemradio', { name: 'Просмотрено' }).click()
  await marksRead
  await expect(page.getByTestId('status-button')).toContainText('Просмотрено')
  await expect(episodes.getByText('Просмотрено 12 из 12')).toBeVisible()
  await expect(episodes.getByRole('button', { name: 'Отметить просмотренной' })).toHaveCount(0)
})

test('the back arrow out of a shared link opens Discover at the top', async ({ page, baseURL }) => {
  await page.setContent(`<a href="${baseURL}/title/series-tt0944947">GoT</a>`)
  await page.getByRole('link', { name: 'GoT' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Игра престолов' })).toBeVisible()
  const scroller = page.locator('main > div').first()
  await page.getByRole('region', { name: 'Серии' }).scrollIntoViewIfNeeded()
  expect(await scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(200)
  await page.getByRole('button', { name: 'Назад', exact: true }).click()
  await expect(page).toHaveURL(/\/discover$/)
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBe(0)
})

test('Back between two titles keeps focus on the arrow; the skip link adds no history entry', async ({
  page,
}) => {
  await register(page)
  for (const titleId of ['movie-tt0816692', 'movie-tt1375666'])
    expect((await api(page, 'POST', '/library', { titleId, status: 'completed' })).status).toBe(201)
  await openTitle(page, 'movie-tt0816692')
  await sidebar(page)
    .getByRole('link', { name: /Начало/ })
    .click()
  await expect(page.getByRole('heading', { level: 1, name: 'Начало' })).toBeVisible()

  // Skip link: focus moves to the content, the URL stays as it is.
  await page.getByRole('link', { name: 'Перейти к содержимому' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('main#main')).toBeFocused()
  expect(page.url()).not.toContain('#main')

  const back = page.getByRole('button', { name: 'Назад', exact: true })
  await back.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Интерстеллар' })).toBeVisible()
  await expect(back).toBeFocused()
})

test('one control of each kind: the hero rates, re-picking keeps the score, arrows select', async ({
  page,
}) => {
  await register(page)
  await api(page, 'POST', '/library', { titleId: 'movie-tt1375666', status: 'completed' })
  await openTitle(page, 'movie-tt1375666')
  const rating = page.getByTestId('rating-button')
  const scale = page.getByRole('radiogroup', { name: 'Ваша оценка' })
  const radio = (score: number) => scale.getByRole('radio', { name: `${score} из 10`, exact: true })
  const saved = async () => (await savedEntry(page, 'movie-tt1375666')).rating

  // Status, favourite and rating live in the hero only; the rail card keeps the rest.
  await expect(page.getByTestId('status-button')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'В избранное' })).toHaveCount(1)
  await expect(rating).toHaveCount(1)
  await expect(page.getByRole('radiogroup')).toHaveCount(0)
  const panel = page.getByRole('region', { name: 'В библиотеке' })
  await expect(panel.getByText('Даты')).toBeVisible()
  await expect(panel.getByRole('textbox', { name: 'Заметки' })).toBeVisible()
  await expect(panel.getByRole('button')).toHaveText(['Удалить из библиотеки'])

  await rating.click()
  await radio(7).click()
  await expect(scale).toHaveCount(0)
  await expect(rating).toHaveText('7/10')
  await expect.poll(saved).toBe(7)

  // Picking the current score again keeps it: clearing is a separate action.
  await rating.click()
  await expect(radio(7)).toBeChecked()
  await radio(7).click()
  await expect(scale).toHaveCount(0)
  await expect(rating).toHaveText('7/10')
  await page.waitForTimeout(300)
  expect(await saved()).toBe(7)

  // Arrow keys move and select (radio group); closing the popover keeps the choice.
  await rating.click()
  await expect(radio(7)).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(radio(9)).toBeFocused()
  await expect(radio(9)).toBeChecked()
  await expect(radio(7)).not.toBeChecked()
  await page.keyboard.press('Escape')
  await expect(rating).toHaveText('9/10')
  await expect(rating).toBeFocused()
  await expect.poll(saved).toBe(9)

  // Enter takes the focused score and closes.
  await page.keyboard.press('Enter')
  await expect(radio(9)).toBeFocused()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await expect(scale).toHaveCount(0)
  await expect(rating).toHaveText('10/10')
  await expect.poll(saved).toBe(10)

  await rating.click()
  await page.getByRole('button', { name: 'Сбросить оценку' }).click()
  await expect(rating).toHaveText('Оценить')
  await expect.poll(saved).toBeNull()
})

test('a score picked with the arrows is saved even when Back leaves the page with the popover open', async ({
  page,
}) => {
  await register(page)
  await api(page, 'POST', '/library', { titleId: 'movie-tt1375666', status: 'completed' })
  // In-app navigation, so Back unmounts the page instead of reloading the document.
  await page.goto('/discover?kind=movie')
  await page.locator('main a[href="/title/movie-tt1375666"]').first().click()
  await expect(page.getByTestId('rating-button')).toBeVisible()
  await page.getByTestId('rating-button').click()
  const scale = page.getByRole('radiogroup', { name: 'Ваша оценка' })
  await expect(scale.getByRole('radio', { name: '1 из 10', exact: true })).toBeFocused()
  // Down goes to the next score, as Right does (APG radio group).
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowRight')
  await expect(scale.getByRole('radio', { name: '3 из 10', exact: true })).toBeChecked()
  await page.goBack()
  await expect(page).toHaveURL(/\/discover/)
  await expect.poll(async () => (await savedEntry(page, 'movie-tt1375666')).rating).toBe(3)
})

test('the entry panel counts episodes as the episode list does, not from a stale entry', async ({
  page,
}) => {
  await register(page)
  const titleId = 'series-tt0903747'
  await api(page, 'POST', '/library', { titleId, status: 'in_progress' })
  await api(page, 'POST', `/library/${titleId}/episodes`, {
    episodes: [1, 2].map((number) => ({ season: 1, number })),
    watched: true,
  })
  // Saved counters that lag behind the list and the marks, as an entry cached before its
  // list arrived does.
  const stale = (entry: LibraryEntry): LibraryEntry =>
    entry.titleId === titleId
      ? { ...entry, watchedEpisodes: 7, totalEpisodes: 99, progress: 7, nextEpisode: null }
      : entry
  await page.route('**/api/library', async (route) => {
    const response = await route.fetch()
    const { entries } = (await response.json()) as { entries: LibraryEntry[] }
    await route.fulfill({ response, json: { entries: entries.map(stale) } })
  })
  await page.route(`**/api/library/${titleId}`, async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    const response = await route.fetch()
    const { entry } = (await response.json()) as { entry: LibraryEntry }
    await route.fulfill({ response, json: { entry: stale(entry) } })
  })

  await openTitle(page, titleId)
  const episodes = page.getByRole('region', { name: 'Серии' })
  const panel = page.getByRole('region', { name: 'В библиотеке' })
  await expect(episodes.getByText('Просмотрено 2 из 12')).toBeVisible()
  await expect(panel.getByText('2/12')).toBeVisible()
  await expect(panel.getByRole('progressbar', { name: 'Прогресс' })).toHaveAttribute(
    'aria-valuenow',
    '17',
  )
  await expect(panel.getByText('7/99')).toHaveCount(0)

  await episodes.getByRole('checkbox', { name: 'S1 · E3, Episode 3' }).click()
  await expect(episodes.getByText('Просмотрено 3 из 12')).toBeVisible()
  await expect(panel.getByText('3/12')).toBeVisible()
})

test('an episode row marks its episode anywhere along it; its menu is separate and named', async ({
  page,
}) => {
  await register(page)
  await api(page, 'POST', '/library', { titleId: 'series-tt0903747', status: 'planned' })
  await openTitle(page, 'series-tt0903747')
  const episodes = page.getByRole('region', { name: 'Серии' })
  const third = episodes.getByRole('checkbox', { name: 'S1 · E3, Episode 3' })
  // One checkbox per row, named by its code and title; the air date describes it.
  await expect(episodes.getByRole('checkbox')).toHaveCount(6)
  await expect(third).toHaveAccessibleDescription(/21 янв\. 2008/)

  // The name is part of the target, not only the circle.
  await episodes.getByText('Episode 3', { exact: true }).click()
  await expect(third).toBeChecked()
  await expect(episodes.getByText('Просмотрено 1 из 12')).toBeVisible()
  await expect(page.getByTestId('status-button')).toContainText('Смотрю')

  // Every row's menu says which episode it is for, and opening it marks nothing.
  await episodes.getByRole('button', { name: 'Ещё: S1 · E3', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Снять отметку' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(third).toBeChecked()
  await expect(episodes.getByRole('button', { name: /^Ещё: S1 · E\d+$/ })).toHaveCount(6)

  // Keyboard: Space on the row.
  const fourth = episodes.getByRole('checkbox', { name: 'S1 · E4, Episode 4' })
  await fourth.focus()
  await page.keyboard.press('Space')
  await expect(fourth).toBeChecked()
  await expect(episodes.getByText('Просмотрено 2 из 12')).toBeVisible()
})
