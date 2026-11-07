// Relative import (not @shared): unit tests type-check this file under tsconfig.node.json,
// which has no path aliases.
import type { EpisodeList, EpisodeMark, LibraryEntry, NextEpisode } from '../../../shared/types.ts'

export interface EpisodeProgress {
  /** Regular episodes (season 1 and later) marked as watched. */
  watched: number
  /** Regular episodes in the list, aired or not. */
  total: number
  /** 0–100, as the server rounds it. */
  percent: number
  /** The first regular episode not watched yet, aired or not; null once every one is. */
  next: NextEpisode | null
}

/**
 * Where the viewer is in a series, worked out from its episode list and their marks with the
 * rules the server uses for the saved counters (recomputeEpisodes in server/library/entries.ts).
 * The page has both at hand, so this never lags behind a mark or a list that just loaded,
 * unlike the cached entry. Specials (season 0) don't count. Null without regular episodes:
 * there is nothing to count, so the caller keeps the entry's own numbers.
 */
export function episodeProgress(
  list: EpisodeList,
  marks: readonly EpisodeMark[],
): EpisodeProgress | null {
  const key = (e: { season: number; number: number }) => `${e.season}:${e.number}`
  const seen = new Set(marks.filter((mark) => mark.watchedAt).map(key))
  const regular = list.seasons
    .filter((season) => season.number >= 1)
    .flatMap((season) => season.episodes)
    .sort((a, b) => a.season - b.season || a.number - b.number)
  if (!regular.length) return null
  const watched = regular.filter((episode) => seen.has(key(episode))).length
  const upcoming = regular.find((episode) => !seen.has(key(episode)))
  return {
    watched,
    total: regular.length,
    percent: Math.min(100, Math.round((watched / regular.length) * 100)),
    next: upcoming
      ? {
          season: upcoming.season,
          number: upcoming.number,
          name: upcoming.name,
          airdate: upcoming.airdate,
        }
      : null,
  }
}

export interface ShownEpisodeProgress {
  watched: number
  /** Null when neither the list nor the saved entry knows how many episodes there are. */
  total: number | null
  percent: number
  next: NextEpisode | null
  /** The saved entry is standing in while the marks load: its "nothing next" may be stale. */
  unsure: boolean
}

type SavedCounters = Pick<
  LibraryEntry,
  'status' | 'progress' | 'watchedEpisodes' | 'totalEpisodes' | 'nextEpisode'
>

/**
 * The one set of numbers a title page shows for a series, wherever it shows them: counted from
 * the list and the marks once both are in (`counted`), the saved entry's counters until then.
 * A completed entry reads 100 % even if the source has since added episodes. Nothing is
 * watched without an entry.
 */
export function shownEpisodeProgress(
  entry: SavedCounters | null,
  counted: EpisodeProgress | null,
  marksLoading: boolean,
): ShownEpisodeProgress {
  const live = entry && counted
  return {
    watched: live ? live.watched : (entry?.watchedEpisodes ?? 0),
    total: live ? live.total : (entry?.totalEpisodes ?? null),
    percent: entry?.status === 'completed' ? 100 : live ? live.percent : (entry?.progress ?? 0),
    next: live ? live.next : (entry?.nextEpisode ?? null),
    unsure: Boolean(entry) && !live && marksLoading,
  }
}
