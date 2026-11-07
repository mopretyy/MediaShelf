// Relative import (not @shared): unit tests type-check this file under tsconfig.node.json,
// which has no path aliases.
import { LOCALES, type Locale } from '../../shared/types.ts'

/** Every interface language named in itself, so people find their own whatever the UI shows. */
export const LANGUAGE_NAMES: Record<Locale, string> = {
  ru: 'Русский',
  en: 'English',
  uk: 'Українська',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
  ro: 'Română',
}

/**
 * The word for «language» in every interface language (each locale's `nav.language`), so the
 * palette finds «Язык…» from any of them without loading every dictionary. Kept equal to the
 * dictionaries by languages.test.ts.
 */
export const LANGUAGE_WORDS: Record<Locale, string> = {
  ru: 'Язык',
  en: 'Language',
  uk: 'Мова',
  de: 'Sprache',
  es: 'Idioma',
  fr: 'Langue',
  ro: 'Limbă',
}

/**
 * Fully translated locales: parity.test.ts fails when one of them lacks a key that ru.ts has.
 * The others are partial and fall back to English. Add a locale once its translation is done.
 */
export const COMPLETE_LOCALES: readonly Locale[] = ['ru', 'en', 'uk', 'de', 'es', 'fr', 'ro']

/** Lower case, ё as е and no accents: «francais» finds Français, «romana» finds Română. */
export function foldForSearch(value: string) {
  return value
    .toLocaleLowerCase()
    .replaceAll('ё', 'е')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

export interface LanguageOption {
  code: Locale
  /** The language's own name. */
  name: string
  /** Its name in the interface language, left out when it only repeats `name`. */
  hint: string
  /** Folded names it can be found by: its own, in the interface language and in English. */
  words: string[]
}

/** The languages for a picker shown in `locale`, in the order of LOCALES. */
export function languageOptions(locale: Locale): LanguageOption[] {
  const local = new Intl.DisplayNames([locale], { type: 'language' })
  const english = new Intl.DisplayNames(['en'], { type: 'language' })
  return LOCALES.map((code) => {
    const name = LANGUAGE_NAMES[code]
    const localName = local.of(code) ?? ''
    return {
      code,
      name,
      hint: foldForSearch(localName) === foldForSearch(name) ? '' : localName,
      words: [name, localName, english.of(code) ?? ''].map(foldForSearch),
    }
  })
}

/** The options whose names contain what was typed; all of them for an empty query. */
export function matchLanguages(options: LanguageOption[], query: string) {
  const folded = foldForSearch(query.trim())
  return folded
    ? options.filter((option) => option.words.some((word) => word.includes(folded)))
    : options
}
