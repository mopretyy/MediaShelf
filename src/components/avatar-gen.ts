/**
 * Generated avatars: an endless set of cartoon faces, each drawn from a seed (any lowercase
 * word). The same seed always gives the same face, so a profile only stores the seed.
 *
 * Two looks, picked by the seed:
 *  - "beam": an abstract blob with a tiny face, after Boring Avatars "Beam";
 *  - "thumbs": a rounded figure with expressive eyes and mouths, after DiceBear "Thumbs"
 *    (CC0 1.0; the eye and mouth paths below are taken from it).
 * Some faces wear something, drawn as a sticker with a white edge: a hat, glasses, a tie,
 * a duck on the head, cat ears, a propeller cap and so on.
 *
 * Plain data and string building with no imports, so the UI, the lab and the tests share it.
 *
 * The "beam" geometry is adapted from Boring Avatars:
 *   MIT License, Copyright (c) 2021 boringdesigners
 *   Permission is hereby granted, free of charge, to any person obtaining a copy of this
 *   software and associated documentation files (the "Software"), to deal in the Software
 *   without restriction, including without limitation the rights to use, copy, modify, merge,
 *   publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons
 *   to whom the Software is furnished to do so, subject to the following conditions:
 *   The above copyright notice and this permission notice shall be included in all copies or
 *   substantial portions of the Software.
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 *   INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
 *   PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
 *   FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 *   OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 *   DEALINGS IN THE SOFTWARE.
 */

/* ---------- seeded randomness ---------- */

type Rng = () => number

/** FNV-1a, 32 bit. */
function hashString(value: string) {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** mulberry32: small, fast and good enough for picking shapes. */
function createRng(seed: string): Rng {
  let state = hashString(seed)
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const int = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1))
const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)]
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const n = (value: number) => Math.round(value * 100) / 100

/* ---------- colour ---------- */

const INK = '#16161d'
const WHITE = '#ffffff'
const GOLD = '#ffc83d'

/** Bright set for "beam", the original DiceBear set for "thumbs". */
const BEAM_COLORS = ['#ff6b5b', '#ffc24b', '#4ecdc4', '#5b8cff', '#a66bff'] as const
const THUMBS_COLORS = ['#0a5b83', '#1c799f', '#69d2e7', '#f1f4dc', '#f88c49'] as const

/** Black or white, whichever reads on `hex` (YIQ, the way both libraries do it). */
function contrast(hex: string, threshold: number) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return (r * 299 + g * 587 + b * 114) / 1000 >= threshold ? '#000000' : WHITE
}

function darken(hex: string, amount: number) {
  return `#${[1, 3, 5]
    .map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - amount)))
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`
}

/* ---------- accessories ---------- */

export const HEADWEAR = [
  'tophat',
  'cap',
  'beanie',
  'party',
  'crown',
  'duck',
  'sprout',
  'headphones',
  'headset',
  'propeller',
  'wizard',
  'catears',
  'horns',
  'halo',
] as const
export const EYEWEAR = ['glasses', 'shades', 'monocle', 'glasses3d', 'eyepatch'] as const
export const NECKWEAR = ['tie', 'bowtie'] as const
export type Headwear = (typeof HEADWEAR)[number]
export type Eyewear = (typeof EYEWEAR)[number]
export type Neckwear = (typeof NECKWEAR)[number]
export type Accessory = Headwear | Eyewear | Neckwear | 'mustache'

interface Outfit {
  head?: Headwear
  eyes?: Eyewear
  neck?: Neckwear
  mustache: boolean
  /** Pink cheeks: a mood rather than an accessory. */
  blush: boolean
}

/** A bit more than half the faces wear something, never more than two things at once. */
function pickOutfit(rng: Rng): Outfit {
  const outfit: Outfit = { mustache: false, blush: false }
  if (rng() < 0.32) outfit.head = pick(rng, HEADWEAR)
  if (rng() < 0.24)
    outfit.eyes =
      rng() < 0.1 ? 'monocle' : pick(rng, ['glasses', 'shades', 'glasses3d', 'eyepatch'] as const)
  if (rng() < 0.15) outfit.neck = pick(rng, NECKWEAR)
  outfit.mustache = rng() < 0.08
  outfit.blush = rng() < 0.3
  const count = () =>
    [outfit.head, outfit.eyes, outfit.neck].filter(Boolean).length + (outfit.mustache ? 1 : 0)
  if (count() > 2) outfit.mustache = false
  if (count() > 2) outfit.neck = undefined
  return outfit
}

/**
 * Where a face sits, in the coordinates of its own (already moved and rotated) group.
 * `k` turns the design units below (a 100 px avatar) into those coordinates.
 */
interface Face {
  cx: number
  eyeY: number
  /** Distance from the centre to each eye. */
  eyeDx: number
  eyeW: number
  eyeH: number
  mouthTop: number
  mouthBottom: number
  k: number
  /** Colour of the eyes and mouth. */
  ink: string
  accent: string
}

/**
 * One piece of an accessory. Geometry and paint are kept apart, so the same piece can be drawn
 * again as the white edge and the shadow of a sticker.
 */
interface Shape {
  el: 'rect' | 'circle' | 'ellipse' | 'path'
  geo: string
  fill?: string
  /** Fill opacity, for glass. */
  opacity?: number
  stroke?: string
  width?: number
  /** A detail inside the silhouette (a stripe, a glint): it gets no edge of its own. */
  inner?: boolean
}

function shape(
  el: Shape['el'],
  geo: Record<string, number | string>,
  paint: Omit<Shape, 'el' | 'geo'>,
): Shape {
  const attributes = Object.entries(geo)
    .map(([name, value]) => `${name}="${typeof value === 'number' ? n(value) : value}"`)
    .join(' ')
  return { el, geo: attributes, ...paint }
}

function element(piece: Shape, fill?: string, stroke?: string, width = 0, opacity = 1) {
  let out = `<${piece.el} ${piece.geo} fill="${fill ?? 'none'}"`
  if (fill && opacity < 1) out += ` fill-opacity="${opacity}"`
  if (stroke && width > 0)
    out += ` stroke="${stroke}" stroke-width="${n(width)}" stroke-linecap="round" stroke-linejoin="round"`
  return `${out}/>`
}

/**
 * Accessories are drawn as stickers: a soft shadow, a white edge around the silhouette, then the
 * piece itself. They stay as small as they were, but read on every colour.
 */
function sticker(pieces: Shape[], k: number) {
  const edge = 2.4 * k
  const outline = (color: string) =>
    pieces
      .filter((piece) => !piece.inner)
      .map((piece) => {
        const solid = piece.fill !== undefined && (piece.opacity ?? 1) === 1
        const width = (piece.stroke ? (piece.width ?? 0) : 0) + edge
        return element(piece, solid ? color : undefined, color, width)
      })
      .join('')
  return (
    `<g transform="translate(${n(0.5 * k)} ${n(1 * k)})" opacity="0.28">${outline(INK)}</g>` +
    outline(WHITE) +
    pieces
      .map((piece) => element(piece, piece.fill, piece.stroke, piece.width, piece.opacity))
      .join('')
  )
}

/** Design units around a point of the face: horizontal and vertical offsets, and sizes. */
function grid(f: Face, y: number) {
  return {
    x: (dx: number) => n(f.cx + dx * f.k),
    at: (dy: number) => n(y + dy * f.k),
    s: (value: number) => n(value * f.k),
  }
}

/** A five-pointed star as path data. */
function star(cx: number, cy: number, r: number) {
  const points = Array.from({ length: 10 }, (_, index) => {
    const angle = (Math.PI / 5) * index - Math.PI / 2
    const radius = index % 2 ? r * 0.45 : r
    return `${n(cx + Math.cos(angle) * radius)} ${n(cy + Math.sin(angle) * radius)}`
  })
  return `M${points.join('L')}Z`
}

const PINK = '#ff9ab0'

function headwear(kind: Headwear, f: Face): Shape[] {
  const { cx, k, accent } = f
  const dark = darken(accent, 0.25)
  const { x, at, s } = grid(f, f.eyeY - f.eyeH / 2 - 5.5 * k)
  switch (kind) {
    case 'tophat':
      return [
        shape(
          'rect',
          { x: x(-11), y: at(-24), width: s(22), height: s(21.5), rx: s(2) },
          { fill: INK },
        ),
        shape('rect', { x: x(-11), y: at(-8.5), width: s(22), height: s(4) }, { fill: accent }),
        shape(
          'rect',
          { x: x(-17), y: at(-3.5), width: s(34), height: s(3.5), rx: s(1.75) },
          { fill: INK },
        ),
        shape(
          'rect',
          { x: x(-8), y: at(-21.5), width: s(2.2), height: s(10), rx: s(1.1) },
          { fill: WHITE, opacity: 0.25, inner: true },
        ),
      ]
    case 'cap':
      return [
        shape(
          'path',
          { d: `M${x(-16)} ${at(0)}A${s(16)} ${s(14)} 0 0 1 ${x(16)} ${at(0)}Z` },
          { fill: accent },
        ),
        shape(
          'path',
          { d: `M${x(0)} ${at(-13)}V${at(-0.5)}` },
          { stroke: dark, width: s(1.1), inner: true },
        ),
        shape(
          'path',
          {
            d: `M${x(4)} ${at(-1)}Q${x(22)} ${at(-2.5)} ${x(23)} ${at(1.5)}Q${x(14)} ${at(3.5)} ${x(2)} ${at(1.5)}Z`,
          },
          { fill: dark },
        ),
        shape('circle', { cx: x(0), cy: at(-14), r: s(1.8) }, { fill: dark }),
      ]
    case 'beanie':
      return [
        shape(
          'path',
          { d: `M${x(-17)} ${at(-2)}A${s(17)} ${s(16)} 0 0 1 ${x(17)} ${at(-2)}Z` },
          { fill: accent },
        ),
        ...[-7, 0, 7].map((dx) =>
          shape(
            'path',
            { d: `M${x(dx)} ${at(-5)}Q${x(dx * 1.1)} ${at(-11)} ${x(dx * 0.6)} ${at(-15.5)}` },
            { stroke: dark, width: s(1.1), inner: true },
          ),
        ),
        shape(
          'rect',
          { x: x(-18.5), y: at(-6), width: s(37), height: s(7), rx: s(3.5) },
          { fill: dark },
        ),
        shape('circle', { cx: x(0), cy: at(-19), r: s(4.5) }, { fill: WHITE }),
      ]
    case 'party':
      return [
        shape(
          'path',
          { d: `M${x(-12)} ${at(0)}L${x(12)} ${at(0)}L${x(1)} ${at(-24)}Z` },
          { fill: accent, stroke: accent, width: s(1.5) },
        ),
        ...(
          [
            [-4, -5],
            [4, -10],
            [-0.5, -16],
          ] as const
        ).map(([dx, dy]) =>
          shape('circle', { cx: x(dx), cy: at(dy), r: s(1.6) }, { fill: WHITE, inner: true }),
        ),
        shape('circle', { cx: x(1), cy: at(-24), r: s(3.2) }, { fill: GOLD }),
      ]
    case 'crown':
      return [
        shape(
          'path',
          {
            d: `M${x(-14)} ${at(0)}L${x(-15)} ${at(-13)}L${x(-7.5)} ${at(-6)}L${x(0)} ${at(-16)}L${x(7.5)} ${at(-6)}L${x(15)} ${at(-13)}L${x(14)} ${at(0)}Z`,
          },
          { fill: GOLD, stroke: GOLD, width: s(1.5) },
        ),
        ...[-15, 0, 15].map((dx) =>
          shape('circle', { cx: x(dx), cy: at(dx ? -13 : -16), r: s(1.7) }, { fill: GOLD }),
        ),
        shape('circle', { cx: x(0), cy: at(-4), r: s(2) }, { fill: '#ff5b6b', inner: true }),
        shape('circle', { cx: x(-8), cy: at(-3.2), r: s(1.3) }, { fill: '#3ba9ff', inner: true }),
        shape('circle', { cx: x(8), cy: at(-3.2), r: s(1.3) }, { fill: '#3ecf8e', inner: true }),
      ]
    case 'duck':
      return [
        shape(
          'path',
          { d: `M${x(11)} ${at(-9)}L${x(16)} ${at(-15)}L${x(13.5)} ${at(-6)}Z` },
          { fill: '#ffd23f' },
        ),
        shape('ellipse', { cx: x(2), cy: at(-6.5), rx: s(11.5), ry: s(7) }, { fill: '#ffd23f' }),
        shape(
          'path',
          {
            d: `M${x(-1)} ${at(-7)}Q${x(5)} ${at(-12)} ${x(9)} ${at(-7.5)}Q${x(4)} ${at(-3.5)} ${x(-1)} ${at(-7)}Z`,
          },
          { fill: '#f4b400', inner: true },
        ),
        shape('circle', { cx: x(-5), cy: at(-16), r: s(6.5) }, { fill: '#ffd23f' }),
        shape(
          'path',
          {
            d: `M${x(-10.5)} ${at(-17.5)}Q${x(-16.5)} ${at(-16.5)} ${x(-15.5)} ${at(-14)}Q${x(-13)} ${at(-12.5)} ${x(-9.5)} ${at(-14)}Z`,
          },
          { fill: '#ff8a3d' },
        ),
        shape('circle', { cx: x(-2.6), cy: at(-14.2), r: s(1.4) }, { fill: PINK, inner: true }),
        shape('circle', { cx: x(-6), cy: at(-17.5), r: s(1.4) }, { fill: INK, inner: true }),
        shape('circle', { cx: x(-5.5), cy: at(-18), r: s(0.5) }, { fill: WHITE, inner: true }),
      ]
    case 'sprout':
      return [
        shape(
          'path',
          { d: `M${x(0)} ${at(0)}Q${x(1)} ${at(-7)} ${x(0)} ${at(-12)}` },
          { stroke: '#2fa866', width: s(2.4) },
        ),
        shape(
          'path',
          {
            d: `M${x(0)} ${at(-11)}Q${x(-10)} ${at(-20)} ${x(-13)} ${at(-12)}Q${x(-6)} ${at(-8)} ${x(0)} ${at(-11)}Z`,
          },
          { fill: '#3ecf8e' },
        ),
        shape(
          'path',
          {
            d: `M${x(0)} ${at(-12)}Q${x(8)} ${at(-23)} ${x(12.5)} ${at(-16)}Q${x(6)} ${at(-10)} ${x(0)} ${at(-12)}Z`,
          },
          { fill: '#34b87a' },
        ),
        shape(
          'path',
          { d: `M${x(-1.5)} ${at(-11.2)}Q${x(-6)} ${at(-13)} ${x(-10)} ${at(-12.6)}` },
          { stroke: '#238a55', width: s(0.8), inner: true },
        ),
        shape(
          'path',
          { d: `M${x(1.5)} ${at(-12.3)}Q${x(6)} ${at(-15)} ${x(10)} ${at(-15.8)}` },
          { stroke: '#238a55', width: s(0.8), inner: true },
        ),
      ]
    case 'headphones':
    case 'headset': {
      const ear = f.eyeDx + 10 * k
      const top = n(f.eyeY - 1 * k)
      const cups = [-1, 1].flatMap((side) => [
        shape(
          'rect',
          { x: cx + side * ear - 4 * k, y: f.eyeY - 5 * k, width: s(8), height: s(13), rx: s(4) },
          { fill: accent },
        ),
        shape(
          'rect',
          {
            x: cx + side * ear - 1.6 * k,
            y: f.eyeY - 2.6 * k,
            width: s(3.2),
            height: s(8.2),
            rx: s(1.6),
          },
          { fill: dark, inner: true },
        ),
      ])
      const band = shape(
        'path',
        { d: `M${n(cx - ear)} ${top}A${n(ear)} ${n(ear * 0.95)} 0 0 1 ${n(cx + ear)} ${top}` },
        { stroke: INK, width: s(3) },
      )
      if (kind === 'headphones') return [band, ...cups]
      // A gaming headset: the same cups, plus a microphone on a boom.
      const fromX = cx - ear + 1 * k
      const fromY = f.eyeY + 7 * k
      const toX = cx - Math.max(f.eyeDx * 0.5, 4.5 * k)
      const toY = (f.mouthTop + f.mouthBottom) / 2 + 1 * k
      return [
        band,
        shape(
          'path',
          {
            d: `M${n(fromX)} ${n(fromY)}Q${n(fromX + 1 * k)} ${n(toY + 2 * k)} ${n(toX)} ${n(toY)}`,
          },
          { stroke: INK, width: s(1.6) },
        ),
        ...cups,
        shape(
          'rect',
          { x: toX - 2 * k, y: toY - 1.6 * k, width: s(4), height: s(3.2), rx: s(1.6) },
          { fill: INK },
        ),
      ]
    }
    case 'propeller': {
      const rx = 15
      const ry = 13
      const point = (degrees: number) => {
        const angle = (degrees * Math.PI) / 180
        return `${x(Math.cos(angle) * rx)} ${at(-1 - Math.sin(angle) * ry)}`
      }
      const wedge = (from: number, to: number) =>
        shape(
          'path',
          { d: `M${x(0)} ${at(-1)}L${point(from)}A${s(rx)} ${s(ry)} 0 0 0 ${point(to)}Z` },
          { fill: GOLD, inner: true },
        )
      return [
        shape(
          'path',
          { d: `M${x(-rx)} ${at(-1)}A${s(rx)} ${s(ry)} 0 0 1 ${x(rx)} ${at(-1)}Z` },
          { fill: accent },
        ),
        wedge(36, 72),
        wedge(108, 144),
        shape(
          'rect',
          { x: x(-16), y: at(-3.2), width: s(32), height: s(3.4), rx: s(1.7) },
          { fill: dark },
        ),
        shape(
          'rect',
          { x: x(-0.9), y: at(-18), width: s(1.8), height: s(5), rx: s(0.9) },
          { fill: INK },
        ),
        shape(
          'ellipse',
          { cx: x(-5.5), cy: at(-18.5), rx: s(5.5), ry: s(1.8) },
          { fill: '#ff5b6b' },
        ),
        shape(
          'ellipse',
          { cx: x(5.5), cy: at(-18.5), rx: s(5.5), ry: s(1.8) },
          { fill: '#3ba9ff' },
        ),
        shape('circle', { cx: x(0), cy: at(-18.5), r: s(1.6) }, { fill: GOLD }),
      ]
    }
    case 'wizard':
      return [
        shape(
          'path',
          {
            d: `M${x(-11)} ${at(-1)}C${x(-6)} ${at(-9)} ${x(-1)} ${at(-19)} ${x(5)} ${at(-25)}C${x(5)} ${at(-17)} ${x(7)} ${at(-9)} ${x(11)} ${at(-1)}Z`,
          },
          { fill: '#4255d4', stroke: '#4255d4', width: s(1) },
        ),
        shape('ellipse', { cx: x(0), cy: at(-1), rx: s(17), ry: s(3.2) }, { fill: '#2f3fae' }),
        shape('path', { d: star(x(-2), at(-8.5), s(2.8)) }, { fill: GOLD, inner: true }),
        shape('path', { d: star(x(3), at(-16.5), s(1.9)) }, { fill: GOLD, inner: true }),
      ]
    case 'catears':
      return [
        shape(
          'path',
          { d: `M${x(-15)} ${at(2)}Q${x(0)} ${at(-10)} ${x(15)} ${at(2)}` },
          { stroke: INK, width: s(2.2) },
        ),
        ...[-1, 1].flatMap((side) => [
          shape(
            'path',
            {
              d: `M${x(side * 14)} ${at(1.2)}L${x(side * 12.5)} ${at(-14)}L${x(side * 5)} ${at(-3.3)}Z`,
            },
            { fill: accent, stroke: accent, width: s(1.4) },
          ),
          shape(
            'path',
            {
              d: `M${x(side * 12.6)} ${at(-0.6)}L${x(side * 11.9)} ${at(-9.8)}L${x(side * 7.4)} ${at(-3)}Z`,
            },
            { fill: PINK, inner: true },
          ),
        ]),
      ]
    case 'horns':
      return [-1, 1].flatMap((side) => [
        shape(
          'path',
          {
            d: `M${x(side * 12.5)} ${at(1)}Q${x(side * 16.5)} ${at(-7)} ${x(side * 12)} ${at(-13.5)}Q${x(side * 10.5)} ${at(-6.5)} ${x(side * 5.5)} ${at(-1.5)}Z`,
          },
          { fill: '#ff4d5e', stroke: '#ff4d5e', width: s(1) },
        ),
        shape(
          'path',
          {
            d: `M${x(side * 12.6)} ${at(-1.5)}Q${x(side * 13.8)} ${at(-6)} ${x(side * 12.5)} ${at(-10)}`,
          },
          { stroke: '#ff9aa4', width: s(1), inner: true },
        ),
      ])
    case 'halo':
      return [
        shape(
          'ellipse',
          { cx: x(0), cy: at(-10), rx: s(11), ry: s(3.4) },
          { stroke: GOLD, width: s(2.4) },
        ),
      ]
  }
}

function eyewear(kind: Eyewear, f: Face): Shape[] {
  const { cx, k } = f
  const s = (value: number) => n(value * k)
  const y = f.eyeY
  const eyes = [cx - f.eyeDx, cx + f.eyeDx] as const
  // Big enough to frame the eye, small enough to leave a bridge between the lenses.
  const r = Math.min(Math.max(Math.max(f.eyeW, f.eyeH) / 2 + 2.6 * k, 5.5 * k), f.eyeDx - 1 * k)
  const glint = (ex: number, radius: number) =>
    shape(
      'path',
      {
        d: `M${n(ex - radius * 0.62)} ${n(y - radius * 0.12)}A${n(radius * 0.62)} ${n(radius * 0.62)} 0 0 1 ${n(ex - radius * 0.12)} ${n(y - radius * 0.62)}`,
      },
      { stroke: WHITE, width: s(1.1), inner: true },
    )
  switch (kind) {
    case 'shades': {
      const w = Math.min(Math.max(f.eyeW + 5 * k, 12 * k), 2 * (f.eyeDx - 0.6 * k))
      const h = Math.max(f.eyeH + 3 * k, 8 * k)
      return [
        shape(
          'path',
          { d: `M${n(eyes[0])} ${n(y)}H${n(eyes[1])}` },
          { stroke: INK, width: s(1.6) },
        ),
        ...eyes.flatMap((ex) => [
          shape(
            'rect',
            { x: ex - w / 2, y: y - h / 2, width: w, height: h, rx: s(3.5) },
            { fill: INK },
          ),
          shape(
            'path',
            { d: `M${n(ex - w / 2 + 2.5 * k)} ${n(y - h / 2 + 2.2 * k)}h${s(3.5)}` },
            { stroke: '#dfe5f2', width: s(1.3), inner: true },
          ),
        ]),
      ]
    }
    case 'glasses3d': {
      const w = Math.min(Math.max(f.eyeW + 4 * k, 10 * k), 2 * (f.eyeDx - 0.9 * k))
      const h = Math.max(f.eyeH + 2.6 * k, 7.5 * k)
      const pad = 1.4 * k
      return [
        shape(
          'rect',
          {
            x: eyes[0] - w / 2 - pad,
            y: y - h / 2 - pad,
            width: eyes[1] - eyes[0] + w + pad * 2,
            height: h + pad * 2,
            rx: s(2.4),
          },
          { fill: WHITE },
        ),
        shape(
          'rect',
          { x: eyes[0] - w / 2, y: y - h / 2, width: w, height: h, rx: s(1.6) },
          { fill: '#ff3b5c', inner: true },
        ),
        shape(
          'rect',
          { x: eyes[1] - w / 2, y: y - h / 2, width: w, height: h, rx: s(1.6) },
          { fill: '#22c3f0', inner: true },
        ),
      ]
    }
    case 'eyepatch': {
      const rx = Math.max(f.eyeW / 2 + 2 * k, 4.6 * k)
      const ry = Math.max(f.eyeH / 2 + 1.8 * k, 4 * k)
      const ex = eyes[1]
      // The band hugs the forehead and stops before the edge of the face.
      return [
        shape(
          'path',
          {
            d: `M${n(ex - rx * 0.6)} ${n(y - ry * 0.75)}Q${n(cx - f.eyeDx * 0.2)} ${n(y - 6.5 * k)} ${n(eyes[0] - 3.5 * k)} ${n(y - 7.5 * k)}`,
          },
          { stroke: INK, width: s(1.3) },
        ),
        shape(
          'path',
          {
            d: `M${n(ex + rx * 0.85)} ${n(y - ry * 0.45)}L${n(ex + rx + 2.5 * k)} ${n(y - 2.2 * k)}`,
          },
          { stroke: INK, width: s(1.3) },
        ),
        shape('ellipse', { cx: ex, cy: y, rx, ry }, { fill: INK }),
        glint(ex, Math.min(rx, ry)),
      ]
    }
    case 'monocle': {
      const radius = r + 0.5 * k
      return [
        shape(
          'path',
          {
            d: `M${n(eyes[1] + radius * 0.7)} ${n(y + radius * 0.7)}q${s(4)} ${s(6)} ${s(1)} ${s(13)}`,
          },
          { stroke: GOLD, width: s(1.3) },
        ),
        shape(
          'circle',
          { cx: eyes[1], cy: y, r: radius },
          { fill: WHITE, opacity: 0.18, stroke: GOLD, width: s(2) },
        ),
        glint(eyes[1], radius),
      ]
    }
    case 'glasses':
      return [
        ...eyes.map((ex) =>
          shape(
            'circle',
            { cx: ex, cy: y, r },
            { fill: WHITE, opacity: 0.16, stroke: INK, width: s(2) },
          ),
        ),
        shape(
          'path',
          { d: `M${n(eyes[0] + r)} ${n(y - 0.5 * k)}H${n(eyes[1] - r)}` },
          { stroke: INK, width: s(2) },
        ),
        ...eyes.map((ex) => glint(ex, r)),
      ]
  }
}

function neckwear(kind: Neckwear, f: Face): Shape[] {
  const { k, accent } = f
  const dark = darken(accent, 0.25)
  const { x, at, s } = grid(f, f.mouthBottom + 3 * k)
  if (kind === 'tie') {
    // Half the width of the blade at a given height, a hair inside its edge.
    const half = (dy: number) => 2.3 + ((dy - 5) * 2.5) / 14.5
    const stripe = (dy: number) =>
      shape(
        'path',
        {
          d: `M${x(-half(dy + 0.2))} ${at(dy + 0.2)}L${x(half(dy - 1.4))} ${at(dy - 1.4)}L${x(half(dy + 0.2))} ${at(dy + 0.2)}L${x(-half(dy + 1.8))} ${at(dy + 1.8)}Z`,
        },
        { fill: dark, inner: true },
      )
    return [
      shape(
        'path',
        {
          d: `M${x(-2.5)} ${at(5)}L${x(2.5)} ${at(5)}L${x(5)} ${at(19.5)}L${x(0)} ${at(24)}L${x(-5)} ${at(19.5)}Z`,
        },
        { fill: accent },
      ),
      stripe(9),
      stripe(14),
      shape(
        'path',
        { d: `M${x(-3.5)} ${at(0)}L${x(3.5)} ${at(0)}L${x(2.5)} ${at(5)}L${x(-2.5)} ${at(5)}Z` },
        { fill: dark },
      ),
    ]
  }
  return [
    ...[-1, 1].map((side) =>
      shape(
        'path',
        { d: `M${x(side * 2)} ${at(3.5)}L${x(side * 12)} ${at(-2)}L${x(side * 12)} ${at(9)}Z` },
        { fill: accent, stroke: accent, width: s(2) },
      ),
    ),
    ...(
      [
        [8, 2.5],
        [10.2, 5.8],
      ] as const
    ).flatMap(([dx, dy]) =>
      [-1, 1].map((side) =>
        shape(
          'circle',
          { cx: x(side * dx), cy: at(dy), r: s(1) },
          { fill: WHITE, opacity: 0.85, inner: true },
        ),
      ),
    ),
    shape('rect', { x: x(-3), y: at(0), width: s(6), height: s(7), rx: s(2) }, { fill: dark }),
  ]
}

/** A curled handlebar, the same width as a plain one. */
function mustache(f: Face): Shape[] {
  // Halfway between the eyes and the mouth, nudged towards the mouth.
  const { x, at } = grid(f, (f.eyeY + f.eyeH / 2 + f.mouthTop) / 2 + 0.5 * f.k)
  const curve = [
    [0, -0.8],
    [2, -2.7, 6, -2.5, 8, -0.4],
    [9, 0.7, 9.9, 0.2, 10.1, -1.1],
    [10.3, 0.9, 9.3, 2.2, 7.7, 1.8],
    [5.2, 1.5, 2, 1.1, 0, 0.8],
  ] as const
  const half = (side: number) =>
    curve
      .map((points, index) => {
        const pairs: string[] = []
        for (let i = 0; i < points.length; i += 2)
          pairs.push(`${x(side * points[i])} ${at(points[i + 1])}`)
        return (index ? 'C' : 'M') + pairs.join(' ')
      })
      .join('') + 'Z'
  return [shape('path', { d: half(-1) + half(1) }, { fill: INK })]
}

function blush(f: Face) {
  return [-1, 1]
    .map(
      (side) =>
        `<ellipse cx="${n(f.cx + side * (f.eyeDx + 1.2 * f.k))}" cy="${n(f.eyeY + f.eyeH / 2 + 2.6 * f.k)}" rx="${n(3.2 * f.k)}" ry="${n(1.8 * f.k)}" fill="#ff6f91" fill-opacity="0.5"/>`,
    )
    .join('')
}

function dress(outfit: Outfit, face: Face) {
  const wear = (pieces: Shape[]) => sticker(pieces, face.k)
  return [
    outfit.blush ? blush(face) : '',
    outfit.neck ? wear(neckwear(outfit.neck, face)) : '',
    outfit.mustache ? wear(mustache(face)) : '',
    outfit.eyes ? wear(eyewear(outfit.eyes, face)) : '',
    outfit.head ? wear(headwear(outfit.head, face)) : '',
  ].join('')
}

/* ---------- "beam" ---------- */

/** Adapted from Boring Avatars "Beam", on its 36-unit grid. */
/** Gold and yellow things vanish on the yellow of the beam set. */
const YELLOW_HATS: readonly (Headwear | undefined)[] = ['crown', 'duck', 'halo']

function beam(rng: Rng, outfit: Outfit) {
  const palette = YELLOW_HATS.includes(outfit.head)
    ? BEAM_COLORS.filter((color) => color !== '#ffc24b')
    : BEAM_COLORS
  const body = pick(rng, palette)
  const others = palette.filter((color) => color !== body)
  const background = pick(rng, others)
  const accentPool = others.filter((color) => color !== background)
  const pre = (value: number) => (value < 5 ? value + 4 : value)
  const tx = pre(int(rng, -9, 9))
  const ty = pre(int(rng, -9, 9))
  const rotate = int(rng, 0, 359)
  const scale = 1 + int(rng, 0, 2) / 10
  const circle = rng() < 0.5
  const open = rng() < 0.5
  const eyeSpread = int(rng, 0, 4)
  const mouthSpread = int(rng, 0, 2)
  const faceRotate = int(rng, -9, 9)
  let fx = tx > 6 ? tx / 2 : int(rng, -7, 7)
  let fy = ty > 6 ? ty / 2 : int(rng, -6, 6)
  // A hat needs the face lower down, a tie needs it higher up; a hat wins.
  if (outfit.head) {
    outfit.neck = undefined
    fx = clamp(fx, -3, 3)
    fy = int(rng, 5, 8)
  } else if (outfit.neck) fy = clamp(fy, -6, -1)
  const ink = contrast(body, 128)
  const mouthY = 19 + mouthSpread
  const face: Face = {
    cx: 17.75,
    eyeY: 15,
    eyeDx: 3 + eyeSpread,
    eyeW: 1.5,
    eyeH: 2,
    mouthTop: mouthY,
    mouthBottom: mouthY + (open ? 1.25 : 3.75),
    // The beam face is small, so its accessories are drawn larger than the face itself.
    k: 0.56,
    ink,
    accent: pick(rng, accentPool),
  }
  const mouth = open
    ? `<path d="M15 ${mouthY}c2 1 4 1 6 0" stroke="${ink}" stroke-linecap="round"/>`
    : `<path d="M13 ${mouthY}a1 .75 0 0 0 10 0" fill="${ink}"/>`
  return (
    `<g transform="scale(${n(100 / 36)})">` +
    `<rect width="36" height="36" fill="${background}"/>` +
    `<rect width="36" height="36" rx="${circle ? 36 : 6}" transform="translate(${tx} ${ty}) rotate(${rotate} 18 18) scale(${scale})" fill="${body}"/>` +
    `<g transform="translate(${n(fx)} ${n(fy)}) rotate(${faceRotate} 18 18)">` +
    mouth +
    `<rect x="${14 - eyeSpread}" y="14" width="1.5" height="2" rx="1" fill="${ink}"/>` +
    `<rect x="${20 + eyeSpread}" y="14" width="1.5" height="2" rx="1" fill="${ink}"/>` +
    dress(outfit, face) +
    `</g></g>`
  )
}

/* ---------- "thumbs" ---------- */

/** DiceBear Thumbs eyes (CC0): path, distance of each eye from the centre, eye width, height. */
const THUMBS_EYES: readonly [string, number, number, number][] = [
  [
    'M.25 8.12C1.66 11.86 12 16 12 16s5.17-9.58 3.76-13.32c0 0-1.41-3.74-5.3-2.38-3.87 1.36-2.7 4.48-2.7 4.48S6.6 1.66 2.73 3.02C-1.16 4.38.25 8.12.25 8.12ZM26.24 2.68C24.84 6.42 30 16 30 16s10.34-4.14 11.75-7.88c0 0 1.41-3.74-2.47-5.1-3.87-1.36-5.05 1.76-5.05 1.76s1.18-3.12-2.7-4.48c-3.88-1.36-5.29 2.38-5.29 2.38Z',
    13.0,
    16,
    16,
  ],
  [
    'M-.75 8.12C.66 11.86 11 16 11 16s5.17-9.58 3.76-13.32c0 0-1.41-3.74-5.3-2.38-3.87 1.36-2.7 4.48-2.7 4.48S5.6 1.66 1.73 3.02c-3.88 1.36-2.47 5.1-2.47 5.1ZM27.24 2.68C25.84 6.42 31 16 31 16s10.34-4.14 11.75-7.88c0 0 1.41-3.74-2.47-5.1-3.87-1.36-5.05 1.76-5.05 1.76s1.18-3.12-2.7-4.48c-3.88-1.36-5.29 2.38-5.29 2.38Z',
    14.0,
    16,
    16,
  ],
  [
    'M-1.75 8.12C-.34 11.86 10 16 10 16s5.17-9.58 3.76-13.32c0 0-1.41-3.74-5.3-2.38-3.87 1.36-2.7 4.48-2.7 4.48S4.6 1.66.73 3.02c-3.88 1.36-2.47 5.1-2.47 5.1ZM28.24 2.68C26.84 6.42 32 16 32 16s10.34-4.14 11.75-7.88c0 0 1.41-3.74-2.47-5.1-3.87-1.36-5.05 1.76-5.05 1.76s1.18-3.12-2.7-4.48c-3.88-1.36-5.29 2.38-5.29 2.38Z',
    15.0,
    16,
    16,
  ],
  [
    'M-2.75 8.12C-1.34 11.86 9 16 9 16s5.17-9.58 3.76-13.32c0 0-1.41-3.74-5.3-2.38-3.87 1.36-2.7 4.48-2.7 4.48S3.6 1.66-.27 3.02c-3.88 1.36-2.47 5.1-2.47 5.1ZM29.24 2.68C27.84 6.42 33 16 33 16s10.34-4.14 11.75-7.88c0 0 1.41-3.74-2.47-5.1-3.87-1.36-5.05 1.76-5.05 1.76s1.18-3.12-2.7-4.48c-3.88-1.36-5.29 2.38-5.29 2.38Z',
    16.0,
    16,
    16,
  ],
  [
    'M9.5 10c-3.88 0-7.11-4.23-6.4-4.85.71-.62 2.63 1.3 6.4 1.3 3.77 0 5.69-2 6.4-1.3S13.38 10 9.5 10ZM32.5 10c-3.88 0-7.11-4.23-6.4-4.85.71-.62 2.63 1.3 6.4 1.3 3.77 0 5.69-2 6.4-1.3S36.38 10 32.5 10Z',
    11.5,
    13,
    5,
  ],
  [
    'M8.5 10c-3.88 0-7.11-4.23-6.4-4.85.71-.62 2.63 1.3 6.4 1.3 3.77 0 5.69-2 6.4-1.3S12.38 10 8.5 10ZM33.5 10c-3.88 0-7.11-4.23-6.4-4.85.71-.62 2.63 1.3 6.4 1.3 3.77 0 5.69-2 6.4-1.3S37.38 10 33.5 10Z',
    12.5,
    13,
    5,
  ],
  [
    'M7.5 10C3.62 10 .39 5.77 1.1 5.15c.71-.62 2.63 1.3 6.4 1.3 3.77 0 5.69-2 6.4-1.3S11.38 10 7.5 10ZM34.5 10c-3.88 0-7.11-4.23-6.4-4.85.71-.62 2.63 1.3 6.4 1.3 3.77 0 5.69-2 6.4-1.3S38.38 10 34.5 10Z',
    13.5,
    13,
    5,
  ],
  [
    'M6.5 10C2.62 10-.61 5.77.1 5.15c.71-.62 2.63 1.3 6.4 1.3 3.77 0 5.69-2 6.4-1.3S10.38 10 6.5 10ZM35.5 10c-3.88 0-7.11-4.23-6.4-4.85.71-.62 2.63 1.3 6.4 1.3 3.77 0 5.69-2 6.4-1.3S39.38 10 35.5 10Z',
    14.5,
    13,
    5,
  ],
  [
    'M11.86 7.5c0-1.42-4.14-2.85-4.82-4.98C6.34.4 16 5.37 16 7.5c0 2.13-9.65 7.11-8.96 4.98.68-2.13 4.82-3.56 4.82-4.98ZM30.14 7.5c0-1.42 4.14-2.85 4.82-4.98C35.66.4 26 5.37 26 7.5c0 2.13 9.65 7.11 8.96 4.98-.68-2.13-4.82-3.56-4.82-4.98Z',
    9.5,
    9,
    10.99,
  ],
  [
    'M10.86 7.5c0-1.42-4.14-2.85-4.82-4.98C5.34.4 15 5.37 15 7.5c0 2.13-9.65 7.11-8.96 4.98.68-2.13 4.82-3.56 4.82-4.98ZM31.14 7.5c0-1.42 4.14-2.85 4.82-4.98C36.66.4 27 5.37 27 7.5c0 2.13 9.65 7.11 8.96 4.98-.68-2.13-4.82-3.56-4.82-4.98Z',
    10.5,
    9,
    10.99,
  ],
  [
    'M9.86 7.5c0-1.42-4.14-2.85-4.82-4.98C4.34.4 14 5.37 14 7.5c0 2.13-9.65 7.11-8.96 4.98.68-2.13 4.82-3.56 4.82-4.98ZM32.14 7.5c0-1.42 4.14-2.85 4.82-4.98C37.66.4 28 5.37 28 7.5c0 2.13 9.65 7.11 8.96 4.98-.68-2.13-4.82-3.56-4.82-4.98Z',
    11.5,
    9,
    10.99,
  ],
  [
    'M8.86 7.5c0-1.42-4.14-2.85-4.82-4.98C3.34.4 13 5.37 13 7.5c0 2.13-9.65 7.11-8.96 4.98.68-2.13 4.82-3.56 4.82-4.98ZM33.14 7.5c0-1.42 4.14-2.85 4.82-4.98C38.66.4 29 5.37 29 7.5c0 2.13 9.65 7.11 8.96 4.98-.68-2.13-4.82-3.56-4.82-4.98Z',
    12.5,
    9,
    10.99,
  ],
  [
    'M8 8.36S8 4 12 4s4 4.36 4 4.36v2.91s0 .73-.67.73c-.66 0-.66-2.9-3.33-2.9S9.33 12 8.67 12C8 12 8 11.27 8 11.27v-2.9ZM26 8.36S26 4 30 4s4 4.36 4 4.36v2.91s0 .73-.67.73c-.66 0-.66-2.9-3.33-2.9S27.33 12 26.67 12c-.67 0-.67-.73-.67-.73v-2.9Z',
    9.0,
    8,
    8,
  ],
  [
    'M7 8.36S7 4 11 4s4 4.36 4 4.36v2.91s0 .73-.67.73c-.66 0-.66-2.9-3.33-2.9S8.33 12 7.67 12C7 12 7 11.27 7 11.27v-2.9ZM27 8.36S27 4 31 4s4 4.36 4 4.36v2.91s0 .73-.67.73c-.66 0-.66-2.9-3.33-2.9S28.33 12 27.67 12c-.67 0-.67-.73-.67-.73v-2.9Z',
    10.0,
    8,
    8,
  ],
  [
    'M6 8.36S6 4 10 4s4 4.36 4 4.36v2.91s0 .73-.67.73c-.66 0-.66-2.9-3.33-2.9S7.33 12 6.67 12C6 12 6 11.27 6 11.27v-2.9ZM28 8.36S28 4 32 4s4 4.36 4 4.36v2.91s0 .73-.67.73c-.66 0-.66-2.9-3.33-2.9S29.33 12 28.67 12c-.67 0-.67-.73-.67-.73v-2.9Z',
    11.0,
    8,
    8,
  ],
  [
    'M5 8.36S5 4 9 4s4 4.36 4 4.36v2.91s0 .73-.67.73c-.66 0-.66-2.9-3.33-2.9S6.33 12 5.67 12C5 12 5 11.27 5 11.27v-2.9ZM29 8.36S29 4 33 4s4 4.36 4 4.36v2.91s0 .73-.67.73c-.66 0-.66-2.9-3.33-2.9S30.33 12 29.67 12c-.67 0-.67-.73-.67-.73v-2.9Z',
    12.0,
    8,
    8,
  ],
  [
    'M16 8c0 2.2-1.34 4-3 4s-3-1.8-3-4 1.34-4 3-4 3 1.8 3 4ZM32 8c0 2.2-1.34 4-3 4s-3-1.8-3-4 1.34-4 3-4 3 1.8 3 4Z',
    8.0,
    6,
    8,
  ],
  [
    'M15 8c0 2.2-1.34 4-3 4s-3-1.8-3-4 1.34-4 3-4 3 1.8 3 4ZM33 8c0 2.2-1.34 4-3 4s-3-1.8-3-4 1.34-4 3-4 3 1.8 3 4Z',
    9.0,
    6,
    8,
  ],
  [
    'M14 8c0 2.2-1.34 4-3 4s-3-1.8-3-4 1.34-4 3-4 3 1.8 3 4ZM34 8c0 2.2-1.34 4-3 4s-3-1.8-3-4 1.34-4 3-4 3 1.8 3 4Z',
    10.0,
    6,
    8,
  ],
  [
    'M13 8c0 2.2-1.34 4-3 4s-3-1.8-3-4 1.34-4 3-4 3 1.8 3 4ZM35 8c0 2.2-1.34 4-3 4s-3-1.8-3-4 1.34-4 3-4 3 1.8 3 4Z',
    11.0,
    6,
    8,
  ],
  [
    'M16 8c0 3.31-1.34 6-3 6s-3-2.69-3-6 1.34-6 3-6 3 2.69 3 6ZM32 8c0 3.31-1.34 6-3 6s-3-2.69-3-6 1.34-6 3-6 3 2.69 3 6Z',
    8.0,
    6,
    12,
  ],
  [
    'M15 8c0 3.31-1.34 6-3 6s-3-2.69-3-6 1.34-6 3-6 3 2.69 3 6ZM33 8c0 3.31-1.34 6-3 6s-3-2.69-3-6 1.34-6 3-6 3 2.69 3 6Z',
    9.0,
    6,
    12,
  ],
  [
    'M14 8c0 3.31-1.34 6-3 6s-3-2.69-3-6 1.34-6 3-6 3 2.69 3 6ZM34 8c0 3.31-1.34 6-3 6s-3-2.69-3-6 1.34-6 3-6 3 2.69 3 6Z',
    10.0,
    6,
    12,
  ],
  [
    'M13 8c0 3.31-1.34 6-3 6s-3-2.69-3-6 1.34-6 3-6 3 2.69 3 6ZM35 8c0 3.31-1.34 6-3 6s-3-2.69-3-6 1.34-6 3-6 3 2.69 3 6Z',
    11.0,
    6,
    12,
  ],
  [
    'M11.5 6C8.29 6 7 7.36 7 8.04c0 3.4 1.29 1.35 4.5 1.35S16 11.43 16 8.04C16 7.36 14.71 6 11.5 6ZM30.5 6C27.29 6 26 7.36 26 8.04c0 3.4 1.29 1.35 4.5 1.35S35 11.43 35 8.04C35 7.36 33.71 6 30.5 6Z',
    9.5,
    9,
    4,
  ],
  [
    'M10.5 6C7.29 6 6 7.36 6 8.04c0 3.4 1.29 1.35 4.5 1.35S15 11.43 15 8.04C15 7.36 13.71 6 10.5 6ZM31.5 6C28.29 6 27 7.36 27 8.04c0 3.4 1.29 1.35 4.5 1.35S36 11.43 36 8.04C36 7.36 34.71 6 31.5 6Z',
    10.5,
    9,
    4,
  ],
  [
    'M9.5 6C6.29 6 5 7.36 5 8.04c0 3.4 1.29 1.35 4.5 1.35S14 11.43 14 8.04C14 7.36 12.71 6 9.5 6ZM32.5 6C29.29 6 28 7.36 28 8.04c0 3.4 1.29 1.35 4.5 1.35S37 11.43 37 8.04C37 7.36 35.71 6 32.5 6Z',
    11.5,
    9,
    4,
  ],
  [
    'M8.5 6C5.29 6 4 7.36 4 8.04c0 3.4 1.29 1.35 4.5 1.35S13 11.43 13 8.04C13 7.36 11.71 6 8.5 6ZM33.5 6C30.29 6 29 7.36 29 8.04c0 3.4 1.29 1.35 4.5 1.35S38 11.43 38 8.04C38 7.36 36.71 6 33.5 6Z',
    12.5,
    9,
    4,
  ],
  [
    'M16 8c0 1.66-1.12 3-2.5 3S11 9.66 11 8s1.12-3 2.5-3S16 6.34 16 8ZM31 8c0 1.66-1.12 3-2.5 3S26 9.66 26 8s1.12-3 2.5-3S31 6.34 31 8Z',
    7.5,
    5,
    6,
  ],
  [
    'M15 8c0 1.66-1.12 3-2.5 3S10 9.66 10 8s1.12-3 2.5-3S15 6.34 15 8ZM32 8c0 1.66-1.12 3-2.5 3S27 9.66 27 8s1.12-3 2.5-3S32 6.34 32 8Z',
    8.5,
    5,
    6,
  ],
  [
    'M14 8c0 1.66-1.12 3-2.5 3S9 9.66 9 8s1.12-3 2.5-3S14 6.34 14 8ZM33 8c0 1.66-1.12 3-2.5 3S28 9.66 28 8s1.12-3 2.5-3S33 6.34 33 8Z',
    9.5,
    5,
    6,
  ],
  [
    'M13 8c0 1.66-1.12 3-2.5 3S8 9.66 8 8s1.12-3 2.5-3S13 6.34 13 8ZM34 8c0 1.66-1.12 3-2.5 3S29 9.66 29 8s1.12-3 2.5-3S34 6.34 34 8Z',
    10.5,
    5,
    6,
  ],
  [
    'M14 8c0 2.2-1.34 4-3 4s-3-1.8-3-4 1.34-4 3-4 3 1.8 3 4ZM28.5 5C25.29 5 24 6.36 24 7.04c0 3.4 1.29 1.35 4.5 1.35S33 10.43 33 7.04C33 6.36 31.71 5 28.5 5Z',
    8.75,
    9,
    8,
  ],
  [
    'M13 8c0 2.2-1.34 4-3 4s-3-1.8-3-4 1.34-4 3-4 3 1.8 3 4ZM29.5 5C26.29 5 25 6.36 25 7.04c0 3.4 1.29 1.35 4.5 1.35S34 10.43 34 7.04C34 6.36 32.71 5 29.5 5Z',
    9.75,
    9,
    8,
  ],
  [
    'M12 8c0 2.2-1.34 4-3 4s-3-1.8-3-4 1.34-4 3-4 3 1.8 3 4ZM30.5 5C27.29 5 26 6.36 26 7.04c0 3.4 1.29 1.35 4.5 1.35S35 10.43 35 7.04C35 6.36 33.71 5 30.5 5Z',
    10.75,
    9,
    8,
  ],
  [
    'M11 8c0 2.2-1.34 4-3 4s-3-1.8-3-4 1.34-4 3-4 3 1.8 3 4ZM31.5 5C28.29 5 27 6.36 27 7.04c0 3.4 1.29 1.35 4.5 1.35S36 10.43 36 7.04C36 6.36 34.71 5 31.5 5Z',
    11.75,
    9,
    8,
  ],
]
/** Eye sets that sit cleanly inside glasses: plain dots and ovals. */
const PLAIN_EYES = THUMBS_EYES.map((_, index) => index).filter((index) =>
  [3, 4, 5, 7].includes(Math.floor(index / 4)),
)

/** DiceBear Thumbs mouths (CC0): path, top and bottom of the mouth in its 30x14 box. */
const THUMBS_MOUTHS: readonly [string, number, number][] = [
  [
    'M15 11C4.52 11 2.42 2.82 3.12 2.14 3.82 1.46 8.02 3.5 15 3.5c6.99 0 11.18-2.04 11.88-1.36.7.68-1.4 8.86-11.88 8.86Z',
    2.0,
    11.0,
  ],
  [
    'M15 14C1.9 14-.72 1.29.15.23 1.03-.83 6.27 2.11 15 2.11S28.97-.83 29.85.23C30.72 1.3 28.1 14 15 14Z',
    0.0,
    14.0,
  ],
  [
    'M15.5 10c-5.07 0-9.3-5.23-8.37-5.88.93-.65 3.45 2.15 8.37 2.15 4.92 0 7.44-2.88 8.37-2.15.93.73-3.3 5.88-8.37 5.88Z',
    4.0,
    10.0,
  ],
  [
    'M15 10C6.79 10 3.02 3.88 4.22 3.12 5.42 2.35 6.1 6.6 15 6.49c8.9-.12 9.58-4.23 10.78-3.37C26.98 3.98 23.21 10 15 10Z',
    3.0,
    10.0,
  ],
  [
    'M15.2 3.84c0-.67-4.2-2-4.2-2.67 0-.66 7 .67 7 2.67S13.8 6.5 13.8 6.5s4.2.67 4.2 2.66c0 2-7 3.33-7 2.67 0-.67 4.2-2 4.2-2.67 0-.66-3.5-1.33-3.5-2.66s3.5-2 3.5-2.66Z',
    1.0,
    12.0,
  ],
]

/** Eye and mouth offsets of the five Thumbs face layouts. */
const THUMBS_LAYOUTS = [
  [5, 23],
  [4, 24],
  [3, 25],
  [1, 27],
  [2, 26],
] as const

function thumbs(rng: Rng, outfit: Outfit) {
  const body = pick(rng, THUMBS_COLORS)
  const others = THUMBS_COLORS.filter((color) => color !== body)
  const background = pick(rng, others)
  const shapeRotate = int(rng, -20, 20)
  const shapeX = int(rng, -5, 5)
  const shapeY = int(rng, -5, 5)
  const [eyesY, mouthY] = pick(rng, THUMBS_LAYOUTS)
  const faceX = outfit.head ? int(rng, -7, 7) : int(rng, -15, 15)
  // With a hat the face moves up the head, and the whole figure shrinks to make room.
  // A tie needs room below the chin.
  const faceY = outfit.head ? int(rng, -15, -6) : outfit.neck ? int(rng, -15, 4) : int(rng, -15, 15)
  const faceRotate = outfit.head ? int(rng, -10, 10) : int(rng, -20, 20)
  const plainEyes = outfit.eyes === 'glasses' || outfit.eyes === 'monocle'
  const [eyes, eyeDx, eyeW, eyeH] =
    THUMBS_EYES[plainEyes ? pick(rng, PLAIN_EYES) : int(rng, 0, THUMBS_EYES.length - 1)]
  const [mouth, mouthTop, mouthBottom] = pick(rng, THUMBS_MOUTHS)
  const ink = contrast(body, 200)
  const accentPool = [...others.filter((color) => color !== background), '#ff6b5b', '#a66bff']
  const face: Face = {
    cx: 21,
    eyeY: eyesY + 8,
    eyeDx,
    eyeW,
    eyeH,
    mouthTop: mouthY + mouthTop,
    mouthBottom: mouthY + mouthBottom,
    k: 1.2,
    ink,
    accent: pick(rng, accentPool),
  }
  const figure =
    `<g transform="translate(${shapeX} ${shapeY}) rotate(${shapeRotate} 50 70)">` +
    `<path d="M95 53.33C95 29.4 74.85 10 50 10S5 29.4 5 53.33V140h90V53.33Z" fill="${body}"/>` +
    `<g transform="translate(${29 + faceX} ${33 + faceY}) rotate(${faceRotate} 21 21)">` +
    `<path transform="translate(0 ${eyesY})" d="${eyes}" fill="${ink}"/>` +
    `<path transform="translate(6 ${mouthY})" d="${mouth}" fill="${ink}"/>` +
    dress(outfit, face) +
    `</g></g>`
  return (
    `<rect width="100" height="100" fill="${background}"/>` +
    (outfit.head ? `<g transform="translate(9 18) scale(0.82)">${figure}</g>` : figure)
  )
}

/* ---------- public ---------- */

export type AvatarStyle = 'beam' | 'thumbs'

export interface AvatarLook {
  style: AvatarStyle
  accessories: Accessory[]
}

function generate(seed: string) {
  const rng = createRng(seed)
  const style: AvatarStyle = rng() < 0.5 ? 'beam' : 'thumbs'
  const outfit = pickOutfit(rng)
  const body = style === 'beam' ? beam(rng, outfit) : thumbs(rng, outfit)
  return { style, outfit, body }
}

/** What a seed turns into, without drawing it: for tests and labels. */
export function avatarLook(seed: string): AvatarLook {
  const { style, outfit } = generate(seed)
  const accessories: Accessory[] = []
  if (outfit.head) accessories.push(outfit.head)
  if (outfit.eyes) accessories.push(outfit.eyes)
  if (outfit.neck) accessories.push(outfit.neck)
  if (outfit.mustache) accessories.push('mustache')
  return { style, accessories }
}

/** The avatar as a square SVG document (no ids, so any number can share a page). */
export function avatarSvg(seed: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">${generate(seed).body}</svg>`
}

export function avatarDataUri(seed: string) {
  return `data:image/svg+xml,${encodeURIComponent(avatarSvg(seed))}`
}

/** Seeds are lowercase words, the shape the profile schema accepts. */
export const SEED_LENGTH = 10

/** A word a profile can store as its face: what the schema accepts, except 'custom' (an upload). */
export function isAvatarSeed(value: string) {
  return /^[a-z]{1,30}$/.test(value) && value !== 'custom'
}

export function randomSeed() {
  const values = crypto.getRandomValues(new Uint32Array(SEED_LENGTH))
  return Array.from(values, (value) => String.fromCharCode(97 + (value % 26))).join('')
}
