import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Recomputes the text contrast of the design tokens straight from the stylesheet, so a token
// tweak that drops secondary or tertiary text below WCAG AA (4.5:1) fails here first.
const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8')

/** The custom properties declared directly in the first `selector { … }` block. */
function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`no ${selector} block in index.css`)
  const body = css.slice(start, css.indexOf('\n}', start))
  return Object.fromEntries(
    [...body.matchAll(/^\s*--([\w-]+):\s*([^;]+);/gm)].map(([, name, value]) => [
      name,
      value.trim(),
    ]),
  )
}

function luminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!match) throw new Error(`expected an opaque #rrggbb colour, got ${hex}`)
  const [r, g, b] = match.slice(1).map((part) => {
    const channel = parseInt(part, 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

const themes = { light: tokens(':root'), dark: tokens('.dark') }
const surfaces = ['bg', 'panel', 'raised', 'floating'] as const

describe('text tokens', () => {
  it('the helpers agree with known WCAG ratios', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrast('#767676', '#ffffff')).toBeCloseTo(4.54, 2)
  })

  for (const [theme, values] of Object.entries(themes))
    for (const text of ['fg', 'fg-2', 'fg-3'] as const)
      for (const surface of surfaces)
        it(`${theme}: --${text} reaches 4.5:1 on --${surface}`, () => {
          expect(contrast(values[text], values[surface])).toBeGreaterThanOrEqual(4.5)
        })

  it('tertiary text stays a step quieter than secondary', () => {
    const { light, dark } = themes
    expect(luminance(light['fg-3'])).toBeGreaterThan(luminance(light['fg-2']))
    expect(luminance(dark['fg-3'])).toBeLessThan(luminance(dark['fg-2']))
  })
})
