import { useMemo, type ReactNode } from 'react'
import type { Kind } from '@shared/types.ts'
import { useCharts } from '@/lib/queries'
import { Poster } from './Poster'

const ANGLES = [-12, -6, 0, 6, 12]

/**
 * Five popular posters fanned out like a hand of cards: artwork for an empty state, so an empty
 * library looks like an invitation rather than a placeholder. Decorative only.
 */
export function PosterFan({
  kinds = ['movie', 'series', 'game'],
  fallback = null,
}: {
  kinds?: Kind[]
  /** Shown while there are not enough posters (loading, offline catalog). */
  fallback?: ReactNode
}) {
  const first = useCharts(kinds[0] ?? 'movie', 'trending')
  const second = useCharts(kinds[1] ?? 'series', 'trending', kinds.length > 1)
  const third = useCharts(kinds[2] ?? 'game', 'trending', kinds.length > 2)
  const lists = [first.data, second.data, third.data]
  const posters = useMemo(() => {
    const pools = lists.map((data) =>
      (data?.pages[0]?.items ?? []).filter((title) => title.poster).slice(0, 5),
    )
    const out = []
    for (let index = 0; out.length < 5 && pools.some((pool) => index < pool.length); index++)
      for (const pool of pools) if (pool[index] && out.length < 5) out.push(pool[index])
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, lists)
  if (posters.length < 3) return <>{fallback}</>
  return (
    <div aria-hidden="true" className="relative mx-auto mb-6 h-[132px] w-[220px]">
      {posters.map((title, index) => {
        const angle = ANGLES[index + Math.floor((5 - posters.length) / 2)] ?? 0
        return (
          <div
            key={title.id}
            className="absolute bottom-0 left-1/2 w-[76px] origin-bottom animate-rise"
            style={{
              // The middle card on top, the outer ones under it: a symmetric hand.
              zIndex: 10 - Math.abs(index - Math.floor(posters.length / 2)),
              transform: `translateX(-50%) translateX(${angle * 4.5}px) rotate(${angle}deg)`,
              animationDelay: `${index * 50}ms`,
            }}
          >
            <Poster
              src={title.poster}
              alt=""
              kind={title.kind}
              sizes="sm"
              className="shadow-poster"
            />
          </div>
        )
      })}
    </div>
  )
}
