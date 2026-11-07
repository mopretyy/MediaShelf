import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TitleRecord } from '../../shared/types.ts'
import { forgetRecent, readRecent, rememberTitle } from './recent.ts'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, String(value)),
    removeItem: (key: string) => void data.delete(key),
  }
}

const title = (id: string): TitleRecord => ({
  id,
  kind: 'movie',
  names: { original: id },
  year: 2010,
  poster: null,
  backdrop: null,
  genres: ['Drama'],
  ratings: [],
  externalIds: {},
  descriptions: { en: 'A long description that must not be stored.' },
})

let storage: ReturnType<typeof memoryStorage>

beforeEach(() => {
  storage = memoryStorage()
  vi.stubGlobal('localStorage', storage)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('recent titles', () => {
  it('keeps a separate list per account and for guests', () => {
    rememberTitle(title('movie-tt1375666'), 'alice')
    rememberTitle(title('movie-tt0816692'), 'bob')
    rememberTitle(title('steam-292030'), null)
    expect(readRecent('alice').map((item) => item.id)).toEqual(['movie-tt1375666'])
    expect(readRecent('bob').map((item) => item.id)).toEqual(['movie-tt0816692'])
    expect(readRecent(null).map((item) => item.id)).toEqual(['steam-292030'])
    expect(readRecent('carol')).toEqual([])
  })

  it('moves a reopened title to the front and keeps six', () => {
    for (let index = 0; index < 8; index++) rememberTitle(title(`movie-${index}`), 'alice')
    rememberTitle(title('movie-3'), 'alice')
    expect(readRecent('alice').map((item) => item.id)).toEqual([
      'movie-3',
      'movie-7',
      'movie-6',
      'movie-5',
      'movie-4',
      'movie-2',
    ])
  })

  it('stores only what a palette row needs', () => {
    rememberTitle(title('movie-tt1375666'), 'alice')
    const [stored] = readRecent('alice')
    expect(stored.descriptions).toBeUndefined()
    expect(stored.genres).toEqual([])
  })

  it('drops the old shared list that nobody can attribute', () => {
    storage.setItem('mediashelf:recent-titles', JSON.stringify([title('movie-tt0111161')]))
    expect(readRecent('alice')).toEqual([])
    expect(readRecent(null)).toEqual([])
    rememberTitle(title('movie-tt1375666'), 'alice')
    expect(storage.data.has('mediashelf:recent-titles')).toBe(false)
  })

  it('forgets one owner without touching the others', () => {
    rememberTitle(title('movie-tt1375666'), 'alice')
    rememberTitle(title('steam-292030'), null)
    forgetRecent(null)
    expect(readRecent(null)).toEqual([])
    expect(readRecent('alice')).toHaveLength(1)
    forgetRecent('alice')
    expect(readRecent('alice')).toEqual([])
  })

  it('survives broken or unavailable storage', () => {
    storage.setItem('mediashelf:recent-titles:alice', '{not json')
    expect(readRecent('alice')).toEqual([])
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
      removeItem: () => {
        throw new Error('denied')
      },
    })
    expect(readRecent('alice')).toEqual([])
    expect(() => rememberTitle(title('movie-tt1375666'), 'alice')).not.toThrow()
    expect(() => forgetRecent('alice')).not.toThrow()
  })
})
