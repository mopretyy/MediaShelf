import type { AvatarBgId } from '@shared/types.ts'

/**
 * Avatars: geometric animal portraits in a faceted, low-poly style. No image files: every
 * character is a list of polygons for the LEFT half of the face. The right half is the same
 * list mirrored and painted one step darker, so the light always falls from the left and both
 * halves line up exactly on the centre line. Colours come from a palette per variant:
 *   main   fur / body, expanded into a five-step ramp (r0 light … r4 deep)
 *   pale   muzzle, cheeks, belly (p0 … p2)
 *   eye    iris colour for characters with visible irises
 *   accent nose, beak, inner ear, antlers, the robot's light (a0, a1)
 */

export interface Palette {
  main: string
  pale: string
  eye: string
  accent: string
}

type Tone = 'r0' | 'r1' | 'r2' | 'r3' | 'r4' | 'p0' | 'p1' | 'p2' | 'a0' | 'a1' | 'k' | 'e' | 'w'
type Shape = [Tone, string]

interface Eye {
  x: number
  y: number
  /** Width and half-height of the almond. */
  w: number
  h: number
  /** Coloured iris with a pupil (otherwise a dark eye with a glint). */
  iris?: boolean
  /** Vertical slit pupil (cats). */
  slit?: boolean
  /** Horizontal pupil (frogs). */
  wide?: boolean
  /** Pale eye on a dark mask (raccoon, panda). */
  light?: boolean
}

interface Character {
  bg: AvatarBgId
  variants: Palette[]
  /** Left-half polygons, mirrored for the right half. */
  half: Shape[]
  /** Drawn once, across the centre line. */
  centre?: Shape[]
  eye: Eye
}

const INK = '#18171c'
const WHITE = '#ffffff'

export const AVATAR_BACKGROUNDS: Record<AvatarBgId, string> = {
  mint: '#9fb8aa',
  sky: '#93abc4',
  lavender: '#a79dbd',
  pink: '#c7a1a8',
  peach: '#d2ae92',
  sun: '#d3b46e',
  coral: '#c17f70',
  sage: '#8e9b78',
  slate: '#5d697a',
  cream: '#e1d8c6',
  night: '#242b3a',
}
export type BackgroundId = AvatarBgId
export const BACKGROUND_IDS = Object.keys(AVATAR_BACKGROUNDS) as BackgroundId[]

/* ---------- colour helpers ---------- */

function mix(hex: string, target: string, amount: number) {
  const parse = (value: string) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16))
  const a = parse(hex)
  const b = parse(target)
  return `#${a
    .map((channel, i) => Math.round(channel + (b[i] - channel) * amount))
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`
}

function colours(p: Palette): Record<Tone, string> {
  return {
    r0: mix(p.main, WHITE, 0.16),
    r1: p.main,
    r2: mix(p.main, '#000000', 0.13),
    r3: mix(p.main, '#000000', 0.26),
    r4: mix(p.main, '#000000', 0.42),
    p0: p.pale,
    p1: mix(p.pale, '#000000', 0.08),
    p2: mix(p.pale, '#000000', 0.17),
    a0: p.accent,
    a1: mix(p.accent, '#000000', 0.16),
    k: INK,
    e: p.eye,
    w: WHITE,
  }
}

/** The right half sits in shadow: one step darker on every ramp. */
const SHADE: Record<Tone, Tone> = {
  r0: 'r1',
  r1: 'r2',
  r2: 'r3',
  r3: 'r4',
  r4: 'r4',
  p0: 'p1',
  p1: 'p2',
  p2: 'p2',
  a0: 'a1',
  a1: 'a1',
  k: 'k',
  e: 'e',
  w: 'w',
}

const v = (main: string, pale: string, eye: string, accent: string): Palette => ({
  main,
  pale,
  eye,
  accent,
})

/* ---------- characters ---------- */

export const CHARACTERS = {
  fox: {
    bg: 'slate',
    eye: { x: 46, y: 60, w: 13, h: 3.6, iris: true },
    half: [
      ['r1', '24,15 47,39 31,51'],
      ['r4', '28,22 43,38 33,46'],
      ['r0', '47,39 64,34 64,58 43,55'],
      ['r2', '31,51 47,39 43,55 21,65'],
      ['r1', '43,55 64,58 64,71 48,71'],
      ['p0', '21,65 43,58 48,71 54,89 34,86'],
      ['r1', '48,71 64,71 64,82 54,89'],
      ['p1', '54,89 64,82 64,100'],
    ],
    centre: [['k', '58,92 64,89 70,92 64,99']],
    variants: [
      v('#c9622f', '#efe6da', '#e0a33a', '#2b2320'),
      v('#e2dbd0', '#fbf8f3', '#7d97b3', '#3b3a42'),
      v('#7f8793', '#e8eaee', '#d8a03e', '#2a2c33'),
      v('#9e3c24', '#f1e3d3', '#e0a33a', '#231915'),
    ],
  },
  wolf: {
    bg: 'night',
    eye: { x: 47, y: 60, w: 12, h: 3.4, iris: true },
    half: [
      ['r2', '28,19 48,40 32,50'],
      ['r4', '32,26 44,40 35,46'],
      ['r0', '48,40 64,34 64,58 44,54'],
      ['r1', '32,50 48,40 44,54 23,64'],
      ['p0', '23,64 44,58 48,76 30,90 19,78'],
      ['r2', '44,54 64,58 64,70 48,72'],
      ['r1', '48,72 64,70 64,86 52,88'],
      ['p1', '52,88 64,86 64,101 56,99'],
      ['r3', '30,90 48,76 52,88 56,99 43,101'],
    ],
    centre: [['k', '57,86 64,83 71,86 64,93']],
    variants: [
      v('#7c828c', '#e7e5e1', '#d9a441', '#2a2b30'),
      v('#4b4f58', '#c9c7c2', '#9ec3d8', '#1d1e22'),
      v('#a88d6c', '#efe7da', '#d9a441', '#2c241c'),
      v('#d6d3cd', '#fbfaf7', '#7aa3c2', '#3a3b40'),
    ],
  },
  bear: {
    bg: 'sage',
    eye: { x: 48, y: 58, w: 7, h: 3 },
    half: [
      ['r2', '24,25 36,19 46,29 40,42 27,40'],
      ['r4', '29,28 36,24 42,31 37,37 31,35'],
      ['r1', '40,30 64,26 64,50 42,48'],
      ['r2', '27,40 40,30 42,48 22,70'],
      ['r1', '22,70 42,48 48,72 32,95'],
      ['r0', '42,48 64,50 64,66 48,68'],
      ['p0', '48,68 64,66 64,96 52,94 44,82'],
      ['r3', '32,95 44,82 52,94 64,96 64,106 46,104'],
    ],
    centre: [['k', '56,71 64,69 72,71 70,77 64,80 58,77']],
    variants: [
      v('#7a5236', '#c9a27e', '#2a1d14', '#1d1612'),
      v('#3d3a3f', '#8c8790', '#2a2a2a', '#151417'),
      v('#e4dfd4', '#f7f4ee', '#2a2a2a', '#2b2b2e'),
      v('#a8774a', '#dcc09b', '#2a1d14', '#1d1612'),
    ],
  },
  panda: {
    bg: 'mint',
    eye: { x: 46, y: 59, w: 6, h: 2.6, light: true },
    half: [
      ['r1', '23,27 35,18 46,28 40,40 27,40'],
      ['p0', '40,28 64,24 64,48 42,46'],
      ['p1', '27,40 40,28 42,46 21,68'],
      ['p0', '21,68 42,46 46,74 30,94'],
      ['r1', '36,53 51,49 57,61 47,72 35,66'],
      ['p0', '46,74 57,61 64,63 64,98 50,96'],
      ['p1', '30,94 46,74 50,96 64,98 64,106 44,104'],
    ],
    centre: [['k', '58,73 64,71 70,73 64,79']],
    variants: [
      v('#2b2a30', '#f2f0ec', '#f2f0ec', '#c98d8d'),
      v('#4a3a2c', '#f3ece0', '#f3ece0', '#c98d8d'),
      v('#2a3550', '#eef1f6', '#eef1f6', '#c98d9d'),
      v('#5a2a3f', '#f6eef1', '#f6eef1', '#c98d9d'),
    ],
  },
  tiger: {
    bg: 'night',
    eye: { x: 47, y: 57, w: 12, h: 3.4, iris: true },
    half: [
      ['r1', '27,24 42,21 46,34 31,42'],
      ['p0', '31,28 40,26 42,34 34,38'],
      ['r0', '44,30 64,26 64,50 42,48'],
      ['r1', '31,42 44,30 42,48 21,66'],
      ['p0', '21,66 42,58 46,78 30,92'],
      ['r1', '42,48 64,50 64,64 46,66'],
      ['p0', '46,66 64,64 64,96 52,94 42,80'],
      ['p1', '30,92 42,80 52,94 64,96 64,104 44,102'],
      ['k', '60,29 64,28 64,44 61,40'],
      ['k', '51,32 55,31 56,42 53,40'],
      ['k', '24,56 38,59 37,62 23,60'],
      ['k', '22,67 37,68 36,71 23,72'],
      ['k', '33,44 40,38 41,41 35,47'],
    ],
    centre: [['a0', '58,70 64,68 70,70 64,77']],
    variants: [
      v('#cf7a2d', '#f2ebe0', '#d9a441', '#c98476'),
      v('#e6e2db', '#ffffff', '#7da0c4', '#c99a9a'),
      v('#c9a24a', '#f4ecd8', '#5f8f6a', '#c98476'),
      v('#6e6a78', '#e6e4ea', '#d9a441', '#b88a90'),
    ],
  },
  lion: {
    bg: 'cream',
    eye: { x: 48, y: 58, w: 11, h: 3.2, iris: true },
    half: [
      ['r3', '64,9 40,13 19,29 11,56 15,84 30,104 50,116 64,118'],
      ['r2', '64,9 40,13 44,25 64,21'],
      ['r2', '19,29 11,56 27,52 31,36'],
      ['r2', '15,84 30,104 38,92 26,78'],
      ['r1', '35,31 44,27 46,38 37,40'],
      ['r0', '44,33 64,29 64,52 42,50'],
      ['r1', '37,40 44,33 42,50 30,64 33,46'],
      ['r0', '30,64 42,50 48,74 36,88'],
      ['r1', '42,50 64,52 64,66 48,68'],
      ['p0', '48,68 64,66 64,94 52,92 44,80'],
      ['r2', '36,88 44,80 52,92 64,94 64,100 46,98'],
    ],
    centre: [['k', '58,70 64,68 70,70 64,77']],
    variants: [
      v('#c9984e', '#efe3cc', '#b07a2a', '#3a2a1c'),
      v('#a87650', '#e8d4bc', '#8a5a2a', '#2a1d14'),
      v('#e0d8c8', '#faf7f0', '#7a9ab4', '#3a3a40'),
      v('#8a8f9a', '#e6e8ec', '#d9a441', '#2a2c33'),
    ],
  },
  cat: {
    bg: 'lavender',
    eye: { x: 46, y: 60, w: 14, h: 4.4, iris: true, slit: true },
    half: [
      ['r1', '25,15 48,36 30,48'],
      ['a0', '29,23 43,36 33,43'],
      ['r0', '48,36 64,32 64,54 44,52'],
      ['r1', '30,48 48,36 44,52 21,66'],
      ['r0', '21,66 44,52 48,78 30,90 15,80'],
      ['r1', '44,52 64,54 64,68 48,70'],
      ['p0', '48,70 64,68 64,92 54,90 46,80'],
      ['r2', '30,90 46,80 54,90 64,92 64,100 44,98'],
    ],
    centre: [['a0', '60,72 64,71 68,72 64,76']],
    variants: [
      v('#c9792f', '#f1e8dc', '#9bb35a', '#c98a8a'),
      v('#8b919c', '#e9ebee', '#d9b44a', '#c99aa0'),
      v('#2f2d35', '#7d7a85', '#d9b44a', '#b07a84'),
      v('#e5dfd6', '#fbf9f5', '#7aa3c2', '#d3a0a8'),
    ],
  },
  dog: {
    bg: 'sky',
    eye: { x: 47, y: 58, w: 8, h: 3.2 },
    half: [
      ['r1', '29,21 46,36 33,46'],
      ['r3', '33,28 43,36 36,42'],
      ['r0', '46,36 64,32 64,52 44,50'],
      ['r1', '33,46 46,36 44,50 23,64'],
      ['p0', '23,64 44,58 50,80 32,92'],
      ['p0', '45,48 50,47 50,50 46,51'],
      ['r1', '44,50 64,52 64,66 48,66'],
      ['p0', '48,66 64,66 64,96 52,94 46,78'],
      ['p1', '32,92 46,78 52,94 64,96 64,104 46,102'],
    ],
    centre: [['k', '57,70 64,68 71,70 69,76 64,78 59,76']],
    variants: [
      v('#c98a4a', '#f4ece0', '#2a1d14', '#2a1d14'),
      v('#3a3740', '#e9e6e1', '#2a1d14', '#2a1d14'),
      v('#e6dac6', '#fbf8f2', '#2a1d14', '#2a1d14'),
      v('#8a5a3a', '#efe2d0', '#2a1d14', '#2a1d14'),
    ],
  },
  rabbit: {
    bg: 'pink',
    eye: { x: 46, y: 63, w: 8, h: 3.4 },
    half: [
      ['r1', '40,4 50,6 52,40 42,42 35,22'],
      ['a0', '42,10 48,12 49,37 44,37 40,22'],
      ['r0', '44,40 64,36 64,58 42,56'],
      ['r1', '32,52 44,40 42,56 26,72'],
      ['r0', '26,72 42,56 48,80 34,96'],
      ['r1', '42,56 64,58 64,70 48,72'],
      ['p0', '48,72 64,70 64,94 52,92 44,84'],
      ['p1', '34,96 44,84 52,92 64,94 64,102 46,100'],
    ],
    centre: [['a0', '60,74 64,73 68,74 64,78']],
    variants: [
      v('#d6d1c9', '#f7f5f1', '#2a2a2a', '#c9959c'),
      v('#9c8f82', '#e6ded4', '#2a2a2a', '#c9959c'),
      v('#6e5644', '#d6c3ae', '#2a2a2a', '#c9959c'),
      v('#4a4752', '#a9a5b0', '#2a2a2a', '#b98a94'),
    ],
  },
  deer: {
    bg: 'sage',
    eye: { x: 47, y: 61, w: 10, h: 3.8 },
    half: [
      ['a0', '40,30 43,9 46,9 46,32'],
      ['a0', '43,20 33,10 35,8 45,17'],
      ['a0', '44,14 40,4 43,3 46,12'],
      ['r1', '15,41 38,36 36,46 20,49'],
      ['p0', '20,42 34,40 33,44 22,45'],
      ['r0', '38,36 64,32 64,56 42,54'],
      ['r1', '36,46 38,36 42,54 34,72'],
      ['r0', '34,72 42,54 48,80 44,96'],
      ['r1', '42,54 64,56 64,70 48,72'],
      ['p0', '48,72 64,70 64,104 54,102 46,88'],
      ['r2', '44,96 46,88 54,102 64,104 64,109 52,108'],
    ],
    centre: [['k', '58,96 64,94 70,96 64,102']],
    variants: [
      v('#a8724a', '#efe4d6', '#2a1d14', '#e6d9c2'),
      v('#8a6a4c', '#e9dfd2', '#2a1d14', '#e6d9c2'),
      v('#c9a07a', '#f6eee2', '#2a1d14', '#f1e8d8'),
      v('#6e6a64', '#e2dfda', '#2a1d14', '#d9cfbd'),
    ],
  },
  raccoon: {
    bg: 'peach',
    eye: { x: 46, y: 60, w: 7, h: 2.8, light: true },
    half: [
      ['r1', '27,22 42,20 46,34 32,40'],
      ['p0', '31,26 40,24 42,32 34,36'],
      ['r0', '44,30 64,26 64,50 42,48'],
      ['r1', '32,40 44,30 42,48 21,66'],
      ['p0', '21,66 40,62 46,80 30,90'],
      ['r4', '22,56 42,50 64,54 64,66 50,70 36,68 24,64'],
      ['r4', '60,28 64,26 64,52 61,50'],
      ['p0', '50,70 64,66 64,96 52,94 44,80'],
      ['p1', '30,90 44,80 52,94 64,96 64,104 46,102'],
    ],
    centre: [['k', '58,74 64,72 70,74 64,80']],
    variants: [
      v('#8c8f96', '#eef0f2', '#eef0f2', '#2a2a2e'),
      v('#9c7a5a', '#f1e6d8', '#f1e6d8', '#2a2a2e'),
      v('#6c7a94', '#e9edf4', '#e9edf4', '#2a2a2e'),
      v('#b5a895', '#faf6ef', '#faf6ef', '#2a2a2e'),
    ],
  },
  owl: {
    bg: 'night',
    eye: { x: 45, y: 61, w: 0, h: 0 },
    half: [
      ['r3', '23,17 41,30 28,40'],
      ['r1', '28,40 41,30 64,26 64,48 30,56'],
      ['r2', '19,60 30,56 26,70 40,80 30,80 28,96 17,84'],
      ['r0', '26,50 40,42 56,46 62,60 56,76 40,80 26,70'],
      ['p0', '32,52 42,47 54,50 58,60 54,72 42,75 32,68'],
      ['r1', '30,80 40,80 56,76 64,82 64,112 40,110 28,96'],
      ['p1', '44,90 50,94 56,90 56,92 50,96 44,92'],
      ['p1', '40,100 46,104 52,100 52,102 46,106 40,102'],
    ],
    centre: [
      ['a0', '58,64 64,62 70,64 64,80'],
      ['a1', '64,62 70,64 64,80'],
    ],
    variants: [
      v('#8a6a4a', '#e9dcc6', '#e0a33a', '#c9a24a'),
      v('#7c828c', '#e9e9ea', '#e0a33a', '#c9a24a'),
      v('#e4dfd6', '#fbfaf7', '#e0b23a', '#5a5a62'),
      v('#4a4060', '#d8d0e6', '#e0a33a', '#c9a24a'),
    ],
  },
  eagle: {
    bg: 'sky',
    eye: { x: 48, y: 51, w: 12, h: 3.2, iris: true },
    half: [
      ['r1', '13,128 18,98 36,80 64,76 64,128'],
      ['r2', '13,128 18,98 30,90 28,128'],
      ['p0', '30,30 46,20 64,18 64,70 40,74 28,58'],
      ['p1', '28,58 40,74 30,82 22,66'],
      ['p1', '34,45 50,41 60,47 48,48'],
    ],
    centre: [
      ['a0', '54,58 64,54 74,58 72,72 64,90 56,72'],
      ['a1', '64,54 74,58 72,72 64,90'],
      ['k', '60,64 64,63 64,66 60,66'],
    ],
    variants: [
      v('#5a3e2a', '#f4f1ec', '#e0b23a', '#e0b23a'),
      v('#3a3a40', '#f4f1ec', '#e0b23a', '#e0b23a'),
      v('#8a6a4a', '#efe7da', '#e0b23a', '#d9a441'),
      v('#2a3550', '#eef1f6', '#e0b23a', '#e0b23a'),
    ],
  },
  penguin: {
    bg: 'sky',
    eye: { x: 47, y: 53, w: 7, h: 2.6 },
    half: [
      ['r3', '13,128 21,90 36,70 64,66 64,128'],
      ['r4', '15,106 25,86 31,90 21,122'],
      ['p0', '40,128 44,90 56,74 64,74 64,128'],
      ['r3', '30,40 40,24 64,18 64,60 34,64'],
      ['p0', '36,50 48,40 58,46 56,64 42,70 34,62'],
      ['a0', '29,63 36,60 35,73 29,71'],
    ],
    centre: [['a0', '58,58 64,56 70,58 64,72']],
    variants: [
      v('#2a2e38', '#f3f1ec', '#2a2a2a', '#e0953a'),
      v('#2a3a5c', '#eef1f6', '#2a2a2a', '#e0b23a'),
      v('#4a3a32', '#f6efe4', '#2a2a2a', '#e07a3a'),
      v('#3a3f4a', '#e9eaee', '#2a2a2a', '#d9a441'),
    ],
  },
  koala: {
    bg: 'mint',
    eye: { x: 48, y: 56, w: 6, h: 2.6 },
    half: [
      ['r1', '11,34 28,22 42,30 40,48 22,52'],
      ['p0', '17,36 28,28 37,33 36,45 24,47'],
      ['r0', '40,30 64,28 64,50 42,50'],
      ['r1', '22,52 40,48 42,50 28,80'],
      ['r0', '28,80 42,50 48,76 40,96'],
      ['r1', '42,50 64,50 64,62 48,64'],
      ['p0', '48,76 54,76 64,86 64,100 48,98'],
      ['r2', '40,96 48,76 48,98 64,100 64,104 48,104'],
    ],
    centre: [
      ['k', '56,62 64,58 72,62 74,76 64,86 54,76'],
      ['r3', '64,58 72,62 74,76 64,86'],
    ],
    variants: [
      v('#8c919c', '#eceef1', '#2a2a2a', '#1f1f24'),
      v('#7b8aa3', '#e7ecf3', '#2a2a2a', '#1f1f24'),
      v('#9c8a7a', '#efe7de', '#2a2a2a', '#1f1f24'),
      v('#ada3b9', '#f1edf5', '#2a2a2a', '#1f1f24'),
    ],
  },
  frog: {
    bg: 'cream',
    eye: { x: 40, y: 33, w: 13, h: 5, iris: true, wide: true },
    half: [
      ['r1', '27,30 38,21 51,26 52,40 35,44'],
      ['r0', '35,44 52,40 64,40 64,62 30,62'],
      ['r1', '15,58 29,46 35,44 30,62 17,72'],
      ['r2', '17,72 30,62 64,62 64,86 27,84'],
      ['k', '21,72 64,73 64,75 21,74'],
      ['p0', '27,84 64,86 64,101 36,97'],
      ['a0', '44,50 49,48 50,53 45,54'],
      ['a0', '22,62 26,60 27,64 23,65'],
    ],
    centre: [
      ['k', '57,51 59,50 60,53 58,54'],
      ['k', '68,50 70,51 70,54 68,53'],
    ],
    variants: [
      v('#5f8f4a', '#d9e4c4', '#d9a441', '#3a5a2a'),
      v('#3f7f7a', '#cfe6df', '#d9a441', '#1f4a46'),
      v('#a85a6a', '#ecd2d6', '#d9b44a', '#5a2a3a'),
      v('#b08a3a', '#efe2bf', '#5a7a3a', '#5a4218'),
    ],
  },
  pig: {
    bg: 'slate',
    eye: { x: 47, y: 56, w: 6, h: 2.6 },
    half: [
      ['r1', '25,26 46,30 36,47 23,44'],
      ['r2', '29,29 42,32 35,43 28,40'],
      ['r0', '40,32 64,28 64,52 42,50'],
      ['r1', '23,44 40,32 42,50 21,72'],
      ['r0', '21,72 42,50 46,78 34,94'],
      ['r1', '42,50 64,52 64,62 46,64'],
      ['r2', '34,94 46,78 48,78 64,84 64,102 46,100'],
    ],
    centre: [
      ['a0', '49,64 64,60 79,64 81,78 64,85 47,78'],
      ['a1', '64,60 79,64 81,78 64,85'],
      ['k', '56,70 59,69 60,76 57,77'],
      ['k', '68,69 71,70 71,77 68,76'],
    ],
    variants: [
      v('#dea7a6', '#f3dcd8', '#2a2a2a', '#c98282'),
      v('#d6b698', '#f1e3d4', '#2a2a2a', '#b98d6e'),
      v('#9a8a9c', '#e3dce6', '#2a2a2a', '#7a6a7e'),
      v('#5a5258', '#a9a0a6', '#2a2a2a', '#3f383d'),
    ],
  },
  monkey: {
    bg: 'sun',
    eye: { x: 50, y: 56, w: 7, h: 2.8 },
    half: [
      ['r1', '13,52 24,46 28,61 17,65'],
      ['p1', '16,53 23,50 25,59 19,62'],
      ['r1', '28,40 40,26 64,22 64,42 42,44'],
      ['r2', '24,48 28,40 42,44 36,66 26,72'],
      ['p0', '36,46 52,42 64,46 64,62 40,64'],
      ['p0', '38,64 64,62 64,96 48,94 36,80'],
      ['p1', '36,80 48,94 40,96 30,82'],
      ['r2', '26,72 36,66 36,80 30,82 40,96 64,98 64,106 36,104 24,88'],
    ],
    centre: [
      ['k', '58,72 61,71 61,75 58,75'],
      ['k', '67,71 70,72 70,75 67,75'],
      ['k', '52,84 76,84 75,86 53,86'],
    ],
    variants: [
      v('#7a5a40', '#e3c9a8', '#2a1d14', '#2a1d14'),
      v('#5a5660', '#cfc8c0', '#2a1d14', '#2a1d14'),
      v('#a8824a', '#efdcb8', '#2a1d14', '#2a1d14'),
      v('#3a3640', '#bdb5c0', '#2a1d14', '#2a1d14'),
    ],
  },
  horse: {
    bg: 'cream',
    eye: { x: 43, y: 60, w: 9, h: 3.4 },
    half: [
      ['r1', '35,8 46,16 42,32 33,26'],
      ['r3', '38,12 44,17 41,28 37,24'],
      ['r4', '23,24 36,20 34,40 21,52'],
      ['r0', '42,32 50,30 64,34 64,56 40,54'],
      ['r1', '33,26 42,32 40,54 34,70'],
      ['r0', '34,70 40,54 48,74 46,96'],
      ['r1', '40,54 64,56 64,72 48,74'],
      ['r0', '48,74 64,72 64,110 52,108 46,96'],
      ['r2', '46,96 52,108 64,110 64,118 50,116'],
      ['p0', '58,36 64,34 64,90 60,86'],
      ['r4', '46,16 64,12 64,34 50,30'],
      ['k', '53,101 57,100 58,106 54,107'],
    ],
    variants: [
      v('#7a4e30', '#efe5d8', '#2a1d14', '#2a1d14'),
      v('#3a3438', '#e9e4de', '#2a1d14', '#2a1d14'),
      v('#c6b196', '#faf6ef', '#2a1d14', '#2a1d14'),
      v('#8a8a90', '#efeff1', '#2a1d14', '#2a1d14'),
    ],
  },
  robot: {
    bg: 'night',
    eye: { x: 0, y: 0, w: 0, h: 0 },
    half: [
      ['r1', '24,40 40,22 64,18 64,100 30,96 22,70'],
      ['r0', '40,22 64,18 64,30 44,32'],
      ['r0', '24,40 40,22 44,32 30,48'],
      ['r3', '18,52 24,48 25,80 19,78'],
      ['k', '30,50 64,46 64,72 34,72'],
      ['a0', '39,59 55,58 55,62 39,63'],
      ['r2', '34,72 64,72 64,100 42,96'],
      ['r3', '44,100 64,100 64,113 48,113'],
      ['p0', '36,52 48,51 41,56'],
    ],
    variants: [
      v('#9aa3ae', '#e6ebf0', '#5ad0e6', '#5ad0e6'),
      v('#5a6a8a', '#d6deea', '#e6c35a', '#e6c35a'),
      v('#c6b088', '#f1e8d6', '#e67a5a', '#e67a5a'),
      v('#3a3f48', '#9aa3ae', '#7ae6a0', '#7ae6a0'),
    ],
  },
} satisfies Record<string, Character>

export type AvatarId = keyof typeof CHARACTERS
export const AVATAR_IDS = Object.keys(CHARACTERS) as AvatarId[]

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === 'string' && value in CHARACTERS
}

export function isBackgroundId(value: unknown): value is BackgroundId {
  return typeof value === 'string' && value in AVATAR_BACKGROUNDS
}

export const variantCount = (id: AvatarId) => CHARACTERS[id].variants.length

export function characterPalette(id: AvatarId, variant = 0): Palette {
  const { variants } = CHARACTERS[id]
  return variants[variant] ?? variants[0]
}

export function defaultBackground(id: AvatarId): BackgroundId {
  return CHARACTERS[id].bg
}

/* ---------- drawing ---------- */

function Shapes({
  shapes,
  tones,
  shade,
}: {
  shapes: Shape[]
  tones: Record<Tone, string>
  shade?: boolean
}) {
  return (
    <>
      {shapes.map(([tone, points], index) => {
        const fill = tones[shade ? SHADE[tone] : tone]
        // A hairline in the same colour closes the seams between facets.
        return (
          <polygon
            key={index}
            points={points}
            fill={fill}
            stroke={fill}
            strokeWidth={0.6}
            strokeLinejoin="round"
          />
        )
      })}
    </>
  )
}

function EyeShape({ eye, tones }: { eye: Eye; tones: Record<Tone, string> }) {
  const { x, y, w, h } = eye
  if (!w) return null
  const almond = `M${x - w / 2} ${y} Q${x} ${y - h * 2} ${x + w / 2} ${y} Q${x} ${y + h * 2} ${x - w / 2} ${y} Z`
  if (eye.iris)
    return (
      <>
        <path d={almond} fill={tones.e} />
        {eye.slit ? (
          <ellipse cx={x} cy={y} rx={w * 0.08} ry={h * 1.15} fill={INK} />
        ) : eye.wide ? (
          <ellipse cx={x} cy={y} rx={w * 0.3} ry={h * 0.45} fill={INK} />
        ) : (
          <circle cx={x} cy={y} r={Math.min(w * 0.18, h * 0.95)} fill={INK} />
        )}
        <circle
          cx={x - w * 0.16}
          cy={y - h * 0.45}
          r={Math.max(0.8, h * 0.28)}
          fill={WHITE}
          opacity={0.85}
        />
      </>
    )
  return (
    <>
      <path d={almond} fill={eye.light ? tones.p0 : INK} />
      {eye.light ? <circle cx={x + 0.4} cy={y} r={h * 0.75} fill={INK} /> : null}
      <circle
        cx={x - w * 0.18}
        cy={y - h * 0.4}
        r={Math.max(0.7, h * 0.26)}
        fill={WHITE}
        opacity={0.8}
      />
    </>
  )
}

/** Owl and robot eyes are part of the drawing itself. */
function SpecialEyes({ id, tones }: { id: AvatarId; tones: Record<Tone, string> }) {
  if (id === 'owl')
    return (
      <>
        {[45, 83].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy={61} r={8.5} fill={tones.e} />
            <circle cx={cx} cy={61} r={4.6} fill={INK} />
            <circle cx={cx - 1.8} cy={59.2} r={1.5} fill={WHITE} opacity={0.85} />
          </g>
        ))}
      </>
    )
  return null
}

/** The whole avatar: muted background plus the portrait, as one square SVG. */
export function AvatarFigure({
  id,
  bg,
  variant = 0,
  className,
}: {
  id: AvatarId
  bg?: BackgroundId
  variant?: number
  className?: string
}) {
  const character: Character = CHARACTERS[id]
  const tones = colours(characterPalette(id, variant))
  const fill = AVATAR_BACKGROUNDS[bg ?? character.bg]
  const mirror = 'translate(128 0) scale(-1 1)'
  return (
    <svg viewBox="0 0 128 128" aria-hidden="true" className={className} focusable="false">
      <rect width={128} height={128} fill={fill} />
      <rect width={128} height={128} fill="url(#avatar-light)" />
      <defs>
        <radialGradient id="avatar-light" cx="30%" cy="22%" r="85%">
          <stop offset="0" stopColor={WHITE} stopOpacity={0.16} />
          <stop offset="1" stopColor="#000000" stopOpacity={0.12} />
        </radialGradient>
      </defs>
      <Shapes shapes={character.half} tones={tones} />
      <g transform={mirror}>
        <Shapes shapes={character.half} tones={tones} shade />
      </g>
      {character.centre ? <Shapes shapes={character.centre} tones={tones} /> : null}
      <EyeShape eye={character.eye} tones={tones} />
      <g transform={mirror}>
        <EyeShape eye={character.eye} tones={tones} />
      </g>
      <SpecialEyes id={id} tones={tones} />
    </svg>
  )
}
