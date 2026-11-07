import { describe, expect, it } from 'vitest'
import {
  isHelpKey,
  isPlainKey,
  isTypingTarget,
  latinLetter,
  matchesHotkey,
  type HotkeySpec,
} from './hotkeys.ts'

const press = (init: Partial<KeyboardEvent>) => ({
  key: '',
  code: '',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  isComposing: false,
  ...init,
})

const palette: HotkeySpec = { key: 'k', code: 'KeyK', mod: true }
const slash: HotkeySpec = { key: '/', code: 'Slash' }

describe('matchesHotkey', () => {
  it('opens the palette with Ctrl+K or ⌘K on a Latin layout', () => {
    expect(matchesHotkey(press({ key: 'k', code: 'KeyK', ctrlKey: true }), palette)).toBe(true)
    expect(matchesHotkey(press({ key: 'k', code: 'KeyK', metaKey: true }), palette)).toBe(true)
    expect(
      matchesHotkey(press({ key: 'K', code: 'KeyK', ctrlKey: true, shiftKey: true }), palette),
    ).toBe(true)
  })

  it('matches the physical key with the Russian layout active', () => {
    expect(matchesHotkey(press({ key: 'л', code: 'KeyK', ctrlKey: true }), palette)).toBe(true)
    expect(matchesHotkey(press({ key: 'л', code: 'KeyK', metaKey: true }), palette)).toBe(true)
    expect(matchesHotkey(press({ key: '.', code: 'Slash' }), slash)).toBe(true)
  })

  it('still matches a layout that types the character on another key', () => {
    // German: '/' is Shift+7.
    expect(matchesHotkey(press({ key: '/', code: 'Digit7', shiftKey: true }), slash)).toBe(true)
    expect(matchesHotkey(press({ key: '/', code: 'Slash' }), slash)).toBe(true)
  })

  it('needs the modifier exactly as declared', () => {
    expect(matchesHotkey(press({ key: 'k', code: 'KeyK' }), palette)).toBe(false)
    expect(matchesHotkey(press({ key: 'л', code: 'KeyK' }), palette)).toBe(false)
    expect(matchesHotkey(press({ key: '/', code: 'Slash', ctrlKey: true }), slash)).toBe(false)
    expect(matchesHotkey(press({ key: '/', code: 'Slash', metaKey: true }), slash)).toBe(false)
  })

  it('ignores Alt and AltGr chords', () => {
    expect(
      matchesHotkey(press({ key: 'k', code: 'KeyK', ctrlKey: true, altKey: true }), palette),
    ).toBe(false)
    // AltGr on Windows reports Ctrl+Alt; the character it types must not open the palette.
    expect(
      matchesHotkey(press({ key: 'ķ', code: 'KeyK', ctrlKey: true, altKey: true }), palette),
    ).toBe(false)
    expect(matchesHotkey(press({ key: '÷', code: 'Slash', altKey: true }), slash)).toBe(false)
  })

  it('leaves another Latin letter on the same physical key alone', () => {
    // Dvorak types 't' on the K key: Ctrl+T is not the palette.
    expect(matchesHotkey(press({ key: 't', code: 'KeyK', ctrlKey: true }), palette)).toBe(false)
  })

  it('does not treat the shifted physical key as the shortcut', () => {
    // Shift+/ is '?' on a US layout.
    expect(matchesHotkey(press({ key: '?', code: 'Slash', shiftKey: true }), slash)).toBe(false)
  })

  it('ignores unrelated keys, composition and keydowns without a key', () => {
    expect(matchesHotkey(press({ key: '.', code: 'Period' }), slash)).toBe(false)
    expect(matchesHotkey(press({ key: 'j', code: 'KeyJ', ctrlKey: true }), palette)).toBe(false)
    expect(
      matchesHotkey(press({ key: 'k', code: 'KeyK', ctrlKey: true, isComposing: true }), palette),
    ).toBe(false)
    expect(
      matchesHotkey(
        press({ key: undefined as unknown as string, code: 'KeyK', ctrlKey: true }),
        palette,
      ),
    ).toBe(false)
  })

  it('works without a physical fallback', () => {
    expect(matchesHotkey(press({ key: ' ', code: 'Space' }), { key: ' ' })).toBe(true)
    expect(
      matchesHotkey(press({ key: 'л', code: 'KeyK', ctrlKey: true }), { key: 'k', mod: true }),
    ).toBe(false)
  })
})

describe('isTypingTarget', () => {
  it('is true for fields that take text', () => {
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT'])
      expect(isTypingTarget({ tagName } as unknown as EventTarget)).toBe(true)
    expect(
      isTypingTarget({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget),
    ).toBe(true)
  })

  it('is false elsewhere', () => {
    expect(isTypingTarget(null)).toBe(false)
    expect(isTypingTarget({ tagName: 'BUTTON' } as unknown as EventTarget)).toBe(false)
    expect(
      isTypingTarget({ tagName: 'BODY', isContentEditable: false } as unknown as EventTarget),
    ).toBe(false)
    expect(isTypingTarget({} as EventTarget)).toBe(false)
  })
})

describe('latinLetter', () => {
  it('takes the typed Latin letter, whatever the physical key', () => {
    expect(latinLetter(press({ key: 'g', code: 'KeyG' }))).toBe('g')
    expect(latinLetter(press({ key: 'H', code: 'KeyH' }))).toBe('h')
    // Dvorak: the key labelled J on QWERTY types «h».
    expect(latinLetter(press({ key: 'h', code: 'KeyJ' }))).toBe('h')
  })

  it('falls back to the physical letter for a non-Latin layout', () => {
    expect(latinLetter(press({ key: 'п', code: 'KeyG' }))).toBe('g')
    expect(latinLetter(press({ key: 'р', code: 'KeyH' }))).toBe('h')
  })

  it('is null for keys that are not letters', () => {
    expect(latinLetter(press({ key: '1', code: 'Digit1' }))).toBeNull()
    expect(latinLetter(press({ key: 'Enter', code: 'Enter' }))).toBeNull()
    expect(latinLetter(press({ key: '.', code: 'Slash' }))).toBeNull()
  })
})

describe('isHelpKey', () => {
  it('answers to «?» on Latin and Russian layouts', () => {
    expect(isHelpKey(press({ key: '?', code: 'Slash', shiftKey: true }))).toBe(true)
    // ЙЦУКЕН: «?» is Shift+7, and Shift+/ (physical) types «,».
    expect(isHelpKey(press({ key: '?', code: 'Digit7', shiftKey: true }))).toBe(true)
    expect(isHelpKey(press({ key: ',', code: 'Slash', shiftKey: true }))).toBe(true)
  })

  it('leaves «/» and modified keys alone', () => {
    expect(isHelpKey(press({ key: '/', code: 'Slash' }))).toBe(false)
    expect(isHelpKey(press({ key: '?', code: 'Slash', shiftKey: true, ctrlKey: true }))).toBe(false)
    expect(isHelpKey(press({ key: '?', code: 'Slash', isComposing: true }))).toBe(false)
  })
})

describe('isPlainKey', () => {
  it('refuses modifiers and composition', () => {
    expect(isPlainKey(press({ key: 'g' }))).toBe(true)
    expect(isPlainKey(press({ key: 'g', ctrlKey: true }))).toBe(false)
    expect(isPlainKey(press({ key: 'g', metaKey: true }))).toBe(false)
    expect(isPlainKey(press({ key: 'g', altKey: true }))).toBe(false)
    expect(isPlainKey(press({ key: 'g', isComposing: true }))).toBe(false)
  })
})
