import { expect, test } from '@playwright/test'
import { api, openTitle, register } from './helpers.ts'

async function myId(page: import('@playwright/test').Page) {
  return (await api<{ user: { id: string } }>(page, 'GET', '/auth/session')).body.user.id
}

test('a collection is made, filled from title pages, shown on Home and the profile, and deleted', async ({
  page,
}) => {
  await register(page)
  await page.goto('/collections')
  await expect(page.getByRole('heading', { name: 'Подборок пока нет' })).toBeVisible()
  await page.getByRole('button', { name: 'Новая подборка' }).click()
  const form = page.getByRole('dialog', { name: 'Новая подборка' })
  await form.getByLabel('Название').fill('Ужасы на Хеллоуин')
  await form.getByLabel(/Описание/).fill('Страшно, но уютно')
  await form.getByRole('button', { name: 'Новая подборка' }).click()
  // A new collection opens straight away, empty, with a hint where titles come from.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ужасы на Хеллоуин')
  await expect(page.getByText('В подборке пока пусто')).toBeVisible()
  const collectionUrl = page.url()

  // From a title page: the picker shows the collection, a tap puts the title in.
  await openTitle(page, 'movie-tt0816692')
  await page.getByRole('button', { name: 'Ещё' }).first().click()
  await page.getByRole('menuitem', { name: 'В подборку' }).click()
  const picker = page.getByTestId('collection-picker')
  const box = picker.getByRole('checkbox', { name: /Ужасы на Хеллоуин/ })
  await expect(box).toHaveAttribute('aria-checked', 'false')
  await box.click()
  await expect(page.getByText('Добавлено в «Ужасы на Хеллоуин»')).toBeVisible()
  await expect(box).toHaveAttribute('aria-checked', 'true')
  // A second collection made from the picker already holds the title.
  await picker.getByRole('button', { name: 'Новая подборка' }).click()
  await page
    .getByRole('dialog', { name: 'Новая подборка' })
    .getByLabel('Название')
    .fill('С друзьями')
  await page.keyboard.press('Enter')
  await expect(page.getByText('Добавлено в «С друзьями»')).toBeVisible()
  await page.keyboard.press('Escape')
  // Not in the library: a collection takes any title.
  expect((await api<{ entries: unknown[] }>(page, 'GET', '/library')).body.entries).toEqual([])

  await page.goto(collectionUrl)
  await expect(page.getByText('1 тайтл · Страшно, но уютно')).toBeVisible()
  await expect(page.getByRole('link', { name: /Интерстеллар/ })).toBeVisible()

  await page.goto('/')
  const shelf = page.locator('section', {
    has: page.getByRole('heading', { name: 'Ваши подборки' }),
  })
  await expect(shelf.getByTestId('collection-card')).toHaveCount(2)
  await page.goto(`/users/${await myId(page)}`)
  const onProfile = page.locator('section', {
    has: page.getByRole('heading', { name: 'Подборки' }),
  })
  await expect(onProfile.getByTestId('collection-card').first()).toBeVisible()

  // The owner takes a title out, renames and deletes.
  await page.goto(collectionUrl)
  await page.getByRole('button', { name: 'Убрать из подборки: Интерстеллар' }).click()
  await expect(page.getByText('В подборке пока пусто')).toBeVisible()
  await page.getByRole('button', { name: 'Изменить' }).click()
  const edit = page.getByRole('dialog', { name: 'Изменить подборку' })
  await edit.getByLabel('Название').fill('Ужасы')
  await edit.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ужасы')
  await page.getByRole('button', { name: 'Удалить' }).click()
  await page
    .getByRole('dialog', { name: 'Удалить подборку?' })
    .getByRole('button', { name: 'Удалить' })
    .click()
  await expect(page).toHaveURL(/\/collections$/)
  await expect(page.getByText('Подборка удалена')).toBeVisible()
  await expect(page.getByTestId('collection-card')).toHaveCount(1)
})

test('someone else’s collection is read-only', async ({ page }) => {
  await register(page, 'Аня')
  const { body } = await api<{ collection: { id: string } }>(page, 'POST', '/collections', {
    name: 'Любимое',
  })
  await api(page, 'POST', `/collections/${body.collection.id}/items`, {
    titleId: 'movie-tt0816692',
  })
  await page.context().clearCookies()
  await register(page, 'Борис')
  await page.goto(`/collections/${body.collection.id}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Любимое')
  await expect(page.getByRole('link', { name: 'Автор: Аня' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Изменить' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Убрать из подборки/ })).toHaveCount(0)
})

test('a collection opens on a frame, and its owner picks which title gives it', async ({
  page,
}) => {
  await register(page)
  const { body } = await api<{ collection: { id: string } }>(page, 'POST', '/collections', {
    name: 'Ночью',
  })
  for (const titleId of ['movie-tt1375666', 'movie-tt0816692'])
    await api(page, 'POST', `/collections/${body.collection.id}/items`, { titleId })
  // The offline catalog has no pictures: give the titles a poster.
  const poster = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="3"><rect width="2" height="3" fill="#345"/></svg>',
  )}`
  await page.route(`**/api/collections/${body.collection.id}`, async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    const response = await route.fetch()
    const json = (await response.json()) as {
      collection: { items: { title: { poster: string | null } }[] }
    }
    for (const item of json.collection.items) item.title.poster = poster
    await route.fulfill({ response, json })
  })
  await page.goto(`/collections/${body.collection.id}`)
  const hero = page.getByTestId('collection-hero')
  await expect(hero.getByRole('heading', { level: 1 })).toHaveText('Ночью')
  await expect(hero).toContainText('2 тайтла')

  const pick = page.getByRole('button', { name: 'Сделать обложкой: Интерстеллар' })
  await expect(pick).toHaveAttribute('aria-pressed', 'false')
  await pick.click()
  await expect(page.getByText('Обложка подборки обновлена')).toBeVisible()
  await expect(pick).toHaveAttribute('aria-pressed', 'true')
  const { body: saved } = await api<{ collection: { coverTitleId: string | null } }>(
    page,
    'GET',
    `/collections/${body.collection.id}`,
  )
  expect(saved.collection.coverTitleId).toBe('movie-tt0816692')
})
