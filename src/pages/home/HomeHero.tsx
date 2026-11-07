import { ArrowRight, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { LibraryEntry, TitleRecord } from '@shared/types.ts'
import { Backdrop, Poster } from '@/components/Poster'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ui/misc'
import { useI18n } from '@/i18n'
import { titleHref, titleName } from '@/lib/titles'
import { canMarkNext, useContinueSubtitle, useMarkNextWithToast } from './continue'

/** The picture behind the hero: the backdrop, or the poster blurred into a wash of its colours. */
function HeroPicture({ backdrop, poster }: { backdrop?: string | null; poster?: string | null }) {
  if (backdrop)
    return (
      <Backdrop
        src={backdrop}
        className="absolute inset-0 -z-20 size-full animate-hero-zoom object-[center_25%]"
      />
    )
  if (!poster) return null
  return (
    <img
      src={poster}
      alt=""
      aria-hidden="true"
      decoding="async"
      referrerPolicy="no-referrer"
      className="absolute inset-0 -z-20 size-full scale-125 object-cover opacity-80 blur-3xl"
    />
  )
}

/**
 * The first screen of Home: a frame from what you are watching or playing right now, the
 * greeting over it and the one action that matters next ("+1 episode", or open the title).
 * An empty library gets a frame from what is popular instead. Always the dark palette, like the
 * title hero, so the text stays legible over any picture in either theme.
 */
export function HomeHero({
  greeting,
  summary,
  entry,
  trending,
}: {
  greeting: string
  summary: ReactNode
  /** The title in progress touched last, if any. */
  entry?: LibraryEntry
  /** Shown when there is nothing in progress. */
  trending?: TitleRecord
}) {
  const { t, locale, fmt } = useI18n()
  const subtitle = useContinueSubtitle()
  const markNext = useMarkNextWithToast()
  const title = entry?.title ?? trending
  const kind = entry?.kind ?? trending?.kind
  const name = title ? titleName(title.names, locale) : null
  const id = entry?.titleId ?? trending?.id

  return (
    <section
      aria-labelledby="home-greeting"
      data-testid="home-hero"
      className="dark relative isolate mt-2 overflow-hidden rounded-2xl bg-black text-fg md:mt-4"
    >
      {title ? <HeroPicture backdrop={title.backdrop} poster={title.poster} /> : null}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/55 to-black/5" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/25 to-transparent" />

      <div className="flex min-h-[460px] flex-col justify-end gap-7 p-5 sm:min-h-[420px] sm:p-8 lg:min-h-[460px] lg:p-10">
        <div className="max-w-3xl animate-rise">
          <h1
            id="home-greeting"
            className="display text-[40px] leading-[44px] text-white sm:text-5xl lg:text-[60px] lg:leading-[64px]"
          >
            {greeting}
          </h1>
          <div className="mt-2.5 text-md text-white/70">{summary}</div>
        </div>

        {title && id && kind ? (
          <div
            className="flex animate-rise flex-col gap-5 [animation-delay:90ms] md:flex-row md:items-end md:justify-between"
            data-testid="home-hero-title"
          >
            <Link
              to={titleHref(id)}
              className="group/hero flex min-w-0 items-end gap-4 rounded-lg md:max-w-[60%]"
            >
              <Poster
                src={title.poster}
                alt=""
                kind={kind}
                sizes="sm"
                className="w-16 shrink-0 shadow-poster transition-transform duration-300 group-hover/hero:-translate-y-0.5 sm:w-[76px]"
              />
              <div className="min-w-0 flex-1 pb-0.5">
                <p className="text-sm font-medium text-white/60">
                  {entry ? t('home.continue') : t('home.trending')}
                </p>
                <p className="mt-0.5 truncate text-xl font-semibold tracking-[-0.015em] text-white group-hover/hero:underline group-hover/hero:decoration-white/40 group-hover/hero:underline-offset-4">
                  {name}
                </p>
                {entry ? (
                  <>
                    <p className="mt-0.5 truncate text-sm text-white/75">{subtitle(entry)}</p>
                    <ProgressBar
                      value={entry.progress}
                      tone="white"
                      className="mt-2.5 max-w-[260px]"
                      label={fmt.percent(entry.progress)}
                    />
                  </>
                ) : null}
              </div>
            </Link>

            <div className="flex shrink-0 flex-wrap gap-2">
              {entry && canMarkNext(entry) ? (
                <Button
                  variant="primary"
                  size="lg"
                  loading={markNext.isPending}
                  onClick={() => markNext.mark(entry)}
                  className="max-sm:flex-1"
                >
                  <Plus />
                  {t('home.plusEpisode')}
                </Button>
              ) : (
                <Button asChild variant="primary" size="lg" className="max-sm:flex-1">
                  <Link to={titleHref(id)}>
                    {t('common.open')}
                    <ArrowRight />
                  </Link>
                </Button>
              )}
              <Button asChild variant="secondary" size="lg" className="max-sm:flex-1">
                <Link to={entry ? '/library?status=in_progress' : '/discover'}>
                  {entry ? t('nav.library') : t('nav.discover')}
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}

/** Placeholder of the same size while the library loads, so nothing jumps. */
export function HomeHeroSkeleton({ greeting }: { greeting: string }) {
  return (
    <section
      aria-labelledby="home-greeting"
      className="dark relative isolate mt-2 overflow-hidden rounded-2xl bg-black text-fg md:mt-4"
    >
      <div className="absolute inset-0 -z-10 animate-shimmer bg-white/[0.04]" />
      <div className="flex min-h-[460px] flex-col justify-end p-5 sm:min-h-[420px] sm:p-8 lg:min-h-[460px] lg:p-10">
        <h1
          id="home-greeting"
          className="display text-[40px] leading-[44px] text-white sm:text-5xl lg:text-[60px] lg:leading-[64px]"
        >
          {greeting}
        </h1>
        <div className="mt-3 h-5 w-64 rounded-md bg-white/10" />
      </div>
    </section>
  )
}
