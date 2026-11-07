import { describe, expect, it } from 'vitest'
import { registerAccount, testApp } from '../test-utils.ts'
import { allowedImageUrl } from './images.ts'

const POSTER = 'https://images.metahub.space/poster/medium/tt0816692/img'
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])

function fakeFetch(routes: Record<string, () => Response>) {
  const calls: string[] = []
  const impl = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input)
    calls.push(url)
    const route = routes[url]
    return route ? route() : new Response('missing', { status: 404 })
  }) as typeof fetch
  return { impl, calls }
}

async function signedIn(routes: Record<string, () => Response>) {
  const fake = fakeFetch(routes)
  const t = testApp(undefined, { imageFetch: fake.impl })
  await registerAccount(t, { name: 'Аня', email: 'anya@example.com', password: 'correct horse 42' })
  return { t, calls: fake.calls }
}

const image =
  (type = 'image/webp') =>
  () =>
    new Response(JPEG, { status: 200, headers: { 'Content-Type': type } })

describe('allowedImageUrl', () => {
  it('takes https pictures from the catalogs’ hosts only', () => {
    expect(allowedImageUrl(POSTER)?.hostname).toBe('images.metahub.space')
    expect(allowedImageUrl('https://shared.fastly.steamstatic.com/a.jpg')).not.toBeNull()
    expect(allowedImageUrl('https://shikimori.one/system/animes/original/1.jpg')).not.toBeNull()
    for (const url of [
      'http://images.metahub.space/poster.jpg',
      'https://images.metahub.space:8443/poster.jpg',
      'https://user:pass@images.metahub.space/poster.jpg',
      'https://evilmetahub.space/poster.jpg',
      'https://metahub.space.evil.com/poster.jpg',
      'https://127.0.0.1/poster.jpg',
      'https://localhost/poster.jpg',
      'file:///etc/passwd',
      'not a url',
      undefined,
    ])
      expect(allowedImageUrl(url)).toBeNull()
  })
})

describe('GET /api/images', () => {
  it('passes a catalog picture through, same-origin and cacheable', async () => {
    const { t } = await signedIn({ [POSTER]: image() })
    const res = await t.app.request(
      `http://localhost/api/images?url=${encodeURIComponent(POSTER)}`,
      {
        headers: { Cookie: t.cookie() },
      },
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/webp')
    expect(res.headers.get('cache-control')).toBe('private, max-age=86400')
    expect(res.headers.get('content-security-policy')).toBe("default-src 'none'")
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(JPEG)
  })

  it('needs an account', async () => {
    const t = testApp(undefined, { imageFetch: fakeFetch({ [POSTER]: image() }).impl })
    const res = await t.request('GET', `/api/images?url=${encodeURIComponent(POSTER)}`)
    expect(res.status).toBe(401)
  })

  it('refuses other hosts, and redirects that lead away from the catalogs', async () => {
    const { t, calls } = await signedIn({
      [POSTER]: () =>
        new Response(null, { status: 302, headers: { Location: 'http://169.254.169.254/latest' } }),
    })
    expect(
      (await t.request('GET', `/api/images?url=${encodeURIComponent('https://example.com/a.jpg')}`))
        .status,
    ).toBe(400)
    expect(calls).toEqual([])
    expect((await t.request('GET', `/api/images?url=${encodeURIComponent(POSTER)}`)).status).toBe(
      400,
    )
    expect(calls).toEqual([POSTER])
  })

  it('follows redirects within the catalogs and refuses what is not a raster picture', async () => {
    const moved = 'https://shikimori.io/system/animes/original/52991.jpg'
    const svg = 'https://images.metahub.space/poster/medium/tt1/img'
    const { t } = await signedIn({
      'https://shikimori.one/system/animes/original/52991.jpg': () =>
        new Response(null, { status: 301, headers: { Location: moved } }),
      [moved]: image('image/jpeg'),
      [svg]: image('image/svg+xml'),
    })
    const ok = await t.request(
      'GET',
      `/api/images?url=${encodeURIComponent('https://shikimori.one/system/animes/original/52991.jpg')}`,
    )
    expect(ok.status).toBe(200)
    expect((await t.request('GET', `/api/images?url=${encodeURIComponent(svg)}`)).status).toBe(400)
  })
})
