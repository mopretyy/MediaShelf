import type {
  AiringEpisode,
  AiringFeed,
  AiringItem,
  CalendarFeed,
  CalendarItem,
  Episode,
  LibraryEntry,
  Status,
} from '../../shared/types.ts'
import { sql, type DB } from '../db/index.ts'
import { listEntries, readEpisodeList } from './entries.ts'

/** Shows count as "new episodes" only when the backlog started this recently. */
export const FRESH_DAYS = 21
/** How far ahead "upcoming" looks. */
export const UPCOMING_DAYS = 30
const MAX_UPCOMING = 60
/** Lists of shows still airing are refreshed this often (same as the title page). */
const AIRING_TTL = 12 * 3_600_000

const FRESH_STATUSES: Status[] = ['in_progress', 'paused', 'completed']
const UPCOMING_STATUSES: Status[] = ['in_progress', 'paused', 'completed', 'planned']

export function isDay(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function addDays(day: string, days: number) {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

const followsEpisodes = (entry: LibraryEntry) => entry.kind === 'series' || entry.kind === 'anime'

function regular(episodes: Episode[]) {
  return episodes
    .filter((episode) => episode.season >= 1)
    .sort((a, b) => a.season - b.season || a.number - b.number)
}

const toAiring = (episode: Episode): AiringEpisode => ({
  season: episode.season,
  number: episode.number,
  name: episode.name,
  airdate: episode.airdate!,
})

function watchedSets(db: DB, userId: string) {
  const rows = sql(
    db,
    `SELECT title_id, season, number FROM episode_marks
     WHERE user_id = ? AND watched_at IS NOT NULL AND season > 0`,
  ).all(userId) as { title_id: string; season: number; number: number }[]
  const sets = new Map<string, Set<string>>()
  for (const row of rows) {
    let set = sets.get(row.title_id)
    if (!set) sets.set(row.title_id, (set = new Set()))
    set.add(`${row.season}:${row.number}`)
  }
  return sets
}

/**
 * The personal episode feed.
 * - fresh: shows you had caught up on (in progress, paused or completed) whose unwatched aired
 *   episodes all came out in the last FRESH_DAYS days. An older backlog is what "Continue" is for.
 * - upcoming: episodes of followed shows (planned too) airing within UPCOMING_DAYS, soonest first.
 */
export function computeAiring(db: DB, userId: string, today: string): AiringFeed {
  const freshSince = addDays(today, -FRESH_DAYS)
  const horizon = addDays(today, UPCOMING_DAYS)
  const watched = watchedSets(db, userId)
  const fresh: (AiringItem & { latest: string })[] = []
  const upcoming: AiringItem[] = []

  for (const entry of listEntries(db, userId)) {
    if (!followsEpisodes(entry) || entry.status === 'dropped') continue
    const stored = readEpisodeList(db, entry.titleId)
    if (!stored) continue
    const episodes = regular(stored.list.seasons.flatMap((season) => season.episodes))
    const seen = watched.get(entry.titleId) ?? new Set<string>()
    const base = {
      titleId: entry.titleId,
      kind: entry.kind,
      status: entry.status,
      title: entry.title,
    }

    if (FRESH_STATUSES.includes(entry.status)) {
      const waiting = episodes.filter(
        (episode) =>
          episode.airdate !== null &&
          episode.airdate <= today &&
          !seen.has(`${episode.season}:${episode.number}`),
      )
      if (waiting.length && waiting[0].airdate! >= freshSince)
        fresh.push({
          ...base,
          episode: toAiring(waiting[0]),
          count: waiting.length,
          latest: waiting[waiting.length - 1].airdate!,
        })
    }

    if (UPCOMING_STATUSES.includes(entry.status))
      for (const episode of episodes)
        if (episode.airdate && episode.airdate > today && episode.airdate <= horizon)
          upcoming.push({ ...base, episode: toAiring(episode), count: 1 })
  }

  fresh.sort((a, b) => b.latest.localeCompare(a.latest) || a.titleId.localeCompare(b.titleId))
  upcoming.sort(
    (a, b) =>
      a.episode.airdate.localeCompare(b.episode.airdate) ||
      a.titleId.localeCompare(b.titleId) ||
      a.episode.season - b.episode.season ||
      a.episode.number - b.episode.number,
  )
  return {
    today,
    fresh: fresh.map(({ latest: _latest, ...item }) => item),
    upcoming: upcoming.slice(0, MAX_UPCOMING),
  }
}

/** The longest span the calendar answers for: six weeks, a month grid with its edges. */
export const CALENDAR_MAX_DAYS = 42
const MAX_CALENDAR_ITEMS = 600

/**
 * Every episode of a followed show (planned, in progress, paused or completed) airing between
 * `from` and `to`, both included, with whether you have seen it: what the month calendar draws.
 */
export function computeCalendar(db: DB, userId: string, from: string, to: string): CalendarFeed {
  const watched = watchedSets(db, userId)
  const items: CalendarItem[] = []
  for (const entry of listEntries(db, userId)) {
    if (!followsEpisodes(entry) || !UPCOMING_STATUSES.includes(entry.status)) continue
    const stored = readEpisodeList(db, entry.titleId)
    if (!stored) continue
    const seen = watched.get(entry.titleId) ?? new Set<string>()
    for (const episode of regular(stored.list.seasons.flatMap((season) => season.episodes)))
      if (episode.airdate && episode.airdate >= from && episode.airdate <= to)
        items.push({
          titleId: entry.titleId,
          kind: entry.kind,
          status: entry.status,
          title: entry.title,
          episode: toAiring(episode),
          count: 1,
          watched: seen.has(`${episode.season}:${episode.number}`),
        })
  }
  items.sort(
    (a, b) =>
      a.episode.airdate.localeCompare(b.episode.airdate) ||
      a.titleId.localeCompare(b.titleId) ||
      a.episode.season - b.episode.season ||
      a.episode.number - b.episode.number,
  )
  return { from, to, items: items.slice(0, MAX_CALENDAR_ITEMS) }
}

/** A title whose refresh was attempted is not attempted again for this long. */
export const REFRESH_RETRY = 30 * 60_000

/**
 * Background refreshes for the feed: picks up to `max` stale titles not attempted recently, so a
 * show without any episode list (announced anime, a source with no list) is not retried on every
 * request and does not keep the other shows from refreshing. `tried` lives with the server.
 */
export function pickRefreshes(
  stale: string[],
  tried: Map<string, number>,
  now = Date.now(),
  max = 4,
) {
  if (tried.size > 5_000)
    for (const [id, at] of tried) if (now - at >= REFRESH_RETRY) tried.delete(id)
  const picked = stale.filter((id) => !(now - (tried.get(id) ?? -Infinity) < REFRESH_RETRY))
  const batch = picked.slice(0, max)
  for (const id of batch) tried.set(id, now)
  return batch
}

/** Followed shows whose episode list is missing or due for a refresh, most recently touched first. */
export function staleEpisodeLists(db: DB, userId: string, now = Date.now()) {
  const ids: string[] = []
  for (const entry of listEntries(db, userId)) {
    if (!followsEpisodes(entry) || !UPCOMING_STATUSES.includes(entry.status)) continue
    const stored = readEpisodeList(db, entry.titleId)
    if (!stored || (stored.list.ended !== true && now - stored.fetchedAt > AIRING_TTL))
      ids.push(entry.titleId)
  }
  return ids
}
