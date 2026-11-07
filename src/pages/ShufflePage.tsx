import {
  CloudOff,
  Dices,
  ExternalLink,
  LibraryBig,
  ListFilter,
  LogIn,
  Play,
  Plus,
  RotateCw,
} from 'lucide-react'
import { useAnimate, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { KINDS, type Kind, type Status, type TitleRecord } from '@shared/types.ts'
import { PageBody, PageHeader } from '@/app/PageHeader'
import { Poster } from '@/components/Poster'
import { StatusIcon } from '@/components/StatusIcon'
import { useLibraryActions } from '@/components/library-actions'
import { Button } from '@/components/ui/button'
import { Chip, EmptyIcon, EmptyState, Kbd, Skeleton, Switch } from '@/components/ui/misc'
import { PosterFan } from '@/components/PosterFan'
import { Segmented } from '@/components/ui/segmented'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { useDocumentTitle, useHotkey } from '@/lib/hooks'
import { useCharts, useLibrary, useLibraryMap, useSession } from '@/lib/queries'
import {
  formatRating,
  genreList,
  ratingSourceLabel,
  statusLabelKey,
  titleHref,
  titleName,
  yearRange,
} from '@/lib/titles'
import {
  cardUnderFrame,
  createReelSound,
  readSoundSetting,
  writeSoundSetting,
} from './shuffle-sound'
import { buildStrip } from './shuffle-reel'

type Source = 'library' | 'catalog'
const LIBRARY_STATUSES: Status[] = ['planned', 'paused', 'in_progress']
const HISTORY_KEY = 'mediashelf:shuffle-history'
const PREFS_KEY = 'mediashelf:shuffle-prefs'
const WINNER_INDEX = 32

interface HistoryItem {
  id: string
  kind: Kind
  names: TitleRecord['names']
  poster: string | null
}

function readHistory(): HistoryItem[] {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
    return Array.isArray(value) ? value.slice(0, 8) : []
  } catch {
    return []
  }
}

function readPrefs(): { source: Source | null; kinds: Kind[]; statuses: Status[] } {
  try {
    const value = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}')
    const kinds = Array.isArray(value.kinds)
      ? (value.kinds as unknown[]).filter((k): k is Kind => KINDS.includes(k as Kind))
      : [...KINDS]
    const statuses: Status[] = Array.isArray(value.statuses)
      ? (value.statuses as unknown[]).filter((s): s is Status =>
          LIBRARY_STATUSES.includes(s as Status),
        )
      : ['planned']
    const source: Source | null =
      value.source === 'library' || value.source === 'catalog' ? value.source : null
    return {
      source,
      kinds: kinds.length ? kinds : [...KINDS],
      statuses: statuses.length ? statuses : ['planned'],
    }
  } catch {
    return { source: null, kinds: [...KINDS], statuses: ['planned'] }
  }
}

function useCatalogPool(kinds: Kind[], enabled: boolean) {
  const game = useCharts('game', 'trending', enabled && kinds.includes('game'))
  const movie = useCharts('movie', 'trending', enabled && kinds.includes('movie'))
  const series = useCharts('series', 'trending', enabled && kinds.includes('series'))
  const anime = useCharts('anime', 'trending', enabled && kinds.includes('anime'))
  const queries = { game, movie, series, anime }
  const loading = kinds.some((kind) => queries[kind].isLoading)
  const items = kinds.flatMap((kind) => queries[kind].data?.pages[0]?.items ?? [])
  const retry = () => kinds.forEach((kind) => void queries[kind].refetch())
  return { items, loading, retry }
}

const pickRandom = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)]

export default function ShufflePage() {
  const { t, locale, fmt } = useI18n()
  const { user, isLoading: sessionLoading } = useSession()
  const library = useLibrary()
  const libraryMap = useLibraryMap()
  const actions = useLibraryActions()
  const reduceMotion = useReducedMotion()
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const viewport = useRef<HTMLDivElement>(null)
  useDocumentTitle(t('shuffle.title'))

  const hasLibrary = Boolean(user && library.data?.length)
  const [params] = useSearchParams()
  const [prefs] = useState(readPrefs)
  // A link may ask for a source (Home's «from your plans» card); otherwise the last choice.
  const [sourceChoice, setSource] = useState<Source | null>(() => {
    const requested = params.get('source')
    return requested === 'library' || requested === 'catalog' ? requested : prefs.source
  })
  const [kinds, setKinds] = useState<Kind[]>(prefs.kinds)
  const [statuses, setStatuses] = useState<Status[]>(prefs.statuses)
  // With no choice made yet: your own plans when there are any to pick from (that is what the
  // feature is for), popular titles otherwise, so it works with an empty library too.
  const hasCandidates = Boolean(
    user &&
    library.data?.some((entry) => kinds.includes(entry.kind) && statuses.includes(entry.status)),
  )
  const source: Source = sourceChoice ?? (hasCandidates ? 'library' : 'catalog')
  // Until the library arrives (after the session, on a fresh load) neither the default source nor
  // the library pool is known: the reel waits in its idle state instead of flashing «nothing to
  // pick», «sign in» or the wrong source.
  const libraryLoading = sessionLoading || library.isLoading
  const deciding = sourceChoice === null && libraryLoading
  const [reel, setReel] = useState<TitleRecord[]>([])
  const [rolling, setRolling] = useState(false)
  const [result, setResult] = useState<TitleRecord | null>(null)
  // Clicks of the reel and a buzz on the result: off unless turned on (kept on this device).
  const [sound, setSound] = useState(readSoundSetting)
  const [history, setHistory] = useState<HistoryItem[]>(readHistory)
  // «Бросить по популярному» switches the source, then rolls once those titles are in.
  const [rollWhenReady, setRollWhenReady] = useState(false)
  // Bumped whenever a spin becomes obsolete (e.g. the source changed mid-spin).
  const rollId = useRef(0)

  // Remember the setup so coming back keeps source, kinds and statuses.
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ source: sourceChoice, kinds, statuses }))
    } catch {
      /* ignore */
    }
  }, [sourceChoice, kinds, statuses])

  const catalog = useCatalogPool(kinds, source === 'catalog')
  const pool = useMemo(() => {
    if (source === 'catalog') {
      const seen = new Set<string>()
      return catalog.items.filter((item) => !seen.has(item.id) && seen.add(item.id))
    }
    return (library.data ?? [])
      .filter((entry) => kinds.includes(entry.kind) && statuses.includes(entry.status))
      .map((entry) => entry.title)
  }, [source, catalog.items, library.data, kinds, statuses])

  const poolLoading = deciding || (source === 'library' ? libraryLoading : catalog.loading)

  const toggle = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value]

  const switchSource = (value: Source) => {
    rollId.current++
    setSource(value)
    setReel([])
    setResult(null)
    setRollWhenReady(false)
  }

  const step = () => {
    const first = scope.current?.firstElementChild as HTMLElement | null
    if (!first) return 172
    const gap = parseFloat(getComputedStyle(scope.current!).columnGap || '16') || 16
    return first.offsetWidth + gap
  }

  const roll = async () => {
    // Not while the pool is still loading: Space would roll whatever happens to be there.
    if (rolling || poolLoading || !pool.length) return
    const candidates =
      pool.length > 1 && result ? pool.filter((item) => item.id !== result.id) : pool
    const winner = pickRandom(candidates)
    const id = ++rollId.current
    const strip = buildStrip(pool, winner, WINNER_INDEX + 6, WINNER_INDEX)
    setResult(null)
    setReel(strip)
    setRolling(true)
    // Fly back up to the reel before it starts spinning; the result card
    // scrolls back into view once the reel stops.
    viewport.current?.scrollIntoView({
      block: 'center',
      behavior: reduceMotion ? 'auto' : 'smooth',
    })
    await new Promise((resolve) => requestAnimationFrame(resolve))
    const width = viewport.current?.clientWidth ?? 0
    const itemWidth = (scope.current?.firstElementChild as HTMLElement | null)?.offsetWidth ?? 156
    const cardStep = step()
    const target = -(WINNER_INDEX * cardStep) + width / 2 - itemWidth / 2
    // Made here, inside the click or key press, where browsers let a page start sound.
    const audio = sound ? createReelSound() : null
    if (reduceMotion) {
      await animate(scope.current, { x: target }, { duration: 0 })
    } else {
      const start = width / 2 - itemWidth / 2
      let frame = 0
      let card = 0
      // A click each time a card passes the frame: read the reel's offset every frame.
      const listen = () => {
        const element = scope.current
        if (!element || !audio) return
        const x = new DOMMatrixReadOnly(getComputedStyle(element).transform).m41
        const now = cardUnderFrame(start, x, cardStep)
        if (now !== card) {
          card = now
          audio.tick()
        }
        frame = requestAnimationFrame(listen)
      }
      if (audio) frame = requestAnimationFrame(listen)
      await animate(
        scope.current,
        { x: [start, target] },
        { duration: 2.6, ease: [0.12, 0.72, 0.12, 1] },
      )
      cancelAnimationFrame(frame)
    }
    setRolling(false)
    // The pool changed while spinning: this winner no longer belongs to it.
    if (rollId.current !== id) return
    audio?.land()
    setResult(winner)
    const item: HistoryItem = {
      id: winner.id,
      kind: winner.kind,
      names: winner.names,
      poster: winner.poster,
    }
    setHistory((current) => {
      const next = [item, ...current.filter((entry) => entry.id !== winner.id)].slice(0, 8)
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  useEffect(() => {
    if (!rollWhenReady || poolLoading) return
    setRollWhenReady(false)
    void roll()
    // roll is a new closure on every render; this only has to run once the pool is in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollWhenReady, poolLoading])

  useHotkey(' ', (event) => {
    // Space keeps its native meaning on focused controls.
    if (event.target instanceof Element && event.target.closest('button, a, [role], summary'))
      return
    event.preventDefault()
    void roll()
  })

  // Re-centre the landed reel when the viewport changes size.
  useEffect(() => {
    const element = viewport.current
    if (!element || !reel.length) return
    const observer = new ResizeObserver(() => {
      if (rolling || !scope.current) return
      const itemWidth = (scope.current.firstElementChild as HTMLElement | null)?.offsetWidth ?? 156
      scope.current.style.transform = `translateX(${-(WINNER_INDEX * step()) + element.clientWidth / 2 - itemWidth / 2}px)`
    })
    observer.observe(element)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reel, rolling])

  const entry = result ? libraryMap.get(result.id) : undefined
  const idle = !reel.length
  const landed = Boolean(result) && !rolling
  const preview = idle ? pool.slice(0, 7) : reel

  // The result card sits below the reel; bring it into view once the reel stops.
  const resultCard = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!result || rolling) return
    resultCard.current?.scrollIntoView({
      block: 'nearest',
      behavior: reduceMotion ? 'auto' : 'smooth',
    })
  }, [result, rolling, reduceMotion])
  // Nothing to pick: the reel and its frame give way to an empty state that says how to fix it.
  const empty = !poolLoading && !rolling && !pool.length
  const rollPopular = (
    <Button
      variant="primary"
      onClick={() => {
        switchSource('catalog')
        setRollWhenReady(true)
      }}
    >
      <Dices />
      {t('shuffle.rollPopular')}
    </Button>
  )
  const clearFilters = (
    <Button
      variant="secondary"
      onClick={() => {
        setKinds([...KINDS])
        setStatuses([...LIBRARY_STATUSES])
      }}
    >
      {t('shuffle.clearFilters')}
    </Button>
  )
  const emptyState =
    source === 'catalog' ? (
      kinds.length ? (
        // Categories are chosen and still nothing: the catalog did not answer.
        <EmptyState
          className="py-6"
          icon={<CloudOff />}
          title={t('discover.unavailable')}
          text={t('discover.unavailableHint')}
          action={
            <Button variant="secondary" onClick={catalog.retry}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : (
        <EmptyState
          className="py-6"
          icon={<ListFilter />}
          title={t('shuffle.emptyPool')}
          text={t('shuffle.emptyKinds')}
          action={clearFilters}
        />
      )
    ) : !user ? (
      <EmptyState
        className="py-6"
        icon={<LogIn />}
        title={t('shuffle.emptyLibrary')}
        text={t('shuffle.loginForLibrary')}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            {rollPopular}
            <Button asChild variant="secondary">
              <Link to={`/login?next=${encodeURIComponent('/shuffle?source=library')}`}>
                {t('nav.signIn')}
              </Link>
            </Button>
          </div>
        }
      />
    ) : library.data?.some((item) => LIBRARY_STATUSES.includes(item.status)) ? (
      // Plans are there, the chips just leave them out.
      <EmptyState
        className="py-6"
        icon={<ListFilter />}
        title={t('shuffle.emptyPool')}
        text={t('shuffle.emptyPoolText')}
        action={clearFilters}
      />
    ) : (
      <EmptyState
        className="py-6"
        art={
          <PosterFan
            fallback={
              <EmptyIcon>
                <LibraryBig />
              </EmptyIcon>
            }
          />
        }
        title={t('shuffle.emptyLibrary')}
        text={t('shuffle.emptyLibraryText')}
        action={rollPopular}
      />
    )

  return (
    <>
      <PageHeader title={t('shuffle.title')} revealTitle />
      <PageBody className="max-w-5xl">
        <div className="pt-4 text-center md:pt-8">
          <div className="mx-auto grid size-11 place-items-center rounded-xl bg-raised ring-1 ring-line ring-inset">
            <Dices className="size-5.5" />
          </div>
          <h1 className="display mt-4 text-3xl sm:text-4xl">{t('shuffle.title')}</h1>
          <p className="mt-2 text-md text-fg-2">{t('shuffle.subtitle')}</p>
        </div>

        <div className="mx-auto mt-5 grid max-w-3xl gap-3 rounded-xl bg-raised p-3.5 ring-1 ring-line ring-inset sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium text-fg-2">{t('shuffle.source')}</span>
            <Segmented<Source>
              size="sm"
              aria-label={t('shuffle.source')}
              value={source}
              onChange={switchSource}
              options={
                hasLibrary
                  ? [
                      { value: 'library', label: t('shuffle.fromLibrary') },
                      { value: 'catalog', label: t('shuffle.fromCatalog') },
                    ]
                  : [
                      { value: 'catalog', label: t('shuffle.fromCatalog') },
                      { value: 'library', label: t('shuffle.fromLibrary') },
                    ]
              }
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium text-fg-2">{t('shuffle.kinds')}</span>
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map((kind) => (
                <Chip
                  key={kind}
                  active={kinds.includes(kind)}
                  onClick={() => setKinds((list) => toggle(list, kind))}
                >
                  {t(`kinds.${kind}`)}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label htmlFor="shuffle-sound" className="text-sm font-medium text-fg-2">
              {t('shuffle.sound')}
            </label>
            <Switch
              id="shuffle-sound"
              checked={sound}
              onCheckedChange={(on) => {
                setSound(on)
                writeSoundSetting(on)
              }}
            />
          </div>
          {source === 'library' ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-medium text-fg-2">{t('shuffle.statuses')}</span>
              <div className="flex flex-wrap gap-1.5">
                {LIBRARY_STATUSES.map((status) => (
                  <Chip
                    key={status}
                    active={statuses.includes(status)}
                    onClick={() => setStatuses((list) => toggle(list, status))}
                  >
                    <StatusIcon status={status} />
                    {t(`status.${status}`)}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Stays mounted when empty: the landed reel keeps its position for when the pool is back. */}
        <div
          ref={viewport}
          className={cn(
            'relative mt-6 overflow-hidden',
            empty
              ? 'grid min-h-[250px] place-items-center sm:min-h-[300px]'
              : 'fade-edges-x h-[250px] sm:h-[300px]',
          )}
          aria-live="polite"
          aria-busy={rolling || poolLoading}
        >
          <div
            ref={scope}
            className={cn(
              'absolute top-4 left-0 flex gap-4 will-change-transform',
              idle && 'left-1/2 -translate-x-1/2 opacity-40',
              empty && 'invisible',
            )}
          >
            {poolLoading && idle
              ? Array.from({ length: 7 }, (_, index) => (
                  <Skeleton key={index} className="aspect-[2/3] w-[140px] shrink-0 sm:w-[172px]" />
                ))
              : preview.map((title, index) => (
                  <div
                    key={`${title.id}-${index}`}
                    className={cn(
                      'w-[140px] shrink-0 transition-transform duration-500 ease-out sm:w-[172px]',
                      landed && index === WINNER_INDEX && 'scale-[1.035]',
                    )}
                  >
                    <Poster
                      src={title.poster}
                      alt={idle ? '' : titleName(title.names, locale)}
                      kind={title.kind}
                      eager
                      className="shadow-poster"
                    />
                  </div>
                ))}
          </div>
          {empty ? (
            emptyState
          ) : (
            // Selection frame: sits 6px outside the poster on every side (the reel viewport
            // leaves 10px above it, so the ring is never clipped) with pointer notches.
            <div
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute top-2.5 left-1/2 aspect-[2/3] w-[152px] -translate-x-1/2 rounded-[14px] ring-2 ring-fg transition-opacity duration-300 sm:w-[184px]',
                idle || rolling ? 'opacity-30' : 'opacity-100',
              )}
            >
              <span className="absolute -top-[7px] left-1/2 size-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-fg" />
              <span className="absolute -bottom-[7px] left-1/2 size-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-fg" />
            </div>
          )}
        </div>

        {empty ? null : (
          <div className="mt-5 flex flex-col items-center gap-2">
            <Button
              variant="primary"
              size="lg"
              onClick={() => void roll()}
              disabled={poolLoading || !pool.length || rolling}
              data-testid="shuffle-roll"
            >
              {rolling ? <RotateCw className="animate-spin" /> : <Dices />}
              {rolling ? t('shuffle.rolling') : result ? t('shuffle.again') : t('shuffle.roll')}
            </Button>
            {/* Kept at its height while the pool loads, so nothing jumps when the count arrives. */}
            <p className="min-h-4 text-xs text-fg-3">
              {poolLoading ? null : (
                <>
                  {t('shuffle.pool', { count: pool.length })}
                  <span className="max-md:hidden">
                    {' · '}
                    <Kbd>{t('shuffle.spaceKey')}</Kbd>{' '}
                    {idle ? t('shuffle.hintFirst') : t('shuffle.hint')}
                  </span>
                </>
              )}
            </p>
          </div>
        )}

        {result && !rolling ? (
          <section
            ref={resultCard}
            aria-label={titleName(result.names, locale)}
            className="mx-auto mt-8 flex max-w-2xl scroll-mb-6 animate-rise flex-col gap-5 rounded-xl bg-raised p-5 ring-1 ring-line ring-inset sm:flex-row sm:items-center"
          >
            <Poster
              src={result.poster}
              alt=""
              kind={result.kind}
              className="w-24 shrink-0 shadow-poster"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-fg-3">
                {[
                  t(`kind.${result.kind}`),
                  yearRange(result),
                  ...genreList(result.genres, locale, 2),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                {titleName(result.names, locale)}
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-fg-2">
                {result.ratings[0] ? (
                  <span className="tabular">
                    {ratingSourceLabel(result.ratings[0].source)}{' '}
                    {formatRating(result.ratings[0], fmt)}
                  </span>
                ) : null}
                {entry ? (
                  <span className="inline-flex items-center gap-1">
                    <StatusIcon status={entry.status} className="size-3.5" />
                    {t(statusLabelKey(entry.kind, entry.status))}
                  </span>
                ) : null}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {entry && entry.kind !== 'movie' && entry.status !== 'in_progress' ? (
                  <Button variant="primary" onClick={() => actions.setStatus(entry, 'in_progress')}>
                    <Play className="fill-current" />
                    {t('shuffle.start')}
                  </Button>
                ) : null}
                {!entry ? (
                  <Button variant="primary" onClick={() => actions.add(result, 'planned')}>
                    <Plus />
                    {t('shuffle.addPlanned')}
                  </Button>
                ) : null}
                <Button
                  asChild
                  variant={
                    !entry || (entry.kind !== 'movie' && entry.status !== 'in_progress')
                      ? 'secondary'
                      : 'primary'
                  }
                >
                  <Link to={titleHref(result.id)}>
                    <ExternalLink />
                    {t('common.open')}
                  </Link>
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        {history.length ? (
          <section className="mx-auto mt-12 max-w-3xl" aria-labelledby="history-heading">
            <h2 id="history-heading" className="mb-3 text-sm font-medium text-fg-3">
              {t('shuffle.history')}
            </h2>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
              {history.map((item) => (
                <Link
                  key={item.id}
                  to={titleHref(item.id)}
                  className="rounded-md"
                  aria-label={titleName(item.names, locale)}
                >
                  <Poster
                    src={item.poster}
                    alt={titleName(item.names, locale)}
                    kind={item.kind}
                    className="transition-transform duration-200 hover:-translate-y-0.5"
                  />
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </PageBody>
    </>
  )
}
