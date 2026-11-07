import { describe, expect, it } from 'vitest'
import { registerAccount, testApp } from './test-utils.ts'

const ANYA = { name: 'Аня', email: 'anya@example.com', password: 'correct horse 42' }
const BORIS = { name: 'Борис', email: 'boris@example.com', password: 'correct horse 43' }
const MOVIE = 'movie-tt0816692'
const SERIES = 'series-tt0903747'

async function signedIn(account = ANYA) {
  const t = testApp()
  await registerAccount(t, account)
  return t
}

describe('collections', () => {
  it('are created, filled with any titles, listed with posters and emptied again', async () => {
    const t = await signedIn()
    const created = await t.request('POST', '/api/collections', {
      name: '  Ужасы на Хеллоуин ',
      description: 'Страшно, но уютно',
    })
    expect(created.status).toBe(201)
    const id = created.body.collection.id
    expect(created.body.collection).toMatchObject({
      name: 'Ужасы на Хеллоуин',
      description: 'Страшно, но уютно',
      count: 0,
    })

    // Titles do not have to be in the library; adding one twice changes nothing.
    for (const titleId of [MOVIE, SERIES, MOVIE])
      expect((await t.request('POST', `/api/collections/${id}/items`, { titleId })).status).toBe(
        200,
      )
    const detail = await t.request('GET', `/api/collections/${id}`)
    expect(detail.body.collection.count).toBe(2)
    expect(
      detail.body.collection.items.map((item: { title: { id: string } }) => item.title.id),
    ).toEqual(expect.arrayContaining([MOVIE, SERIES]))
    expect((await t.request('GET', '/api/library')).body.entries).toEqual([])

    const mine = await t.request('GET', `/api/collections?titleId=${MOVIE}`)
    expect(mine.body.collections).toHaveLength(1)
    expect(mine.body.collections[0]).toMatchObject({ id, count: 2, contains: true })

    await t.request('DELETE', `/api/collections/${id}/items/${MOVIE}`)
    const after = await t.request('GET', `/api/collections?titleId=${MOVIE}`)
    expect(after.body.collections[0]).toMatchObject({ count: 1, contains: false })

    const renamed = await t.request('PATCH', `/api/collections/${id}`, { name: 'С друзьями' })
    expect(renamed.body.collection.name).toBe('С друзьями')
    expect((await t.request('DELETE', `/api/collections/${id}`)).status).toBe(200)
    expect((await t.request('GET', '/api/collections')).body.collections).toEqual([])
  })

  it('refuses empty or overlong names and unknown titles', async () => {
    const t = await signedIn()
    expect((await t.request('POST', '/api/collections', { name: '   ' })).status).toBe(400)
    expect((await t.request('POST', '/api/collections', { name: 'x'.repeat(81) })).status).toBe(400)
    const { body } = await t.request('POST', '/api/collections', { name: 'Ок' })
    const bad = await t.request('POST', `/api/collections/${body.collection.id}/items`, {
      titleId: 'not-a-title',
    })
    expect(bad.status).toBe(400)
  })

  it('are seen by others on the profile, but only their owner changes them', async () => {
    const t = testApp()
    await registerAccount(t, ANYA)
    const anya = (await t.request('GET', '/api/auth/session')).body.user.id
    const { body } = await t.request('POST', '/api/collections', { name: 'Любимое' })
    const id = body.collection.id
    await t.request('POST', '/api/collections', { name: 'Пустая' })
    await t.request('POST', `/api/collections/${id}/items`, { titleId: MOVIE })

    t.clearCookie()
    await registerAccount(t, BORIS)
    const profile = await t.request('GET', `/api/users/${anya}/profile`)
    // Only collections with titles show on the profile.
    expect(profile.body.collections.map((c: { name: string }) => c.name)).toEqual(['Любимое'])
    expect((await t.request('GET', `/api/collections/${id}`)).body.collection.count).toBe(1)
    for (const [method, path, payload] of [
      ['PATCH', `/api/collections/${id}`, { name: 'Моё' }],
      ['DELETE', `/api/collections/${id}`, undefined],
      ['POST', `/api/collections/${id}/items`, { titleId: SERIES }],
      ['DELETE', `/api/collections/${id}/items/${MOVIE}`, undefined],
    ] as const)
      expect((await t.request(method, path, payload)).status).toBe(404)
    // Borís's own list stays his own.
    expect((await t.request('GET', '/api/collections')).body.collections).toEqual([])
  })

  it('travel with the export: an import recreates them and merges by name', async () => {
    const t = await signedIn()
    const { body } = await t.request('POST', '/api/collections', {
      name: 'Любимое',
      description: 'Ну',
    })
    await t.request('POST', `/api/collections/${body.collection.id}/items`, { titleId: MOVIE })
    const exported = (await t.request('GET', '/api/me/export')).body
    expect(exported.collections).toEqual([
      expect.objectContaining({
        name: 'Любимое',
        description: 'Ну',
        items: [
          expect.objectContaining({
            titleId: MOVIE,
            title: expect.objectContaining({ id: MOVIE }),
          }),
        ],
      }),
    ])

    const other = testApp()
    await registerAccount(other, BORIS)
    const existing = await other.request('POST', '/api/collections', { name: 'Любимое' })
    await other.request('POST', `/api/collections/${existing.body.collection.id}/items`, {
      titleId: SERIES,
    })
    const imported = await other.request('POST', '/api/me/import', exported)
    expect(imported.status).toBe(200)
    expect(imported.body.collections).toBe(1)
    const lists = (await other.request('GET', '/api/collections')).body.collections
    expect(lists).toHaveLength(1)
    expect(lists[0]).toMatchObject({ name: 'Любимое', count: 2 })

    // Files from before collections existed still import.
    const { collections: _gone, ...older } = exported
    expect((await other.request('POST', '/api/me/import', older)).status).toBe(200)
  })

  it('go with the account', async () => {
    const t = await signedIn()
    const { body } = await t.request('POST', '/api/collections', { name: 'Любимое' })
    await t.request('POST', `/api/collections/${body.collection.id}/items`, { titleId: MOVIE })
    expect((await t.request('POST', '/api/me/delete', { password: ANYA.password })).status).toBe(
      200,
    )
    const left = t.db.prepare('SELECT COUNT(*) AS n FROM collections').get() as { n: number }
    const items = t.db.prepare('SELECT COUNT(*) AS n FROM collection_items').get() as { n: number }
    expect([left.n, items.n]).toEqual([0, 0])
  })
})
