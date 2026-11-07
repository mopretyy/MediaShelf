import { describe, expect, it } from 'vitest'
import { fakeCatalog, registerAccount, testApp } from './test-utils.ts'

const account = { name: 'Дима', email: 'dima@example.com', password: 'correct horse battery' }

// 1x1 PNG
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const png = `data:image/png;base64,${PNG}`

async function signedIn(t = testApp()) {
  expect((await registerAccount(t, account)).status).toBe(201)
  const session = await t.request('GET', '/api/auth/session')
  return { t, id: session.body.user.id as string }
}

/** The fake catalog, with backdrops for the titles listed. */
function catalogWithBackdrops(backdrops: Record<string, string>) {
  const catalog = fakeCatalog()
  return {
    ...catalog,
    details: async (...args: Parameters<typeof catalog.details>) => {
      const title = await catalog.details(...args)
      return title && { ...title, backdrop: backdrops[title.id] ?? null }
    },
  }
}

describe('profile cover', () => {
  it('stores an uploaded picture and serves it on the profile', async () => {
    const { t, id } = await signedIn()
    expect((await t.request('PUT', '/api/me/cover', { dataUrl: png })).status).toBe(200)
    await t.request('PATCH', '/api/me', { preferences: { banner: 'image' } })

    const profile = await t.request('GET', `/api/users/${id}/profile`)
    expect(profile.body.user.banner).toBe('image')
    expect(profile.body.bannerImage).toMatch(new RegExp(`^/api/users/${id}/cover\\?v=\\d+$`))
    // Settings learn about the picture from here instead of probing the image URL (a 404).
    expect(profile.body.coverVersion).toEqual(expect.any(Number))

    const image = await t.request('GET', `/api/users/${id}/cover`)
    expect(image.status).toBe(200)
    expect(image.headers.get('content-type')).toBe('image/png')
    const etag = image.headers.get('etag')
    expect(etag).toBeTruthy()
  })

  it('rejects anything that is not a real image', async () => {
    const { t } = await signedIn()
    const text = Buffer.from('<script>alert(1)</script>').toString('base64')
    const fake = await t.request('PUT', '/api/me/cover', {
      dataUrl: `data:image/png;base64,${text}`,
    })
    expect(fake.status).toBe(400)
    const svg = await t.request('PUT', '/api/me/cover', {
      dataUrl: `data:image/svg+xml;base64,${text}`,
    })
    expect(svg.status).toBe(400)
  })

  it('falls back to the poster collage once the picture is removed', async () => {
    const { t, id } = await signedIn()
    await t.request('PUT', '/api/me/cover', { dataUrl: png })
    await t.request('PATCH', '/api/me', { preferences: { banner: 'image' } })
    expect((await t.request('DELETE', '/api/me/cover')).status).toBe(200)
    const profile = await t.request('GET', `/api/users/${id}/profile`)
    expect(profile.body.bannerImage).toBeNull()
    expect(profile.body.coverVersion).toBeNull()
    expect((await t.request('GET', `/api/users/${id}/cover`)).status).toBe(404)
  })

  it('keeps an uploaded picture private while it is not the shown banner', async () => {
    const { t, id } = await signedIn()
    await t.request('PUT', '/api/me/cover', { dataUrl: png })
    // The owner still sees it (settings show the picture before it is chosen).
    expect((await t.request('GET', `/api/users/${id}/profile`)).body.coverVersion).toEqual(
      expect.any(Number),
    )
    expect((await t.request('GET', `/api/users/${id}/cover`)).status).toBe(200)

    t.clearCookie()
    await registerAccount(t, { ...account, name: 'Гость', email: 'guest@example.com' })
    expect((await t.request('GET', `/api/users/${id}/profile`)).body.coverVersion).toBeNull()
    expect((await t.request('GET', `/api/users/${id}/cover`)).status).toBe(404)
  })

  it('only accepts library titles as the cover title', async () => {
    const { t } = await signedIn()
    const outside = await t.request('PATCH', '/api/me', {
      preferences: { banner: 'title', bannerTitleId: 'movie-tt0816692' },
    })
    expect(outside.status).toBe(404)
    await t.request('POST', '/api/library', { titleId: 'movie-tt0816692' })
    const inside = await t.request('PATCH', '/api/me', {
      preferences: { banner: 'title', bannerTitleId: 'movie-tt0816692' },
    })
    expect(inside.status).toBe(200)
  })

  it('takes the favourite cover from the newest favourite that has a backdrop', async () => {
    const { t, id } = await signedIn(
      testApp(
        catalogWithBackdrops({
          'series-tt0903747': 'https://img.example/breaking-bad.jpg',
          'steam-1145360': 'https://img.example/hades.jpg',
        }),
      ),
    )
    await t.request('PATCH', '/api/me', { preferences: { banner: 'favorite' } })
    const banner = async () =>
      (await t.request('GET', `/api/users/${id}/profile`)).body.bannerImage as string | null

    // Interstellar has no backdrop: a favourite without one leaves the collage.
    await t.request('POST', '/api/library', { titleId: 'movie-tt0816692', favorite: true })
    expect(await banner()).toBeNull()

    // Oldest first; a backdrop on a title that is not a favourite does not count.
    await t.request('POST', '/api/library', { titleId: 'series-tt0903747', favorite: true })
    await t.request('POST', '/api/library', { titleId: 'steam-1145360' })
    expect(await banner()).toBe('https://img.example/breaking-bad.jpg')

    // The newest favourite comes first, and the one without a backdrop is skipped.
    await new Promise((resolve) => setTimeout(resolve, 5))
    await t.request('PATCH', '/api/library/steam-1145360', { favorite: true })
    await new Promise((resolve) => setTimeout(resolve, 5))
    await t.request('PATCH', '/api/library/movie-tt0816692', { rating: 9 })
    const profile = await t.request('GET', `/api/users/${id}/profile`)
    expect(profile.body.favorites[0].titleId).toBe('movie-tt0816692')
    expect(profile.body.bannerImage).toBe('https://img.example/hades.jpg')
  })

  it('maps covers from the old preset list to the collage', async () => {
    const { t, id } = await signedIn()
    const profile = await t.request('GET', `/api/users/${id}/profile`)
    expect(profile.body.user.banner).toBe('none')
  })
})
