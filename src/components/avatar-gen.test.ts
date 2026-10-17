import { describe, expect, it } from 'vitest'
import {
  EYEWEAR,
  HEADWEAR,
  NECKWEAR,
  SEED_LENGTH,
  avatarLook,
  avatarSvg,
  isAvatarSeed,
  randomSeed,
} from './avatar-gen.ts'

const letters = 'abcdefghij'
const seeds = Array.from({ length: 3000 }, (_, index) =>
  `seed${index.toString(36)}`.replace(/\d/g, (digit) => letters[Number(digit)]),
)

describe('avatarSvg', () => {
  it('draws the same face for the same seed', () => {
    expect(avatarSvg('mediashell')).toBe(avatarSvg('mediashell'))
    expect(avatarSvg('mediashell')).not.toBe(avatarSvg('mediashelf'))
  })

  it('always produces a clean square SVG without ids', () => {
    for (const seed of seeds.slice(0, 500)) {
      const svg = avatarSvg(seed)
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"')).toBe(
        true,
      )
      expect(svg.endsWith('</svg>')).toBe(true)
      expect(svg).not.toMatch(/NaN|undefined|Infinity|\sid=/)
    }
  })

  it('accepts any stored word, including ids from the older avatar sets', () => {
    for (const seed of ['fox', 'koala', 'ronin', 'a', 'z'.repeat(30)])
      expect(avatarSvg(seed)).toContain('</svg>')
  })
})

describe('avatarLook', () => {
  const looks = seeds.map(avatarLook)
  const share = (test: (look: (typeof looks)[number]) => boolean) =>
    looks.filter(test).length / looks.length

  it('mixes both looks about evenly', () => {
    expect(share((look) => look.style === 'beam')).toBeGreaterThan(0.4)
    expect(share((look) => look.style === 'thumbs')).toBeGreaterThan(0.4)
  })

  it('dresses some faces, never with more than two things', () => {
    const dressed = share((look) => look.accessories.length > 0)
    expect(dressed).toBeGreaterThan(0.35)
    expect(dressed).toBeLessThan(0.75)
    expect(looks.every((look) => look.accessories.length <= 2)).toBe(true)
  })

  it('uses every accessory on both looks', () => {
    for (const item of [...HEADWEAR, ...EYEWEAR, ...NECKWEAR, 'mustache'] as const)
      for (const style of ['beam', 'thumbs'] as const)
        expect(
          looks.some((look) => look.style === style && look.accessories.includes(item)),
          `${item} on ${style}`,
        ).toBe(true)
  })
})

describe('seeds', () => {
  it('are lowercase words the profile schema accepts', () => {
    for (let index = 0; index < 50; index++) {
      const seed = randomSeed()
      expect(seed).toMatch(new RegExp(`^[a-z]{${SEED_LENGTH}}$`))
      expect(isAvatarSeed(seed)).toBe(true)
    }
  })

  it('keep "custom" for uploads and reject what the schema rejects', () => {
    for (const value of ['custom', '', 'Fox', 'fox1', 'a-b', 'x'.repeat(31)])
      expect(isAvatarSeed(value), value).toBe(false)
  })
})
