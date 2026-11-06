import { describe, expect, it } from 'vitest'
import type { EpisodeList } from '../../shared/types.ts'
import { registerAccount, testApp } from '../test-utils.ts'
import { addDays, isDay } from './airing.ts'
import { storeEpisodeList } from './entries.ts'

const TODAY = '2026-11-06'
const SERIES = 'series-tt0903747'

/** Season 1: five episodes a week apart, the last two in the future. */
function weekly(firstAirdate: string, count = 5, ended = false): EpisodeList {
  return {
    source: 'tvmaze',
    ended,
    seasons: [
      {
        number: 1,
        episodes: Array.from({ length: count }, (_, i) => ({
          season: 1,
          number: i + 1,
          name: `Episode ${i + 1}`,
          airdate: addDays(firstAirdate, i * 7),
          runtime: 50,
        })),
      },
    ],
  }
}

async function follow(list: EpisodeList, watched: number[], status?: string) {
  const t = testApp()
  await registerAccount(t, { name: 'Аня', email: 'anya@example.com', password: 'correct horse 42' })
  await t.request('POST', '/api/library', { titleId: SERIES })
  // A fetched_at in the future keeps the route from replacing the list with the catalog's.
  storeEpisodeList(t.db, SERIES, list)
  t.db.prepare('UPDATE episode_lists SET fetched_at = ? WHERE title_id = ?').run(Date.now(), SERIES)
  if (watched.length)
    await t.request('POST', `/api/library/${SERIES}/episodes`, {
      episodes: watched.map((number) => ({ season: 1, number })),
      watched: true,
    })
  if (status) await t.request('PATCH', `/api/library/${SERIES}`, { status })
  return t
}

describe('airing feed', () => {
  it('reports fresh episodes of a show you had caught up on, and what airs next', async () => {
    // Episodes air on Oct 23, Oct 30, Nov 6 (today), Nov 13, Nov 20.
    const t = await follow(weekly('2026-10-23'), [1])
    const res = await t.request('GET', `/api/library/airing?today=${TODAY}`)
    expect(res.status).toBe(200)
    expect(res.body.today).toBe(TODAY)
    expect(res.body.fresh).toHaveLength(1)
    expect(res.body.fresh[0]).toMatchObject({
      titleId: SERIES,
      count: 2,
      episode: { season: 1, number: 2, airdate: '2026-10-30' },
    })
    expect(
      res.body.upcoming.map((item: { episode: { number: number } }) => item.episode.number),
    ).toEqual([4, 5])
  })

  it('leaves an old backlog to "Continue" instead of calling it new', async () => {
    // Everything aired months ago; the user is still at episode 1.
    const t = await follow(weekly('2026-06-01', 5, true), [1])
    const res = await t.request('GET', `/api/library/airing?today=${TODAY}`)
    expect(res.body.fresh).toEqual([])
    expect(res.body.upcoming).toEqual([])
  })

  it('shows upcoming episodes for planned shows but nothing for dropped ones', async () => {
    const planned = await follow(weekly('2026-11-10'), [])
    const res = await planned.request('GET', `/api/library/airing?today=${TODAY}`)
    expect(res.body.fresh).toEqual([])
    // Nov 10, 17, 24 and Dec 1; Dec 8 is past the 30-day horizon.
    expect(res.body.upcoming).toHaveLength(4)
    expect(res.body.upcoming[0]).toMatchObject({ status: 'planned', episode: { number: 1 } })

    const dropped = await follow(weekly('2026-10-23'), [1], 'dropped')
    const none = await dropped.request('GET', `/api/library/airing?today=${TODAY}`)
    expect(none.body).toMatchObject({ fresh: [], upcoming: [] })
  })

  it('validates the day parameter', () => {
    expect(isDay('2026-11-06')).toBe(true)
    expect(isDay('2026-02-30')).toBe(false)
    expect(isDay('06.11.2026')).toBe(false)
    expect(isDay(undefined)).toBe(false)
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
  })
})
