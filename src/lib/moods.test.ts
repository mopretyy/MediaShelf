import { describe, expect, it } from 'vitest'
import type { TitleRecord } from '../../shared/types.ts'
import { isMood, MOODS, moodTitles } from './moods.ts'

function title(id: string, over: Partial<TitleRecord> = {}): TitleRecord {
  return {
    id,
    kind: 'movie',
    names: { original: id },
    year: 2020,
    poster: `https://img/${id}.jpg`,
    backdrop: null,
    genres: [],
    ratings: [],
    externalIds: {},
    ...over,
  }
}

describe('moods', () => {
  it('keeps dark titles out of «cozy» even when they are also comedies', () => {
    expect(MOODS.cozy(title('a', { genres: ['Comedy', 'Family'] }))).toBe(true)
    expect(MOODS.cozy(title('b', { genres: ['Comedy', 'Crime'] }))).toBe(false)
    expect(MOODS.cozy(title('c', { kind: 'game', genres: ['Farming Sim', 'Indie'] }))).toBe(true)
    expect(MOODS.laugh(title('b', { genres: ['Comedy', 'Crime'] }))).toBe(true)
  })

  it('reads «tense», «mind» and «epic» from genres of every kind', () => {
    expect(MOODS.tense(title('a', { kind: 'game', genres: ['Survival Horror'] }))).toBe(true)
    expect(MOODS.mind(title('b', { kind: 'anime', genres: ['Psychological'] }))).toBe(true)
    expect(MOODS.epic(title('c', { kind: 'game', genres: ['Open World', 'RPG'] }))).toBe(true)
    expect(MOODS.epic(title('d', { genres: ['Comedy'] }))).toBe(false)
  })

  it('calls short a film under 1 h 45 min, half-hour episodes and quick games', () => {
    expect(MOODS.short(title('film', { runtime: 98 }))).toBe(true)
    expect(MOODS.short(title('long', { runtime: 169 }))).toBe(false)
    expect(MOODS.short(title('unknown'))).toBe(false)
    expect(MOODS.short(title('sitcom', { kind: 'series', runtime: 22 }))).toBe(true)
    expect(MOODS.short(title('drama', { kind: 'series', runtime: 55 }))).toBe(false)
    expect(MOODS.short(title('puzzle', { kind: 'game', genres: ['Puzzle'] }))).toBe(true)
  })

  it('lists each fitting title once, with a poster, the best of each kind in turns', () => {
    const pool = [
      title('low', { genres: ['Comedy'], ratings: [{ source: 'imdb', value: 6, max: 10 }] }),
      title('no-poster', { genres: ['Comedy'], poster: null }),
      title('high', { genres: ['Comedy'], ratings: [{ source: 'imdb', value: 9, max: 10 }] }),
      title('unrated', { genres: ['Comedy'] }),
      title('high', { genres: ['Comedy'], ratings: [{ source: 'imdb', value: 9, max: 10 }] }),
      title('steam', {
        kind: 'game',
        genres: ['Comedy'],
        ratings: [{ source: 'steam', value: 80, max: 100 }],
      }),
      title('drama', { genres: ['Drama'] }),
    ]
    // Films best first (unrated last), the game taking its turn after the first film.
    expect(moodTitles(pool, 'laugh').map((t) => t.id)).toEqual(['high', 'steam', 'low', 'unrated'])
    const games = [
      title('g1', {
        kind: 'game',
        genres: ['Comedy'],
        ratings: [{ source: 'steam', value: 98, max: 100 }],
      }),
      title('g2', {
        kind: 'game',
        genres: ['Comedy'],
        ratings: [{ source: 'steam', value: 97, max: 100 }],
      }),
      title('m1', { genres: ['Comedy'], ratings: [{ source: 'imdb', value: 8, max: 10 }] }),
    ]
    expect(moodTitles(games, 'laugh').map((t) => t.id)).toEqual(['g1', 'm1', 'g2'])
  })

  it('knows its ids', () => {
    expect(isMood('cozy')).toBe(true)
    expect(isMood('sad')).toBe(false)
    expect(isMood(null)).toBe(false)
  })
})
