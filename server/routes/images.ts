import { Hono } from 'hono'
import { limit, requireUser, type AppDeps, type AppEnv } from '../context.ts'
import { ApiError } from '../http/errors.ts'

/**
 * Hosts the catalogs take posters and frames from. The proxy fetches nothing else: it exists so
 * the browser can draw these pictures on a canvas (the «My year» image), which needs CORS that
 * some of them (Cinemeta's metahub, Shikimori) do not send. Never an open proxy, never a way
 * into the server's own network.
 */
const IMAGE_HOSTS = [
  'steamstatic.com',
  'metahub.space',
  'media-amazon.com',
  'anilist.co',
  'shikimori.io',
  'shikimori.one',
  'myanimelist.net',
  'gog-statics.com',
  'tvmaze.com',
  'wikimedia.org',
]

/** Raster pictures only: an SVG served from this origin could carry script. */
const IMAGE_TYPES = /^image\/(jpeg|png|webp|gif|avif)\b/i
const MAX_BYTES = 8 * 1024 * 1024
const MAX_REDIRECTS = 3
const TIMEOUT_MS = 10_000

export function allowedImageUrl(raw: string | undefined): URL | null {
  if (!raw || raw.length > 2048) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.port || url.username || url.password) return null
  const host = url.hostname.toLowerCase()
  return IMAGE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
    ? url
    : null
}

async function readLimited(response: Response): Promise<Uint8Array> {
  const reader = response.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BYTES) {
      await reader.cancel()
      throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Image too large')
    }
    chunks.push(value)
  }
  const out = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

export function imagesRoutes(
  deps: AppDeps,
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
) {
  const app = new Hono<AppEnv>()

  // GET /api/images?url=https://… — a catalog picture, same-origin, for drawing on a canvas.
  app.get('/', async (c) => {
    const user = requireUser(c)
    limit(deps.limits, 'catalog', user.id)
    const requested = allowedImageUrl(c.req.query('url'))
    if (!requested) throw new ApiError(400, 'BAD_REQUEST', 'Not a catalog image')
    let url: URL = requested
    for (let hop = 0; ; hop++) {
      let response: Response
      try {
        response = await fetchImpl(url, {
          redirect: 'manual',
          headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8' },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
      } catch {
        throw new ApiError(502, 'CATALOG_UNAVAILABLE', 'Image source unavailable')
      }
      const location = response.headers.get('location')
      if (response.status >= 300 && response.status < 400 && location) {
        // Every hop is checked again: a redirect must not lead outside the allowed hosts.
        const next: URL | null =
          hop < MAX_REDIRECTS ? allowedImageUrl(new URL(location, url).href) : null
        if (!next) throw new ApiError(400, 'BAD_REQUEST', 'Redirected away from catalog images')
        url = next
        continue
      }
      if (!response.ok) throw new ApiError(502, 'CATALOG_UNAVAILABLE', 'Image source failed')
      const type = response.headers.get('content-type') ?? ''
      if (!IMAGE_TYPES.test(type)) throw new ApiError(400, 'BAD_REQUEST', 'Not an image')
      if (Number(response.headers.get('content-length') ?? 0) > MAX_BYTES)
        throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Image too large')
      const body = await readLimited(response)
      return c.body(body as Uint8Array<ArrayBuffer>, 200, {
        'Content-Type': type,
        'Cache-Control': 'private, max-age=86400',
        'Content-Security-Policy': "default-src 'none'",
        'X-Content-Type-Options': 'nosniff',
      })
    }
  })

  return app
}
