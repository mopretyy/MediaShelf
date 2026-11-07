// Draws the «My year» picture (1080 × 1920, a phone story) on a canvas, in the browser.
// Catalog pictures come through /api/images: some hosts send no CORS headers, and a canvas with
// a foreign picture on it cannot be saved.

export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1920

export interface ShareCardData {
  year: number
  /** «Итоги года · Влад». */
  kicker: string
  /** «24 тайтла завершено». */
  headline: string
  /** Up to five posters, the best first: the middle of the fan is the first. */
  posters: string[]
  /** The best rated title of the year: «Номер один · 10/10» over its name; null if none. */
  first: { label: string; name: string } | null
  /** Two to four facts: «Лучший месяц» → «Март». */
  facts: { label: string; value: string }[]
  /** «Игры 7 · Фильмы 8 …», kinds with something finished. */
  kinds: string
  footer: string
}

const FONT = '"Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", sans-serif'

/** Same-origin URL for a picture: data and local ones as they are, the rest via the proxy. */
export function drawableUrl(src: string, origin = window.location.origin) {
  if (src.startsWith('data:') || src.startsWith('blob:')) return src
  try {
    const url = new URL(src, origin)
    if (url.origin === origin) return url.href
  } catch {
    return src
  }
  return `/api/images?url=${encodeURIComponent(src)}`
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = drawableUrl(src)
  })
}

type Ctx = CanvasRenderingContext2D

function font(ctx: Ctx, weight: number, size: number, tracking = 0) {
  ctx.font = `${weight} ${size}px ${FONT}`
  // Display sizes use tight tracking, as on the site (−0.022 em); ignored where unsupported.
  if ('letterSpacing' in ctx)
    (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${tracking}px`
}

/** Cuts a line to the width with an ellipsis. */
function fit(ctx: Ctx, text: string, width: number) {
  if (ctx.measureText(text).width <= width) return text
  let cut = text
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1)
  return `${cut.trimEnd()}…`
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r)
  else ctx.rect(x, y, w, h)
}

/** Draws a picture covering the box, cropped from the centre like `object-fit: cover`. */
function cover(ctx: Ctx, image: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight)
  const sw = w / scale
  const sh = h / scale
  ctx.drawImage(
    image,
    (image.naturalWidth - sw) / 2,
    (image.naturalHeight - sh) / 2,
    sw,
    sh,
    x,
    y,
    w,
    h,
  )
}

function poster(ctx: Ctx, image: HTMLImageElement | null, w: number, h: number) {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = 48
  ctx.shadowOffsetY = 24
  roundRect(ctx, -w / 2, -h, w, h, 22)
  ctx.fillStyle = '#1c1c1c'
  ctx.fill()
  ctx.restore()
  ctx.save()
  roundRect(ctx, -w / 2, -h, w, h, 22)
  ctx.clip()
  if (image) cover(ctx, image, -w / 2, -h, w, h)
  else {
    const fill = ctx.createLinearGradient(0, -h, 0, 0)
    fill.addColorStop(0, '#2a2a2a')
    fill.addColorStop(1, '#151515')
    ctx.fillStyle = fill
    ctx.fillRect(-w / 2, -h, w, h)
  }
  ctx.restore()
  // The hairline every poster on the site has.
  ctx.save()
  roundRect(ctx, -w / 2 + 1, -h + 1, w - 2, h - 2, 21)
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()
}

/**
 * The fan for 1 to 5 posters, symmetric, the best one in the middle and on top (or the two best
 * in the middle for an even count), the rest under it tilted outwards. Kept inside the picture.
 */
const FANS: { dx: number; angle: number; scale: number; z: number }[][] = [
  [{ dx: 0, angle: 0, scale: 1, z: 3 }],
  [
    { dx: -150, angle: -6, scale: 0.92, z: 3 },
    { dx: 150, angle: 6, scale: 0.92, z: 2 },
  ],
  [
    { dx: 0, angle: 0, scale: 1, z: 3 },
    { dx: -270, angle: -10, scale: 0.84, z: 2 },
    { dx: 270, angle: 10, scale: 0.84, z: 2 },
  ],
  [
    { dx: -140, angle: -5, scale: 0.92, z: 4 },
    { dx: 140, angle: 5, scale: 0.92, z: 3 },
    { dx: -350, angle: -14, scale: 0.74, z: 2 },
    { dx: 350, angle: 14, scale: 0.74, z: 1 },
  ],
  [
    { dx: 0, angle: 0, scale: 1, z: 5 },
    { dx: -235, angle: -9, scale: 0.84, z: 4 },
    { dx: 235, angle: 9, scale: 0.84, z: 4 },
    { dx: -405, angle: -17, scale: 0.68, z: 3 },
    { dx: 405, angle: 17, scale: 0.68, z: 3 },
  ],
]

export async function renderShareCard(data: ShareCardData): Promise<Blob> {
  await Promise.all([
    document.fonts?.load(`700 100px ${FONT}`),
    document.fonts?.load(`500 40px ${FONT}`),
  ]).catch(() => undefined)
  const images = await Promise.all(data.posters.slice(0, 5).map(loadImage))

  const canvas = document.createElement('canvas')
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')

  // Ground: near-black, washed with the posters' own colours (blurred), fading to black.
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
  const washes = images.filter((image): image is HTMLImageElement => Boolean(image))
  if (washes.length) {
    ctx.save()
    ctx.filter = 'blur(70px) saturate(1.5)'
    ctx.globalAlpha = 0.6
    const cell = CARD_WIDTH / Math.min(washes.length, 3)
    washes
      .slice(0, 3)
      .forEach((image, index) => cover(ctx, image, index * cell - 60, -80, cell + 120, 1300))
    ctx.restore()
  }
  const fade = ctx.createLinearGradient(0, 300, 0, 1250)
  fade.addColorStop(0, 'rgba(10,10,10,0.15)')
  fade.addColorStop(1, 'rgba(10,10,10,1)')
  ctx.fillStyle = fade
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  // The fan of posters.
  const baseW = 380
  const baseH = 570
  const slots = FANS[Math.max(Math.min(images.length, 5), 1) - 1]
    .map((slot, index) => ({ ...slot, image: images[index] ?? null }))
    .sort((a, b) => a.z - b.z)
  for (const slot of slots) {
    ctx.save()
    ctx.translate(CARD_WIDTH / 2 + slot.dx, 860 + Math.abs(slot.angle) * 2.2)
    ctx.rotate((slot.angle * Math.PI) / 180)
    poster(ctx, slot.image, baseW * slot.scale, baseH * slot.scale)
    ctx.restore()
  }

  const left = 84
  const width = CARD_WIDTH - left * 2
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#ffffff'

  if (data.first) {
    ctx.textAlign = 'center'
    font(ctx, 500, 30)
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.fillText(fit(ctx, data.first.label, width), CARD_WIDTH / 2, 945)
    font(ctx, 600, 40, -0.5)
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.fillText(fit(ctx, data.first.name, width), CARD_WIDTH / 2, 998)
    ctx.textAlign = 'left'
  }

  font(ctx, 600, 34, 0.5)
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.fillText(fit(ctx, data.kicker, width), left, 1110)

  font(ctx, 700, 250, -9)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(String(data.year), left - 8, 1320)

  font(ctx, 650, 66, -1.5)
  ctx.fillText(fit(ctx, data.headline, width), left, 1415)

  // Facts: two columns of label and value, separated by hairlines.
  const facts = data.facts.slice(0, 4)
  const columnW = width / 2
  facts.forEach((fact, index) => {
    const x = left + (index % 2) * columnW
    const y = 1500 + Math.floor(index / 2) * 150
    ctx.fillStyle = 'rgba(255,255,255,0.14)'
    ctx.fillRect(x, y, columnW - 32, 2)
    font(ctx, 500, 30)
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.fillText(fit(ctx, fact.label, columnW - 40), x, y + 50)
    font(ctx, 650, 50, -1)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(fit(ctx, fact.value, columnW - 40), x, y + 112)
  })

  const bottom = CARD_HEIGHT - 84
  if (data.kinds) {
    font(ctx, 500, 32)
    ctx.fillStyle = 'rgba(255,255,255,0.72)'
    ctx.fillText(fit(ctx, data.kinds, width - 260), left, bottom)
  }
  font(ctx, 650, 32, -0.5)
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.fillText(data.footer, CARD_WIDTH - left, bottom)
  ctx.textAlign = 'left'

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob'))), 'image/png'),
  )
}
