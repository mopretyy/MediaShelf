import { useMemo } from 'react'
import type { LibraryEntry } from '@shared/types.ts'
import { useEpisodeList, useEpisodeMarks } from '@/lib/queries'
import { episodeProgress, shownEpisodeProgress } from './episode-progress'

/**
 * Where the viewer is in a series, as every part of the title page shows it: worked out from the
 * episode list and the marks, which the cached entry can lag behind (the server recounts it when
 * a list arrives). The queries are shared, so each caller costs no extra request, and the
 * episode list and the entry panel can never disagree.
 */
export function useEpisodeProgress(titleId: string, entry: LibraryEntry | null) {
  const list = useEpisodeList(titleId, true)
  const marks = useEpisodeMarks(titleId, Boolean(entry))
  const counted = useMemo(
    () => (list.data && marks.data ? episodeProgress(list.data, marks.data) : null),
    [list.data, marks.data],
  )
  return { list, marks, ...shownEpisodeProgress(entry, counted, marks.isPending) }
}
