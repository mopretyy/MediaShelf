import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AiringFeed, CalendarFeed } from '@shared/types.ts'
import { get, query } from './api'
import { keys, useUser } from './queries'
import { localToday } from './titles'

export const airingKey = ['airing'] as const

/** Refreshing answers in the current cycle, and when the last answer came. */
let refreshPolls = 0
let lastAnswer = 0
/** Answers further apart than this (a focus refetch, a later visit) start a new cycle. */
const CYCLE_GAP = 10_000
/** A source that stays down keeps `refreshing` on: stop polling after this many answers. */
const MAX_REFRESH_POLLS = 2

/** New and upcoming episodes of the shows in the library (see server/library/airing.ts). */
export function useAiring(enabled = true) {
  const user = useUser()
  const client = useQueryClient()
  return useQuery({
    queryKey: airingKey,
    queryFn: async ({ signal }) => {
      const before = client.getQueryData<AiringFeed>(airingKey)
      const feed = await get<AiringFeed>(`/library/airing${query({ today: localToday() })}`, signal)
      // The server was refreshing episode lists for the previous answer, and storing a list
      // recounts the entries ("next episode", watched of total): read the library again so
      // Continue and the sidebar agree with the new episodes shown here.
      if (before?.refreshing) void client.invalidateQueries({ queryKey: keys.library, exact: true })
      const now = Date.now()
      refreshPolls = !feed.refreshing ? 0 : now - lastAnswer < CYCLE_GAP ? refreshPolls + 1 : 1
      lastAnswer = now
      return feed
    },
    enabled: Boolean(user) && enabled,
    staleTime: 5 * 60_000,
    // Lists refreshing on the server: look again soon, a couple of times per refresh cycle (a
    // source may be down). Counted per cycle, so a tab left open still picks up later refreshes.
    refetchInterval: (state) =>
      state.state.data?.refreshing && refreshPolls <= MAX_REFRESH_POLLS ? 4_000 : false,
  })
}

/** New episodes waiting across followed shows, for the badge on "Home". */
export function useFreshCount() {
  const { data } = useAiring()
  return data?.fresh.reduce((sum, item) => sum + item.count, 0) ?? 0
}

/** Answers that still said `refreshing`, per range: stop asking after a few (a source may be down). */
const calendarPolls = new Map<string, number>()

/** Episodes of followed shows between two days, watched or not (the month calendar). */
export function useCalendar(from: string, to: string) {
  const user = useUser()
  const client = useQueryClient()
  const range = `${from}:${to}`
  return useQuery({
    queryKey: ['calendar', from, to] as const,
    queryFn: async ({ signal }) => {
      const before = client.getQueryData<CalendarFeed>(['calendar', from, to])
      const feed = await get<CalendarFeed>(`/library/calendar${query({ from, to })}`, signal)
      // A refresh stored new lists and recounted entries: the library follows, as for the feed.
      if (before?.refreshing) void client.invalidateQueries({ queryKey: keys.library, exact: true })
      calendarPolls.set(range, feed.refreshing ? (calendarPolls.get(range) ?? 0) + 1 : 0)
      return feed
    },
    enabled: Boolean(user),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    refetchInterval: (state) =>
      state.state.data?.refreshing && (calendarPolls.get(range) ?? 0) <= MAX_REFRESH_POLLS
        ? 4_000
        : false,
  })
}
