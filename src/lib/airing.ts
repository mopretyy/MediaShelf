import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AiringFeed } from '@shared/types.ts'
import { get, query } from './api'
import { keys, useUser } from './queries'
import { localToday } from './titles'

export const airingKey = ['airing'] as const

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
      return feed
    },
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
