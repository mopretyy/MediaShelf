import { useQuery } from '@tanstack/react-query'
import type { AiringFeed } from '@shared/types.ts'
import { get, query } from './api'
import { useUser } from './queries'
import { localToday } from './titles'

export const airingKey = ['airing'] as const

/** New and upcoming episodes of the shows in the library (see server/library/airing.ts). */
export function useAiring(enabled = true) {
  const user = useUser()
  return useQuery({
    queryKey: airingKey,
    queryFn: ({ signal }) =>
      get<AiringFeed>(`/library/airing${query({ today: localToday() })}`, signal),
    enabled: Boolean(user) && enabled,
    staleTime: 5 * 60_000,
    // Lists refreshing on the server: look again soon, twice at most (a source may be down).
    refetchInterval: (state) =>
      state.state.data?.refreshing && state.state.dataUpdateCount < 3 ? 4_000 : false,
  })
}

/** New episodes waiting across followed shows, for the badge on "Home". */
export function useFreshCount() {
  const { data } = useAiring()
  return data?.fresh.reduce((sum, item) => sum + item.count, 0) ?? 0
}
