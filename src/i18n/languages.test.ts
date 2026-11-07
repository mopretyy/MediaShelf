import { describe, expect, it } from 'vitest'
import { LOCALES } from '../../shared/types.ts'
import { foldForSearch, languageOptions, matchLanguages } from './languages.ts'

const codes = (options: { code: string }[]) => options.map((option) => option.code)

describe('foldForSearch', () => {
  it('ignores case, ё and accents', () => {
    expect(foldForSearch('Română')).toBe('romana')
    expect(foldForSearch('Français')).toBe('francais')
    expect(foldForSearch('Español')).toBe('espanol')
    expect(foldForSearch('Ёлка')).toBe('елка')
  })
})

describe('languageOptions', () => {
  it('lists every locale under its own name, with a hint in the interface language', () => {
    const options = languageOptions('ru')
    expect(codes(options)).toEqual([...LOCALES])
    expect(options.map((option) => option.name)).toEqual([
      'Русский',
      'English',
      'Українська',
      'Deutsch',
      'Español',
      'Français',
      'Română',
    ])
    expect(options.find((option) => option.code === 'de')?.hint).toBe('немецкий')
    expect(languageOptions('en').find((option) => option.code === 'de')?.hint).toBe('German')
  })

  it('leaves out a hint that only repeats the name', () => {
    expect(languageOptions('ru').find((option) => option.code === 'ru')?.hint).toBe('')
    expect(languageOptions('uk').find((option) => option.code === 'uk')?.hint).toBe('')
    expect(languageOptions('en').find((option) => option.code === 'en')?.hint).toBe('')
  })
})

describe('matchLanguages', () => {
  const russian = languageOptions('ru')
  const german = languageOptions('de')

  it('keeps everything for an empty query', () => {
    expect(matchLanguages(russian, '  ')).toHaveLength(LOCALES.length)
  })

  it('finds a language by its own name, without the accents', () => {
    expect(codes(matchLanguages(german, 'francais'))).toEqual(['fr'])
    expect(codes(matchLanguages(german, 'УКРАЇН'))).toEqual(['uk'])
    expect(codes(matchLanguages(german, 'рус'))).toEqual(['ru'])
  })

  it('finds a language by its name in the interface language or in English', () => {
    expect(codes(matchLanguages(russian, 'немец'))).toEqual(['de'])
    expect(codes(matchLanguages(german, 'Rumänisch'))).toEqual(['ro'])
    expect(codes(matchLanguages(german, 'spanish'))).toEqual(['es'])
  })

  it('finds nothing for something that is not a language', () => {
    expect(matchLanguages(russian, 'язык')).toEqual([])
  })
})
