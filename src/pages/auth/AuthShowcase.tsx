import { ChartColumn, Clapperboard, Gamepad2, ListChecks } from 'lucide-react'
import { useMemo, useState, type CSSProperties } from 'react'
import { BrandMark } from '@/app/Brand'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { useCharts } from '@/lib/queries'

interface ShowcasePoster {
  id: string
  src: string
}

/** Trending posters from every catalog, interleaved so neighbours differ in kind. */
function useShowcasePosters(limit: number): ShowcasePoster[] {
  const movie = useCharts('movie', 'trending')
  const game = useCharts('game', 'trending')
  const series = useCharts('series', 'trending')
  const anime = useCharts('anime', 'trending')
  const lists = [movie.data, game.data, series.data, anime.data]

  return useMemo(() => {
    const perKind = lists.map((data) => (data?.pages[0]?.items ?? []).filter((item) => item.poster))
    const seen = new Set<string>()
    const out: ShowcasePoster[] = []
    for (let i = 0; out.length < limit && perKind.some((items) => i < items.length); i++) {
      for (const items of perKind) {
        const item = items[i]
        if (!item?.poster || seen.has(item.id)) continue
        seen.add(item.id)
        out.push({ id: item.id, src: item.poster })
      }
    }
    return out.slice(0, limit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, ...lists])
}

function Tile({ src }: { src?: string }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className="relative aspect-[2/3] w-full shrink-0 overflow-hidden rounded-lg bg-fg/[0.05] ring-1 ring-fg/[0.07] ring-inset">
      {src ? (
        <img
          src={src}
          alt=""
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          onLoad={() => setLoaded(true)}
          className={cn(
            'absolute inset-0 size-full object-cover transition-opacity duration-700 ease-out',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      ) : null}
    </div>
  )
}

/** Splits posters round-robin into columns; empty slots become quiet placeholder tiles. */
function toColumns(posters: ShowcasePoster[], columns: number, perColumn: number) {
  return Array.from({ length: columns }, (_, c) =>
    Array.from({ length: perColumn }, (_, r) => posters[r * columns + c]?.src),
  )
}

/**
 * Right-hand panel of the sign-in screens: a slowly drifting wall of trending posters with the
 * product pitch on top. Always rendered in the dark palette, colour comes only from the posters.
 */
export function AuthShowcase() {
  const { t } = useI18n()
  const posters = useShowcasePosters(28)
  const columns = toColumns(posters, 4, 7)
  const features = [
    { icon: Gamepad2, text: t('auth.showcase.kinds') },
    { icon: ListChecks, text: t('auth.showcase.progress') },
    { icon: ChartColumn, text: t('auth.showcase.stats') },
  ]

  return (
    <div className="dark relative isolate flex h-full flex-col justify-end overflow-hidden rounded-2xl bg-[#0a0a0a] text-fg">
      <div
        aria-hidden="true"
        className="absolute inset-[-12%] -z-10 flex rotate-[-7deg] gap-3 opacity-90"
      >
        {columns.map((tiles, index) => (
          <div key={index} className="flex-1 overflow-visible">
            <div
              className="auth-drift flex flex-col gap-3"
              style={
                {
                  '--drift-duration': `${70 + index * 9}s`,
                  animationDirection: index % 2 ? 'reverse' : 'normal',
                } as CSSProperties
              }
            >
              {[...tiles, ...tiles].map((src, i) => (
                <Tile key={i} src={src} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(10_10_10/0.55)_0%,rgb(10_10_10/0.15)_30%,rgb(10_10_10/0.7)_62%,rgb(10_10_10/0.97)_100%)]"
      />

      <div className="flex items-center gap-2.5 p-8 pb-0 xl:p-10 xl:pb-0">
        <span className="rounded-full bg-black/40 px-3 py-1 text-xs font-medium text-fg-2 ring-1 ring-white/10 backdrop-blur-md ring-inset">
          <Clapperboard className="mr-1.5 -mt-px inline size-3.5" />
          {t('auth.showcase.badge')}
        </span>
      </div>
      <div className="mt-auto max-w-[600px] p-8 xl:p-10">
        <BrandMark className="size-11" />
        <p className="display mt-6 text-4xl text-balance">{t('auth.showcase.title')}</p>
        <p className="mt-3 max-w-[440px] text-md text-fg-2">{t('auth.showcase.text')}</p>
        <ul className="mt-7 grid gap-3">
          {features.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-base text-fg">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] ring-1 ring-white/10 ring-inset">
                <Icon className="size-4 text-fg-2" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Mobile counterpart: one row of posters drifting sideways above the form. */
export function AuthPosterStrip() {
  const posters = useShowcasePosters(12)
  const tiles = Array.from({ length: 12 }, (_, i) => posters[i]?.src)
  return (
    <div aria-hidden="true" className="relative h-[200px] overflow-hidden">
      <div
        className="auth-drift-x flex w-max gap-2.5 pt-16"
        style={{ '--drift-duration': '60s' } as CSSProperties}
      >
        {[...tiles, ...tiles].map((src, i) => (
          <div key={i} className="w-[92px]">
            <Tile src={src} />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,var(--panel)_28%,transparent_45%,var(--panel)_96%)]" />
    </div>
  )
}
