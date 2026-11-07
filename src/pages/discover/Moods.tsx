import { ArrowLeft } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import type { TitleRecord } from '@shared/types.ts'
import { Poster } from '@/components/Poster'
import { Shelf, TitleCard, TitleCardSkeleton, TitleGrid } from '@/components/TitleCard'
import { Button } from '@/components/ui/button'
import { Chip, EmptyState, Skeleton } from '@/components/ui/misc'
import { useI18n } from '@/i18n'
import { MOOD_IDS, moodTitles, type MoodId } from '@/lib/moods'
import { useCharts } from '@/lib/queries'

/** Popular and all-time charts of every kind, interleaved: what the moods are picked from. */
function useMoodPool() {
  const queries = [
    useCharts('movie', 'trending'),
    useCharts('series', 'trending'),
    useCharts('game', 'trending'),
    useCharts('anime', 'trending'),
    useCharts('movie', 'top'),
    useCharts('series', 'top'),
    useCharts('game', 'top'),
    useCharts('anime', 'top'),
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

/** `?mood=` on Discover, keeping the other params. */
export function useMoodParam() {
  const [params] = useSearchParams()
  const value = params.get('mood')
  const mood = (MOOD_IDS as readonly string[]).includes(value ?? '') ? (value as MoodId) : null
  const hrefFor = (next: MoodId | null) => {
    const copy = new URLSearchParams(params)
    if (next) copy.set('mood', next)
    else copy.delete('mood')
    const query = copy.toString()
    return query ? `?${query}` : '?'
  }
  return { mood, hrefFor }
}

/**
 * One mood as a tile: its first three posters fanned over a wash of their colours, the name and
 * what it means. Colour comes from the posters only; the dark palette keeps the text legible.
 */
function MoodTile({ mood, titles, href }: { mood: MoodId; titles: TitleRecord[]; href: string }) {
  const { t } = useI18n()
  const shown = titles.slice(0, 3)
  return (
    <Link
      to={href}
      data-testid={`mood-${mood}`}
      className="group/mood dark relative isolate flex w-full flex-col overflow-hidden rounded-xl bg-black text-white ring-1 ring-line ring-inset outline-offset-4"
    >
      {shown[0]?.poster ? (
        <img
          src={shown[0].poster}
          alt=""
          aria-hidden="true"
          decoding="async"
          referrerPolicy="no-referrer"
          className="absolute inset-0 -z-20 size-full scale-125 object-cover opacity-70 blur-2xl"
        />
      ) : null}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/40 to-black/0" />
      {/* The fan has its own band above the words, so no poster ever covers them. */}
      <div aria-hidden="true" className="relative mx-auto mt-4 h-[96px] w-[160px]">
        <div className="absolute inset-0 transition-transform duration-500 ease-out group-hover/mood:-translate-y-1">
          {shown.map((title, index) => {
            const angle =
              shown.length === 1 ? 0 : ([-10, 0, 10][index + (shown.length === 2 ? 1 : 0)] ?? 0)
            return (
              <div
                key={title.id}
                className="absolute bottom-0 left-1/2 w-[58px] origin-bottom"
                style={{
                  zIndex: angle === 0 ? 3 : 1,
                  transform: `translateX(-50%) translateX(${angle * 3.4}px) rotate(${angle}deg)`,
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
      </div>
      <div className="px-3.5 pt-3 pb-3.5">
        <p className="truncate text-md font-semibold tracking-tight">{t(`moods.${mood}`)}</p>
        <p className="mt-0.5 line-clamp-2 min-h-8 text-xs leading-4 text-white/70">
          {t(`moods.${mood}Hint`)}
        </p>
      </div>
    </Link>
  )
}

/** Discover's «Под настроение» row: a tile per mood that has something in it. */
export function MoodRow() {
  const { t } = useI18n()
  const { pool, loading } = useMoodPool()
  const { hrefFor } = useMoodParam()
  const moods = MOOD_IDS.map((mood) => ({ mood, titles: moodTitles(pool, mood) })).filter(
    (item) => item.titles.length >= 3,
  )
  if (!loading && !moods.length) return null
  return (
    <section className="mt-10" aria-labelledby="moods-heading">
      <h2 id="moods-heading" className="mb-3 text-xl font-semibold tracking-[-0.015em]">
        {t('moods.title')}
      </h2>
      <Shelf label={t('moods.title')} itemClassName="w-[200px] sm:w-[232px]">
        {loading
          ? Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-[180px] w-full rounded-xl" />
            ))
          : moods.map((item) => (
              <MoodTile
                key={item.mood}
                mood={item.mood}
                titles={item.titles}
                href={hrefFor(item.mood)}
              />
            ))}
      </Shelf>
    </section>
  )
}

/** The page of one mood: chips to switch, the way back, and the titles that fit, best first. */
export function MoodView({ mood }: { mood: MoodId }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { pool, loading } = useMoodPool()
  const { hrefFor } = useMoodParam()
  const titles = useMemo(() => moodTitles(pool, mood), [pool, mood])
  return (
    <section className="mt-8" aria-labelledby="mood-heading" data-testid="mood-view">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg-3">{t('moods.title')}</p>
          <h2 id="mood-heading" className="display mt-0.5 text-3xl sm:text-4xl">
            {t(`moods.${mood}`)}
          </h2>
          <p className="mt-1 text-base text-fg-2">{t(`moods.${mood}Hint`)}</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to={hrefFor(null)}>
            <ArrowLeft />
            {t('moods.all')}
          </Link>
        </Button>
      </div>
      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
        {MOOD_IDS.map((id) => (
          <Chip key={id} active={id === mood} onClick={() => navigate(hrefFor(id))}>
            {t(`moods.${id}`)}
          </Chip>
        ))}
      </div>
      <div className="mt-6">
        {loading ? (
          <TitleGrid>
            {Array.from({ length: 12 }, (_, index) => (
              <TitleCardSkeleton key={index} />
            ))}
          </TitleGrid>
        ) : titles.length ? (
          <TitleGrid>
            {titles.map((title, index) => (
              <TitleCard key={title.id} title={title} showKind eager={index < 12} />
            ))}
          </TitleGrid>
        ) : (
          <EmptyState title={t('moods.empty')} />
        )}
      </div>
    </section>
  )
}
