import { describe, expect, it } from 'vitest'
import { isTypingTarget, matchesHotkey, type HotkeySpec } from './hotkeys.ts'

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
