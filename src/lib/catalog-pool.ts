import { useMemo } from 'react'
import type { TitleRecord } from '@shared/types.ts'
import { useCharts } from './queries'

/**
 * The popular and all-time charts of every kind, interleaved (a film, a series, a game, an anime,
 * then the next of each): what moods and «similar» pick from. Eight chart queries that the
 * showcase and the kind shelves mostly load anyway, so this costs little.
 */
export function useCatalogPool(enabled = true) {
  const queries = [
    useCharts('movie', 'trending', enabled),
    useCharts('series', 'trending', enabled),
    useCharts('game', 'trending', enabled),
    useCharts('anime', 'trending', enabled),
    useCharts('movie', 'top', enabled),
    useCharts('series', 'top', enabled),
    useCharts('game', 'top', enabled),
    useCharts('anime', 'top', enabled),
  ]
  const lists = queries.map((query) => query.data?.pages[0]?.items)
  const loading = queries.every((query) => query.isLoading)
  const pool = useMemo(() => {
    const out: TitleRecord[] = []
    const longest = Math.max(0, ...lists.map((list) => list?.length ?? 0))
    for (let index = 0; index < longest; index++)
      for (const list of lists) if (list?.[index]) out.push(list[index])
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, lists)
  return { pool, loading }
}
