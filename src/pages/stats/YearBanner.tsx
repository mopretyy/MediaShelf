import { ArrowRight } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import type { LibraryEntry } from '@shared/types.ts'
import { Poster } from '@/components/Poster'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { useLibrary } from '@/lib/queries'
import { YEAR_STORY_ENTRY_ID } from '../year/story'

const POSTERS = 10

/** Posters for the banner: finished this year (best rated first), then the rest finished. */
function yearPosters(entries: readonly LibraryEntry[], year: number) {
  const withPoster = entries.filter((entry) => entry.status === 'completed' && entry.title.poster)
  const thisYear = (entry: LibraryEntry) =>
    entry.finishedAt !== null && new Date(entry.finishedAt).getFullYear() === year
  const byRating = (a: LibraryEntry, b: LibraryEntry) => (b.rating ?? 0) - (a.rating ?? 0)
  return [
    ...withPoster.filter(thisYear).sort(byRating),
    ...withPoster.filter((entry) => !thisYear(entry)).sort(byRating),
  ].slice(0, POSTERS)
}

/**
 * The way into the year story: a dark banner with a fan of the posters you finished this year
 * behind the title. Colour comes only from the posters, as everywhere else.
 */
export function YearBanner() {
  const { t } = useI18n()
  const library = useLibrary()
  const year = new Date().getFullYear()
  const posters = useMemo(() => yearPosters(library.data ?? [], year), [library.data, year])

  return (
    <Link
      to="/stats/year"
      id={YEAR_STORY_ENTRY_ID}
      data-testid="year-banner"
      className="group/year dark relative isolate mt-6 flex min-h-[200px] overflow-hidden rounded-2xl bg-black text-fg ring-1 ring-white/10 ring-inset sm:min-h-[220px]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 -z-20 flex w-[85%] items-center gap-3 pr-4 max-sm:opacity-35 sm:w-[70%]"
      >
        {posters.map((entry, index) => (
          <div
            key={entry.titleId}
            className={cn(
              'w-[92px] shrink-0 transition-transform duration-500 ease-out sm:w-[112px]',
              index % 2
                ? 'translate-y-6 group-hover/year:translate-y-4'
                : '-translate-y-4 group-hover/year:-translate-y-6',
            )}
            style={{ rotate: `${index % 2 ? 3 : -3}deg` }}
          >
            <Poster
              src={entry.title.poster}
              alt=""
              kind={entry.kind}
              sizes="sm"
              className="shadow-poster"
            />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black from-30% via-black/80 to-black/30" />

      <div className="flex min-w-0 flex-1 flex-col justify-end gap-1 p-5 sm:p-7">
        <span className="text-sm font-medium text-white/60">{t('year.introKicker')}</span>
        <span className="display max-w-md text-3xl text-white sm:text-4xl">
          {t('year.open', { year })}
        </span>
        <span className="mt-1 max-w-md text-base text-white/70">{t('year.openText')}</span>
        <span className="mt-4 inline-flex h-10 w-fit items-center gap-2 rounded-lg bg-white px-4 text-base font-medium text-black transition-colors group-hover/year:bg-white/90">
          {t('year.title', { year })}
          <ArrowRight
            className="size-4 transition-transform group-hover/year:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </div>
    </Link>
  )
}
