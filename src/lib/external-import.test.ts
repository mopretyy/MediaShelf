import { describe, expect, it } from 'vitest'
import {
  convertExternal,
  convertImdbCsv,
  convertMalXml,
  parseCsv,
  toImportPayload,
} from './external-import.ts'

const MAL = `<?xml version="1.0" encoding="UTF-8" ?>
<myanimelist>
  <myinfo><user_export_type>1</user_export_type></myinfo>
  <anime>
    <series_animedb_id>1535</series_animedb_id>
    <series_title><![CDATA[Death Note]]></series_title>
    <series_type>TV</series_type>
    <series_episodes>37</series_episodes>
    <my_watched_episodes>37</my_watched_episodes>
    <my_start_date>2021-01-10</my_start_date>
    <my_finish_date>2021-02-01</my_finish_date>
    <my_score>9</my_score>
    <my_status>Completed</my_status>
    <my_comments><![CDATA[L & Light]]></my_comments>
  </anime>
  <anime>
    <series_animedb_id>52991</series_animedb_id>
    <series_title>Sousou no Frieren &amp; friends</series_title>
    <series_episodes>28</series_episodes>
    <my_watched_episodes>5</my_watched_episodes>
    <my_start_date>0000-00-00</my_start_date>
    <my_finish_date>0000-00-00</my_finish_date>
    <my_score>0</my_score>
    <my_status>Watching</my_status>
  </anime>
  <anime>
    <series_animedb_id>16498</series_animedb_id>
    <series_title>Shingeki no Kyojin</series_title>
    <series_episodes>25</series_episodes>
    <my_watched_episodes>0</my_watched_episodes>
    <my_status>6</my_status>
  </anime>
  <anime>
    <series_animedb_id>1</series_animedb_id>
    <series_title>Cowboy Bebop</series_title>
    <my_status>Rewatching later maybe</my_status>
  </anime>
</myanimelist>`

const RATINGS = [
  'Const,Your Rating,Date Rated,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors',
  'tt1375666,9,2024-05-02,Inception,Inception,https://www.imdb.com/title/tt1375666/,Movie,8.8,148,2010,"Action, Adventure, Sci-Fi",2500000,2010-07-08,Christopher Nolan',
  'tt0903747,10,2023-11-20,Breaking Bad,Breaking Bad,https://www.imdb.com/title/tt0903747/,TV Series,9.5,45,2008,"Crime, Drama, Thriller",2100000,2008-01-20,',
  'tt0959621,10,2023-11-21,"Pilot, Part ""One""",Pilot,https://www.imdb.com/title/tt0959621/,TV Episode,9.0,58,2008,Drama,40000,2008-01-20,Vince Gilligan',
  'tt1234567,8,2022-01-01,Some Game,Some Game,https://www.imdb.com/title/tt1234567/,Video Game,8.0,,2020,Action,100,,',
].join('\r\n')

const WATCHLIST = [
  'Position,Const,Created,Modified,Description,Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors',
  '1,tt0816692,2025-02-03,2025-02-03,,Interstellar,https://www.imdb.com/title/tt0816692/,movie,8.7,169,2014,"Adventure, Drama, Sci-Fi",2000000,2014-10-26,Christopher Nolan',
  '2,tt0816692,2025-02-04,2025-02-04,,Interstellar,https://www.imdb.com/title/tt0816692/,movie,8.7,169,2014,,2000000,2014-10-26,',
].join('\n')

describe('MyAnimeList / Shikimori XML', () => {
  it('maps statuses, scores, dates, notes and watched episodes', () => {
    const file = convertMalXml(MAL, '2026-11-06T10:00:00.000Z')
    expect(file.source).toBe('mal')
    expect(file.skipped).toBe(1)
    const [deathNote, frieren, aot] = file.entries
    expect(deathNote).toMatchObject({
      titleId: 'anime-1535',
      status: 'completed',
      rating: 9,
      notes: 'L & Light',
      startedAt: '2021-01-10T12:00:00.000Z',
      finishedAt: '2021-02-01T12:00:00.000Z',
      progress: 100,
      title: { kind: 'anime', names: { original: 'Death Note' }, episodes: 37 },
    })
    expect(deathNote.title.poster).toBe('https://shikimori.io/system/animes/original/1535.jpg')
    expect(deathNote.episodes).toHaveLength(37)
    expect(deathNote.episodes[36]).toMatchObject({ season: 1, number: 37 })
    expect(frieren).toMatchObject({
      status: 'in_progress',
      rating: null,
      startedAt: null,
      progress: 18,
      title: { names: { original: 'Sousou no Frieren & friends' } },
    })
    expect(frieren.episodes.map((e) => e.watchedAt)).toEqual(
      Array(5).fill('2026-11-06T10:00:00.000Z'),
    )
    expect(aot).toMatchObject({ status: 'planned', episodes: [] })
  })
})

describe('IMDb CSV', () => {
  it('parses quoted fields with commas, quotes and CRLF', () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\n1,2,3\r\n')).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['1', '2', '3'],
    ])
  })

  it('turns ratings into watched movies and series, skipping episodes and games', () => {
    const file = convertImdbCsv(RATINGS)
    expect(file.source).toBe('imdb-ratings')
    expect(file.skipped).toBe(2)
    expect(file.entries.map((entry) => entry.titleId)).toEqual([
      'movie-tt1375666',
      'series-tt0903747',
    ])
    expect(file.entries[0]).toMatchObject({
      status: 'completed',
      rating: 9,
      finishedAt: '2024-05-02T12:00:00.000Z',
      progress: 100,
      title: {
        year: 2010,
        runtime: 148,
        genres: ['Action', 'Adventure', 'Sci-Fi'],
        poster: 'https://images.metahub.space/poster/medium/tt1375666/img',
        externalIds: { imdb: 'tt1375666' },
      },
    })
    expect(file.entries[1]).toMatchObject({ status: 'completed', rating: 10, progress: 0 })
  })

  it('turns the watchlist into plans, once per title', () => {
    const file = convertImdbCsv(WATCHLIST)
    expect(file.source).toBe('imdb-watchlist')
    expect(file.entries).toHaveLength(1)
    expect(file.entries[0]).toMatchObject({
      titleId: 'movie-tt0816692',
      status: 'planned',
      rating: null,
      addedAt: '2025-02-03T12:00:00.000Z',
    })
  })
})

describe('detection and payload', () => {
  it('detects the format and leaves out titles already in the library', () => {
    expect(convertExternal('{"format":"mediashelf"}')).toBeNull()
    const file = convertExternal(RATINGS)!
    const { payload, existing } = toImportPayload(file, new Set(['movie-tt1375666']))
    expect(existing).toBe(1)
    expect(payload).toMatchObject({ format: 'mediashelf', version: 4 })
    expect(payload.entries.map((entry) => entry.titleId)).toEqual(['series-tt0903747'])
    expect(convertExternal(MAL)?.source).toBe('mal')
  })
})
