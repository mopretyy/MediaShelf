// Pure keyboard-shortcut matching, kept apart from the React hook so it can be unit tested.

export interface HotkeySpec {
  /** Compared case-insensitively with `KeyboardEvent.key`. */
  key: string
  /**
   * The physical key (`KeyboardEvent.code`) that triggers the shortcut too. With a non-Latin
   * layout active `key` reports that layout's character: on ЙЦУКЕН Ctrl+K arrives as
   * `key: 'л', code: 'KeyK'`, and the '/' key types '.' (`code: 'Slash'`).
   */
  code?: string
  /** Ctrl or ⌘ must be held. */
  mod?: boolean
}

type KeyInfo = Pick<
  KeyboardEvent,
  'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'isComposing'
>

export function matchesHotkey(event: KeyInfo, { key, code, mod = false }: HotkeySpec): boolean {
  // Keys mid-composition belong to the input method. Alt or AltGr chords type other characters
  // (Option+/ is '÷') or are shortcuts of their own.
  if (event.isComposing || event.altKey) return false
  if (mod !== (event.ctrlKey || event.metaKey)) return false
  // Chrome fires keydown events without a key when it autofills a form.
  if (typeof event.key !== 'string') return false
  const pressed = event.key.toLowerCase()
  if (pressed === key.toLowerCase()) return true
  // The physical fallback stands for the unshifted key (Shift+/ is '?'), and never fires when the
  // layout puts another Latin letter there (Dvorak, Colemak): that letter's shortcut wins.
  return code !== undefined && event.code === code && !event.shiftKey && !/^[a-z]$/.test(pressed)
}

const TEXT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/** True while focus is in a field that takes typing, where single-key shortcuts must keep quiet. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as { tagName?: unknown; isContentEditable?: boolean } | null
  if (!element) return false
  if (element.isContentEditable) return true
  return typeof element.tagName === 'string' && TEXT_TAGS.has(element.tagName)
}

/**
 * The Latin letter a key stands for: the typed one, or, with a non-Latin layout, the letter
 * printed on the physical key (ЙЦУКЕН «р» is KeyH). Dvorak and Colemak type Latin letters
 * themselves, so theirs win, as in `matchesHotkey`. Null for anything that is not a letter.
 */
export function latinLetter(event: Pick<KeyboardEvent, 'key' | 'code'>): string | null {
  if (typeof event.key === 'string' && /^[a-z]$/i.test(event.key)) return event.key.toLowerCase()
  const physical = /^Key([A-Z])$/.exec(event.code ?? '')
  return physical ? physical[1].toLowerCase() : null
}

/** How long the second key of a «G, then H» chord may wait after the first. */
export const CHORD_TIMEOUT = 1200

/**
 * The «?» that opens the shortcut list: Shift+/ on Latin layouts, and the «?» key wherever the
 * layout keeps it (Shift+7 on ЙЦУКЕН reports `key: '?'` too).
 */
export function isHelpKey(event: KeyInfo): boolean {
  if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return false
  return event.key === '?' || (event.code === 'Slash' && event.shiftKey)
}

/** A key that may take part in a chord: no modifiers, not mid-composition. */
export function isPlainKey(event: KeyInfo): boolean {
  return !event.isComposing && !event.altKey && !event.ctrlKey && !event.metaKey
}
