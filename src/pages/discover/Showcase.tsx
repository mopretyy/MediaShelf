import { ArrowRight } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import type { Kind, TitleRecord } from '@shared/types.ts'
import { Backdrop } from '@/components/Poster'
import { LibraryButton } from '@/components/StatusControls'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { useCharts } from '@/lib/queries'
import { useSwipe } from '@/lib/swipe'
import {
  formatRating,
  genreList,
  ratingSourceLabel,
  titleHref,
  titleName,
  yearRange,
} from '@/lib/titles'

/** How long a slide stays before the next one, unless paused. */
export const SHOWCASE_INTERVAL = 8000
const SLIDES = 5

/** Popular titles with a backdrop: one kind, or the four kinds taken in turn. */
function useSlides(kind: Kind | 'all'): TitleRecord[] {
  const movie = useCharts('movie', 'trending', kind === 'all' || kind === 'movie')
  const series = useCharts('series', 'trending', kind === 'all' || kind === 'series')
  const anime = useCharts('anime', 'trending', kind === 'all' || kind === 'anime')
  const game = useCharts('game', 'trending', kind === 'all' || kind === 'game')
  const byKind = { movie, series, anime, game }
  const lists = (kind === 'all' ? ['movie', 'series', 'game', 'anime'] : [kind]) as Kind[]
  const data = lists.map((value) => byKind[value].data)
  return useMemo(() => {
    const pools = data.map((pages) =>
      (pages?.pages[0]?.items ?? []).filter((title) => title.backdrop).slice(0, SLIDES),
    )
    const slides: TitleRecord[] = []
    for (
      let index = 0;
      slides.length < SLIDES && pools.some((pool) => index < pool.length);
      index++
    )
      for (const pool of pools) if (pool[index] && slides.length < SLIDES) slides.push(pool[index])
    return slides
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, data)
}

/**
 * The first thing on Discover: a large frame from a popular title, changing every few seconds,
 * with its name, year, genres, rating and the library action. Pauses while the pointer or the
 * focus is inside, when the tab is hidden and for reduced motion. Dark palette, like the heroes.
 */
export function Showcase({ kind }: { kind: Kind | 'all' }) {
  const { t, locale, fmt } = useI18n()
  const slides = useSlides(kind)
  const reduceMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = slides.length
  const current = count ? index % count : 0

  // Restarts with every slide change, so a swiped-to slide gets its full 8 seconds.
  useEffect(() => {
    if (count < 2 || paused || reduceMotion) return
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex((value) => (value + 1) % count)
    }, SHOWCASE_INTERVAL)
    return () => window.clearInterval(timer)
  }, [count, paused, reduceMotion, current])
  // Phones: swipe to the next or previous title.
  const swipe = useSwipe({
    onLeft: () => setIndex((current + 1) % count),
    onRight: () => setIndex((current - 1 + count) % count),
  })

  if (!count) return null
  const title = slides[current]
  const name = titleName(title.names, locale)
  const rating = title.ratings[0]
  const meta = [
    t(`kind.${title.kind}`),
    yearRange(title),
    genreList(title.genres, locale, 2).join(', '),
  ].filter(Boolean)

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t('home.trending')}
      data-testid="showcase"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false)
      }}
      {...(count > 1 ? swipe : {})}
      className="dark relative isolate mt-6 touch-pan-y overflow-hidden rounded-2xl bg-black text-fg"
    >
      {slides.map((slide, slideIndex) => (
        <Backdrop
          key={slide.id}
          src={slide.backdrop}
          className={cn(
            'absolute inset-0 -z-20 size-full object-[center_25%] transition-[opacity,transform] duration-1000 ease-out',
            slideIndex === current ? 'scale-100' : 'scale-[1.04] !opacity-0',
          )}
        />
      ))}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/50 to-black/0" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/20 to-transparent" />

      <div className="flex min-h-[420px] flex-col justify-end gap-6 p-5 sm:p-8 lg:min-h-[480px] lg:p-10">
        <div
          key={title.id}
          className="max-w-2xl animate-rise"
          aria-live={paused ? 'polite' : 'off'}
        >
          <p className="text-sm font-medium text-white/60">
            {t('discover.popularIn', { kind: t(`kinds.${title.kind}`) })}
          </p>
          <h2 className="display mt-1.5 text-4xl text-white break-words sm:text-5xl lg:text-[56px] lg:leading-[60px]">
            <Link
              to={titleHref(title.id)}
              className="rounded-md hover:underline hover:decoration-white/40 hover:underline-offset-8"
            >
              {name}
            </Link>
          </h2>
          <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-md text-white/75">
            {meta.join(' · ')}
            {rating ? (
              <span className="tabular rounded-md bg-white/10 px-1.5 py-0.5 text-sm text-white ring-1 ring-white/15 ring-inset">
                {ratingSourceLabel(rating.source)} {formatRating(rating, fmt)}
              </span>
            ) : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <LibraryButton title={title} size="lg" />
            <Button asChild variant="secondary" size="lg">
              <Link to={titleHref(title.id)}>
                {t('common.open')}
                <ArrowRight />
              </Link>
            </Button>
          </div>
          {count > 1 ? (
            <div className="flex items-center gap-1.5" data-testid="showcase-dots">
              {slides.map((slide, slideIndex) => (
                <button
                  key={slide.id}
                  type="button"
                  aria-label={titleName(slide.names, locale)}
                  aria-current={slideIndex === current ? 'true' : undefined}
                  onClick={() => setIndex(slideIndex)}
                  className="group/dot grid h-10 place-items-center px-1"
                >
                  <span
                    className={cn(
                      'block h-1.5 rounded-full transition-all duration-300',
                      slideIndex === current
                        ? 'w-6 bg-white'
                        : 'w-1.5 bg-white/40 group-hover/dot:bg-white/70',
                    )}
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
