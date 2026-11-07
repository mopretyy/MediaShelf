import { describe, expect, it } from 'vitest'
import type { EpisodeList, EpisodeMark } from '../../../shared/types.ts'
import { episodeProgress, shownEpisodeProgress } from './episode-progress.ts'

const episode = (season: number, number: number, airdate: string | null = '2020-01-01') => ({
  season,
  number,
  name: `S${season}E${number}`,
  airdate,
  runtime: 45,
})

// Seasons deliberately out of order, with specials first, as some sources send them.
const list: EpisodeList = {
  source: 'tvmaze',
  ended: false,
  seasons: [
    { number: 2, episodes: [episode(2, 2, '2030-01-08'), episode(2, 1)] },
    { number: 0, episodes: [episode(0, 1)] },
    { number: 1, episodes: [episode(1, 1), episode(1, 2), episode(1, 3)] },
  ],
}

const watched = (season: number, number: number): EpisodeMark => ({
  season,
  number,
  watchedAt: '2026-01-01T12:00:00.000Z',
  rating: null,
  note: '',
})

describe('episodeProgress', () => {
  it('starts at the first episode of a series nobody has marked yet', () => {
    expect(episodeProgress(list, [])).toEqual({
      watched: 0,
      total: 5,
      percent: 0,
      next: { season: 1, number: 1, name: 'S1E1', airdate: '2020-01-01' },
    })
  })

  it('counts regular episodes only and picks the first one left, in airing order', () => {
    const marks = [watched(0, 1), watched(1, 1), watched(1, 3)]
    expect(episodeProgress(list, marks)).toMatchObject({
      watched: 2,
      total: 5,
      percent: 40,
      next: { season: 1, number: 2 },
    })
  })

  it('ignores marks that only carry a note or a rating', () => {
    const noteOnly: EpisodeMark = { ...watched(1, 1), watchedAt: null, note: 'Great pilot' }
    expect(episodeProgress(list, [noteOnly])).toMatchObject({
      watched: 0,
      next: { season: 1, number: 1 },
    })
  })

  it('offers an episode that has not aired yet as next: the page shows when it airs', () => {
    const marks = [watched(1, 1), watched(1, 2), watched(1, 3), watched(2, 1)]
    expect(episodeProgress(list, marks)).toMatchObject({
      watched: 4,
      percent: 80,
      next: { season: 2, number: 2, airdate: '2030-01-08' },
    })
  })

  it('has nothing next once every regular episode is watched', () => {
    const marks = [watched(1, 1), watched(1, 2), watched(1, 3), watched(2, 1), watched(2, 2)]
    expect(episodeProgress(list, marks)).toMatchObject({ watched: 5, percent: 100, next: null })
  })

  it('gives up without regular episodes, so the caller keeps the saved numbers', () => {
    const specials: EpisodeList = { ...list, seasons: [{ number: 0, episodes: [episode(0, 1)] }] }
    expect(episodeProgress(specials, [watched(0, 1)])).toBeNull()
    expect(episodeProgress({ ...list, seasons: [] }, [])).toBeNull()
  })
})

describe('shownEpisodeProgress', () => {
  // Saved counters that lag behind the list and the marks.
  const saved = {
    status: 'in_progress' as const,
    progress: 7,
    watchedEpisodes: 7,
    totalEpisodes: 99,
    nextEpisode: { season: 3, number: 1, name: null, airdate: null },
  }
  const counted = episodeProgress(list, [watched(1, 1), watched(1, 2)])

  it('shows what the list and the marks say once both are in', () => {
    expect(shownEpisodeProgress(saved, counted, false)).toEqual({
      watched: 2,
      total: 5,
      percent: 40,
      next: { season: 1, number: 3, name: 'S1E3', airdate: '2020-01-01' },
      unsure: false,
    })
  })

  it("stands in with the entry's counters until then, unsure of its next episode", () => {
    expect(shownEpisodeProgress(saved, null, true)).toEqual({
      watched: 7,
      total: 99,
      percent: 7,
      next: saved.nextEpisode,
      unsure: true,
    })
    // Marks that failed to load leave nothing better, but nothing to wait for either.
    expect(shownEpisodeProgress(saved, null, false).unsure).toBe(false)
  })

  it('reads 100 % for a completed series even when new episodes came out', () => {
    expect(shownEpisodeProgress({ ...saved, status: 'completed' }, counted, false)).toMatchObject({
      watched: 2,
      total: 5,
      percent: 100,
    })
  })

  it('has nothing watched without an entry, whatever the cache holds', () => {
    expect(shownEpisodeProgress(null, counted, false)).toEqual({
      watched: 0,
      total: null,
      percent: 0,
      next: null,
      unsure: false,
    })
  })
})
