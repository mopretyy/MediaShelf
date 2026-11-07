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
  await expect(page.getByRole('button', { name: '+1 серия' })).toBeVisible()
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
