import { describe, expect, it } from 'vitest'
import { LOCALES, type Locale } from '../../shared/types.ts'
import { de } from './de.ts'
import { en } from './en.ts'
import { es } from './es.ts'
import { fr } from './fr.ts'
import { COMPLETE_LOCALES } from './languages.ts'
import { ro } from './ro.ts'
import { ru } from './ru.ts'
import { uk } from './uk.ts'

// ru.ts is the source of truth. Every other dictionary may only hold keys that ru.ts has, with the
// same {placeholders}, and the complete ones must hold all of them. A plural object is one key.

const DICTIONARIES: Record<Locale, object> = { ru, en, uk, de, es, fr, ro }
const PLURAL_FORMS = new Set(['zero', 'one', 'two', 'few', 'many', 'other'])

type Leaf = string | Record<string, string>

function isPlural(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object') return false
  const forms = Object.keys(value)
  return forms.length > 0 && forms.every((form) => PLURAL_FORMS.has(form))
}

/** Dotted key → text or plural object. Anything else ends up as a leaf too, to be reported. */
function flatten(node: object, prefix = '', out = new Map<string, Leaf>()) {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !isPlural(value)) flatten(value, path, out)
    else out.set(path, value)
  }
  return out
}

/** The {names} that translate() fills in, from every form of a plural. */
function placeholders(leaf: Leaf) {
  const texts = typeof leaf === 'string' ? [leaf] : Object.values(leaf)
  const names = texts.flatMap((text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]))
  return [...new Set(names)].sort().join(', ')
}

/** The forms a language picks for whole numbers, plus `other`, which translate() falls back to. */
function pluralForms(locale: Locale) {
  const rules = new Intl.PluralRules(locale)
  const forms = new Set(['other'])
  for (let count = 0; count <= 1000; count++) forms.add(rules.select(count))
  return [...forms]
}

const source = flatten(ru)

describe('i18n dictionaries', () => {
  it('ru and en have the same keys and placeholders', () => {
    const english = flatten(en)
    expect([...english.keys()].sort()).toEqual([...source.keys()].sort())
    const differ = [...source].filter(
      ([key, leaf]) => placeholders(leaf) !== placeholders(english.get(key) ?? ''),
    )
    expect(differ.map(([key]) => key)).toEqual([])
  })

  it.each(LOCALES.filter((locale) => locale !== 'ru'))(
    '%s only has keys from ru.ts, with the same shape and placeholders',
    (locale) => {
      const problems: string[] = []
      for (const [key, leaf] of flatten(DICTIONARIES[locale])) {
        const original = source.get(key)
        if (original === undefined) problems.push(`${key}: not in ru.ts`)
        else if (typeof leaf !== typeof original)
          problems.push(`${key}: ${isPlural(leaf) ? 'plural' : 'text'}, ru.ts has the other kind`)
        else if (placeholders(leaf) !== placeholders(original))
          problems.push(`${key}: {${placeholders(leaf)}}, ru.ts has {${placeholders(original)}}`)
      }
      expect(problems).toEqual([])
    },
  )

  it('lists only real locales as complete, ru and en among them', () => {
    expect(COMPLETE_LOCALES).toEqual(expect.arrayContaining(['ru', 'en']))
    for (const locale of COMPLETE_LOCALES) expect(LOCALES).toContain(locale)
  })

  it.each(COMPLETE_LOCALES)('%s translates every key in ru.ts', (locale) => {
    const keys = flatten(DICTIONARIES[locale])
    expect([...source.keys()].filter((key) => !keys.has(key))).toEqual([])
  })

  it.each(LOCALES)('%s has no empty texts and every plural form it needs', (locale) => {
    const forms = pluralForms(locale)
    const problems: string[] = []
    for (const [key, leaf] of flatten(DICTIONARIES[locale])) {
      if (typeof leaf === 'string') {
        if (!leaf.trim()) problems.push(`${key}: empty`)
      } else if (!isPlural(leaf)) {
        problems.push(`${key}: neither a text nor a plural`)
      } else {
        const missing = forms.filter((form) => !leaf[form]?.trim())
        if (missing.length) problems.push(`${key}: no ${missing.join(', ')}`)
      }
    }
    expect(problems).toEqual([])
  })
})
