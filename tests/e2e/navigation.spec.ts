import { expect, test, type Page } from '@playwright/test'
import type { LibraryEntry } from '../../shared/types.ts'
import { api, openTitle, register } from './helpers.ts'

const SEARCH_PLACEHOLDER = 'Поиск по библиотеке и каталогу…'
const ADD_PLACEHOLDER = 'Найдите игру, фильм, сериал или аниме…'

async function libraryIds(page: Page) {
  const { body } = await api<{ entries: LibraryEntry[] }>(page, 'GET', '/library')
  return body.entries.map((entry) => entry.titleId)
}

/** A keydown as Chrome reports it with the Russian (ЙЦУКЕН) layout active. */
async function pressWithRussianLayout(
  page: Page,
  init: { key: string; code: string; ctrlKey?: boolean },
) {
  await page.evaluate(
    (init) =>
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }),
      ),
    init,
  )
}

test('the add palette never acts on the previous query’s results', async ({ page }) => {
  await register(page)
  const addButton = page.getByRole('button', { name: 'Добавить', exact: true })
  await addButton.click()
  await page.getByPlaceholder(ADD_PLACEHOLDER).fill('witcher')
  await expect(page.getByRole('option', { name: /Ведьмак 3/ })).toBeVisible()
  await page.keyboard.press('Escape')

  // Enter right after typing lands in the debounce window: the Witcher results are still cached.
  await addButton.click()
  await expect(page.getByPlaceholder(ADD_PLACEHOLDER)).toBeFocused()
  await page.keyboard.type('Interstellar')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('option', { name: /Интерстеллар/ })).toBeVisible()
  await expect(page.getByRole('option', { name: /Ведьмак/ })).toHaveCount(0)
  expect(await libraryIds(page)).toEqual([])
  await page.keyboard.press('Enter')
  await expect(page.getByText('Добавлено в библиотеку')).toBeVisible()
  expect(await libraryIds(page)).toEqual(['movie-tt0816692'])

  // Enter while the new query is in flight, the old results kept as placeholder data.
  await page.route('**/api/catalog/search?*', async (route) => {
    if (route.request().url().includes('q=Inception'))
      await new Promise((resolve) => setTimeout(resolve, 1_200))
    await route.continue()
  })
  await addButton.click()
  const input = page.getByPlaceholder(ADD_PLACEHOLDER)
  await input.fill('witcher')
  await expect(page.getByRole('option', { name: /Ведьмак 3/ })).toBeVisible()
  await input.fill('Inception')
  await page.waitForTimeout(400)
  await expect(page.getByText('Ищем в каталоге…')).toBeVisible()
  await expect(page.getByRole('option', { name: /Ведьмак/ })).toHaveCount(0)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('option', { name: /Начало/ })).toBeVisible()
  expect(await libraryIds(page)).toEqual(['movie-tt0816692'])
  await page.keyboard.press('Enter')
  await expect
    .poll(async () => (await libraryIds(page)).sort())
    .toEqual(['movie-tt0816692', 'movie-tt1375666'])
})

test('Ctrl K closes the palette like Escape and works with the Russian layout', async ({
  page,
}) => {
  await register(page)
  const input = page.getByPlaceholder(SEARCH_PLACEHOLDER)
  await page.keyboard.press('Control+K')
  await input.fill('witcher')
  await expect(page.getByRole('option', { name: /Ведьмак 3/ })).toBeVisible()
  await page.keyboard.press('Control+K')
  await expect(input).toHaveCount(0)
  await page.keyboard.press('Control+K')
  await expect(input).toHaveValue('')
  await page.keyboard.press('Escape')
  await expect(input).toHaveCount(0)

  // ЙЦУКЕН reports Ctrl+K as «л» and the '/' key as '.', with the physical key in `code`.
  await pressWithRussianLayout(page, { key: 'л', code: 'KeyK', ctrlKey: true })
  await expect(input).toBeVisible()
  await pressWithRussianLayout(page, { key: 'л', code: 'KeyK', ctrlKey: true })
  await expect(input).toHaveCount(0)
  await pressWithRussianLayout(page, { key: '.', code: 'Slash' })
  await expect(input).toBeVisible()
  await page.keyboard.press('Escape')

  // '/' typed into a field stays in the field.
  await page.goto('/discover')
  const search = page.getByRole('searchbox', { name: 'Поиск' })
  await search.click()
  await page.keyboard.type('a/b')
  await expect(search).toHaveValue('a/b')
  await expect(input).toHaveCount(0)
})

test('the year story keeps shell shortcuts from opening a palette under it', async ({ page }) => {
  await register(page)
  for (const titleId of ['movie-tt1375666', 'movie-tt0816692'])
    expect((await api(page, 'POST', '/library', { titleId, status: 'completed' })).status).toBe(201)
  await page.goto('/stats/year')
  const story = page.getByRole('dialog')
  const counter = story.getByText(/^\d+ \/ \d+$/)
  await expect(counter).toHaveText(/^1 \//)

  await page.keyboard.press('Control+K')
  await page.keyboard.press('/')
  await page.keyboard.press('ArrowRight')
  await expect(counter).toHaveText(/^2 \//)
  await expect(page.getByPlaceholder(SEARCH_PLACEHOLDER)).toHaveCount(0)
  await story.getByRole('button', { name: 'Дальше' }).click()
  await expect(counter).toHaveText(/^3 \//)
  await page.keyboard.press('ArrowLeft')
  await expect(counter).toHaveText(/^2 \//)

  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/stats$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Статистика' })).toBeVisible()
  await expect(story).toHaveCount(0)
  // Back in the shell the shortcut works again.
  await page.keyboard.press('Control+K')
  await expect(page.getByPlaceholder(SEARCH_PLACEHOLDER)).toBeVisible()
})

test('library search keeps every keystroke and follows Back', async ({ page }) => {
  await register(page)
  for (const titleId of ['movie-tt1375666', 'movie-tt0816692', 'series-tt0903747'])
    expect((await api(page, 'POST', '/library', { titleId, status: 'planned' })).status).toBe(201)
  await page.goto('/library')
  const search = page.getByRole('searchbox', { name: 'Искать в библиотеке' })
  const cards = page.getByRole('main').getByRole('link', { name: /Интерстеллар|Начало|Во все/ })
  await expect(cards).toHaveCount(3)

  // Full speed, no pause between keys.
  await search.click()
  await page.keyboard.type('Interstellar Breaking')
  await expect(search).toHaveValue('Interstellar Breaking')
  await expect(page).toHaveURL(/q=Interstellar\+Breaking/)

  // Editing inside the text keeps the caret where it is.
  await search.fill('Inception')
  await search.press('Home')
  await search.press('ArrowRight')
  await page.keyboard.type('XYZ')
  await expect(search).toHaveValue('IXYZnception')

  await search.fill('интер')
  await expect(cards).toHaveCount(1)
  await expect(cards.first()).toContainText('Интерстеллар')
  await expect(page).toHaveURL(/q=%D0%B8%D0%BD%D1%82%D0%B5%D1%80/)

  // The sidebar link clears the search; Back brings it back into the box.
  await page.getByRole('navigation').getByRole('link', { name: 'Библиотека' }).click()
  await expect(search).toHaveValue('')
  await expect(cards).toHaveCount(3)
  await page.goBack()
  await expect(search).toHaveValue('интер')
  await expect(cards).toHaveCount(1)
})

test('discover drops a genre from an earlier query and explains empty filters', async ({
  page,
}) => {
  await register(page)
  await page.goto('/discover?q=witcher')
  await page.getByRole('combobox', { name: 'Жанр' }).click()
  await page.getByRole('option', { name: 'Ролевая' }).click()
  await expect(page).toHaveURL(/genre=RPG/)

  await page.getByRole('searchbox', { name: 'Поиск' }).fill('Начало')
  await expect(page.getByRole('main').getByRole('link', { name: /Начало/ })).toBeVisible()
  await expect(page).not.toHaveURL(/genre=/)
  await expect(page.getByRole('combobox', { name: 'Жанр' })).toHaveText('Любой жанр')

  // Every result is already in the library and hidden: say so and offer a way out.
  expect(
    (await api(page, 'POST', '/library', { titleId: 'steam-292030', status: 'planned' })).status,
  ).toBe(201)
  await page.goto('/discover?q=witcher&genre=RPG&hide=1')
  await expect(page.getByText('Ничего не подходит под фильтры')).toBeVisible()
  await page.getByRole('button', { name: 'Сбросить фильтры' }).click()
  await expect(page.getByRole('main').getByRole('link', { name: /Ведьмак 3/ })).toBeVisible()
  await expect(page).not.toHaveURL(/genre=|hide=/)
})

test('palette recents stay with the account that opened them', async ({ page }) => {
  await register(page, 'Алиса')
  await openTitle(page, 'movie-tt1375666')
  await page.keyboard.press('Control+K')
  await expect(page.getByRole('group', { name: 'Недавние' })).toContainText('Начало')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: /^Аккаунт/ }).click()
  await page.getByRole('menuitem', { name: 'Выйти' }).click()
  await expect(page.getByRole('link', { name: 'Войти' }).first()).toBeVisible()
  await register(page, 'Борис')
  await page.keyboard.press('Control+K')
  await expect(page.getByPlaceholder(SEARCH_PLACEHOLDER)).toBeVisible()
  await expect(page.getByRole('group', { name: 'Недавние' })).toHaveCount(0)
  await expect(page.getByRole('option', { name: /Начало/ })).toHaveCount(0)
})

test('closing the palette puts focus back where it was', async ({ page }) => {
  await register(page)
  const searchButton = page.getByRole('button', { name: /^Поиск/ }).first()
  await searchButton.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByPlaceholder(SEARCH_PLACEHOLDER)).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(searchButton).toBeFocused()

  // Ctrl K from a text field returns to that field, not to <body>.
  await page.goto('/discover')
  const discoverSearch = page.getByRole('searchbox', { name: 'Поиск' })
  await discoverSearch.click()
  await page.keyboard.press('Control+K')
  await expect(page.getByPlaceholder(SEARCH_PLACEHOLDER)).toBeFocused()
  await page.keyboard.press('Control+K')
  await expect(page.getByPlaceholder(SEARCH_PLACEHOLDER)).toHaveCount(0)
  await expect(discoverSearch).toBeFocused()
})

test('a wrong address says so and offers the way on', async ({ page }) => {
  await register(page)
  await page.goto('/no-such-page')
  await expect(page.getByRole('heading', { level: 1, name: 'Страница не найдена' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'На главную' })).toHaveAttribute('href', '/')
  await page.getByRole('main').getByRole('link', { name: 'Обзор' }).click()
  await expect(page).toHaveURL(/\/discover$/)
})
