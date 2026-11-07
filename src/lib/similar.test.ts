import { describe, expect, it } from 'vitest'
import type { TitleRecord } from '../../shared/types.ts'
import { similarTitles } from './similar.ts'

function title(id: string, genres: string[], over: Partial<TitleRecord> = {}): TitleRecord {
  return {
    id,
    kind: 'movie',
    names: { original: id },
    year: 2020,
    poster: `https://img/${id}.jpg`,
    backdrop: null,
    genres,
    ratings: [],
    externalIds: {},
    ...over,
  }
}

describe('similarTitles', () => {
  const base = title('base', ['Sci-Fi', 'Drama', 'Adventure'])

  it('keeps to the same kind, shared genres and titles with a poster, never the title itself', () => {
    const pool = [
      base,
      title('close', ['Sci-Fi', 'Drama', 'Adventure']),
      title('half', ['Sci-Fi', 'Drama', 'Romance']),
      title('one', ['Drama', 'Crime']),
      title('game', ['Sci-Fi', 'Drama', 'Adventure'], { kind: 'game' }),
      title('blank', ['Sci-Fi', 'Drama'], { poster: null }),
    ]
    expect(similarTitles(base, pool).map((t) => t.id)).toEqual(['close', 'half'])
  })

  it('ranks by genres in common, then by rating, and stops at the limit', () => {
    const pool = [
      title('low', ['Sci-Fi', 'Drama'], { ratings: [{ source: 'imdb', value: 6, max: 10 }] }),
      title('high', ['Sci-Fi', 'Drama'], { ratings: [{ source: 'imdb', value: 9, max: 10 }] }),
      title('best', ['Sci-Fi', 'Drama', 'Adventure', 'Space']),
      title('low', ['Sci-Fi', 'Drama']),
    ]
    expect(similarTitles(base, pool).map((t) => t.id)).toEqual(['best', 'high', 'low'])
    expect(similarTitles(base, pool, 2)).toHaveLength(2)
  })

  it('needs one shared genre when the title has few, and nothing without genres', () => {
    const short = title('short', ['Comedy'])
    expect(similarTitles(short, [title('fun', ['Comedy', 'Family'])]).map((t) => t.id)).toEqual([
      'fun',
    ])
    expect(similarTitles(title('none', []), [title('fun', ['Comedy'])])).toEqual([])
  })
})
