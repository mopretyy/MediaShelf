import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import type { CalendarItem } from '@shared/types.ts'
import { PageBody, PageHeader } from '@/app/PageHeader'
import { useErrorMessage } from '@/components/library-actions'
import { Poster } from '@/components/Poster'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { Tooltip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { useCalendar } from '@/lib/airing'
import { groupByDay, relativeDay } from '@/lib/airing-days'
import {
  firstWeekday,
  isMonth,
  monthGrid,
  monthOf,
  shiftMonth,
  weekdayOrder,
} from '@/lib/calendar-grid'
import { cn } from '@/lib/cn'
import { useDocumentTitle } from '@/lib/hooks'
import { useMarkEpisodes } from '@/lib/queries'
import { episodeCode, localToday, statusLabelKey, titleHref, titleName } from '@/lib/titles'

/** Posters a day cell shows before «+N». */
const CELL_POSTERS = 3

const utc = (day: string) => new Date(`${day}T00:00:00Z`)
const addDays = (day: string, days: number) =>
  new Date(utc(day).getTime() + days * 86_400_000).toISOString().slice(0, 10)
const itemKey = (item: CalendarItem) =>
  `${item.titleId}:${item.episode.season}:${item.episode.number}`

function useFormats() {
  const { locale } = useI18n()
  return useMemo(() => {
    const month = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' })
    const weekdayShort = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })
    const weekdayLong = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' })
    const dayMonth = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    })
    const full = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    })
    const capital = (value: string) => value.charAt(0).toLocaleUpperCase(locale) + value.slice(1)
    return {
      /** «Ноябрь 2026»: the standalone month name, so Russian says «ноябрь», not «ноября». */
      month: (value: string) => `${capital(month.format(utc(`${value}-01`)))} ${value.slice(0, 4)}`,
      /** Weekday 1 (Monday) … 7 (Sunday); 1 January 2024 was a Monday. */
      weekdayShort: (weekday: number) => weekdayShort.format(utc(`2024-01-0${weekday}`)),
      weekdayLong: (weekday: number) => weekdayLong.format(utc(`2024-01-0${weekday}`)),
      dayMonth: (day: string) => dayMonth.format(utc(day)),
      full: (day: string) => capital(full.format(utc(day))),
    }
  }, [locale])
}

function useEpisodeLine() {
  const { t } = useI18n()
  return (item: CalendarItem) =>
    [t('episodes.code', episodeCode(item.episode.season, item.episode.number)), item.episode.name]
      .filter(Boolean)
      .join(' · ')
}

/** «Просмотрено» for an aired episode you have not seen; a quiet check once you have. */
function MarkButton({ item, today }: { item: CalendarItem; today: string }) {
  const { t, locale } = useI18n()
  const mark = useMarkEpisodes()
  const message = useErrorMessage()
  if (item.watched)
    return (
      <span className="flex shrink-0 items-center gap-1 text-sm text-fg-3">
        <Check className="size-4" />
        {t('airing.watched')}
      </span>
    )
  if (item.episode.airdate > today) return null
  const code = t('episodes.code', episodeCode(item.episode.season, item.episode.number))
  return (
    <Button
      size="xs"
      variant="secondary"
      className="shrink-0"
      loading={mark.isPending}
      aria-label={`${t('airing.watched')}: ${titleName(item.title.names, locale)} · ${code}`}
      onClick={() =>
        mark.mutate(
          {
            titleId: item.titleId,
            episodes: [{ season: item.episode.season, number: item.episode.number }],
            watched: true,
          },
          {
            onSuccess: ({ statusChanged }) =>
              toast(
                statusChanged
                  ? t('toast.autoStatus', {
                      status: t(statusLabelKey(item.kind, statusChanged.to)),
                    })
                  : t('toast.episodeMarked'),
                { description: `${titleName(item.title.names, locale)} · ${code}` },
              ),
            onError: (error) => toast.error(message(error)),
          },
        )
      }
    >
      <Check />
      {t('airing.watched')}
    </Button>
  )
}

function EpisodeRow({ item, today }: { item: CalendarItem; today: string }) {
  const { t, locale } = useI18n()
  const line = useEpisodeLine()
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Link
        to={titleHref(item.titleId)}
        tabIndex={-1}
        aria-hidden="true"
        className="w-10 shrink-0 rounded-sm"
      >
        <Poster src={item.title.poster} alt="" kind={item.kind} sizes="sm" rounded="rounded-sm" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to={titleHref(item.titleId)}
          className="block truncate rounded-sm text-base font-medium hover:underline hover:decoration-line-strong hover:underline-offset-4"
        >
          {titleName(item.title.names, locale)}
        </Link>
        <p className="flex min-w-0 items-center gap-2 text-sm text-fg-2">
          <span className="truncate">{line(item)}</span>
          {item.episode.number === 1 ? (
            <span className="shrink-0 rounded-sm px-1.5 py-px text-2xs font-medium text-fg ring-1 ring-line-strong ring-inset">
              {t('airing.premiere')}
            </span>
          ) : null}
        </p>
      </div>
      <MarkButton item={item} today={today} />
    </li>
  )
}

/** The selected day's episodes, beside the grid on wide screens and under it on tablets. */
function DayPanel({
  day,
  items,
  today,
  loading,
}: {
  day: string
  items: CalendarItem[]
  today: string
  /** The month is still loading: no «nothing airs» yet. */
  loading: boolean
}) {
  const { t, locale } = useI18n()
  const formats = useFormats()
  const relative = relativeDay(day, today, locale)
  return (
    <section
      aria-labelledby="calendar-day-heading"
      data-testid="calendar-day"
      className="self-start rounded-xl bg-raised p-4 ring-1 ring-line ring-inset lg:sticky lg:top-20"
    >
      <h2 id="calendar-day-heading" className="text-lg font-semibold tracking-tight">
        {formats.full(day)}
      </h2>
      {loading ? (
        <div className="mt-2 space-y-2">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <p className="text-sm text-fg-3 first-letter:uppercase">
          {relative ? `${relative} · ` : ''}
          {items.length ? t('calendar.episodes', { count: items.length }) : t('calendar.dayEmpty')}
        </p>
      )}
      {items.length ? (
        <ul className="mt-2 divide-y divide-line">
          {items.map((item) => (
            <EpisodeRow key={itemKey(item)} item={item} today={today} />
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function DayCell({
  day,
  items,
  inMonth,
  today,
  selected,
  onSelect,
  onKeyDown,
  cellRef,
}: {
  day: string
  items: CalendarItem[]
  inMonth: boolean
  today: string
  selected: boolean
  onSelect(): void
  onKeyDown(event: KeyboardEvent<HTMLButtonElement>): void
  cellRef(element: HTMLButtonElement | null): void
}) {
  const { t, locale } = useI18n()
  const formats = useFormats()
  const shown = items.slice(0, CELL_POSTERS)
  const hidden = items.length - shown.length
  const isToday = day === today
  const names = items.map((item) => titleName(item.title.names, locale))
  const label = [
    formats.dayMonth(day),
    isToday ? t('calendar.today') : null,
    items.length ? t('calendar.episodes', { count: items.length }) : null,
    items.length ? [...new Set(names)].join(', ') : null,
  ]
    .filter(Boolean)
    .join(', ')
  return (
    <div role="gridcell" aria-selected={selected} className="min-w-0">
      <button
        ref={cellRef}
        type="button"
        tabIndex={selected ? 0 : -1}
        aria-label={label}
        aria-current={isToday ? 'date' : undefined}
        onClick={onSelect}
        onKeyDown={onKeyDown}
        data-day={day}
        className={cn(
          'flex h-full min-h-[112px] w-full flex-col gap-1.5 rounded-lg p-1.5 text-left transition-colors',
          selected ? 'bg-active ring-1 ring-line-strong ring-inset' : 'hover:bg-hover',
          !inMonth && 'opacity-45',
          day < today && !selected && 'text-fg-3',
        )}
      >
        <span
          className={cn(
            'grid size-6 place-items-center rounded-full text-sm font-medium tabular-nums',
            isToday && 'bg-fg text-panel',
          )}
        >
          {Number(day.slice(8))}
        </span>
        {shown.length ? (
          // One or two episodes get half the cell each; three share it in thirds.
          <span className={cn('grid gap-1', shown.length < 3 ? 'grid-cols-2' : 'grid-cols-3')}>
            {shown.map((item) => (
              <span key={itemKey(item)} className="relative">
                <Poster
                  src={item.title.poster}
                  alt=""
                  kind={item.kind}
                  sizes="sm"
                  rounded="rounded-xs"
                  className={cn(item.watched && 'opacity-50')}
                />
                {item.watched ? (
                  <span className="absolute right-0.5 bottom-0.5 grid size-3.5 place-items-center rounded-full bg-black/70 text-white">
                    <Check className="size-2.5" strokeWidth={3} />
                  </span>
                ) : null}
              </span>
            ))}
          </span>
        ) : null}
        {hidden > 0 ? (
          <span className="text-xs font-medium text-fg-2 tabular-nums">+{hidden}</span>
        ) : null}
      </button>
    </div>
  )
}

/** Phones: the month as a list of the days that have episodes. */
function Agenda({ items, today }: { items: CalendarItem[]; today: string }) {
  const { locale } = useI18n()
  const formats = useFormats()
  const groups = groupByDay(items) as { day: string; items: CalendarItem[] }[]
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl bg-raised ring-1 ring-line ring-inset md:hidden">
      {groups.map((group) => {
        const relative = relativeDay(group.day, today, locale)
        return (
          <li key={group.day} className="px-4 py-3">
            <p
              className={cn(
                'text-sm font-semibold first-letter:uppercase',
                group.day === today ? 'text-fg' : 'text-fg-2',
              )}
            >
              {formats.full(group.day)}
              {relative ? <span className="font-normal text-fg-3"> · {relative}</span> : null}
            </p>
            <ul className="divide-y divide-line-subtle">
              {group.items.map((item) => (
                <EpisodeRow key={itemKey(item)} item={item} today={today} />
              ))}
            </ul>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * A month of episodes for the shows in the library: a grid of days with the posters of what airs
 * on each (watched ones dimmed with a check), the chosen day's list beside it with a one-tap
 * «Просмотрено» for aired episodes. Phones get the same month as a list of days. The grid is
 * navigable with the arrow keys (one focusable day, as a date grid should be).
 */
export default function CalendarPage() {
  const { t, locale } = useI18n()
  const formats = useFormats()
  const [params, setParams] = useSearchParams()
  const today = localToday()
  const requested = params.get('month')
  const month = isMonth(requested) ? requested : monthOf(today)
  const first = firstWeekday(locale)
  const grid = useMemo(() => monthGrid(month, first), [month, first])
  const calendar = useCalendar(grid.from, grid.to)
  const fresh = calendar.data && calendar.data.from === grid.from ? calendar.data : undefined
  const items = useMemo(() => fresh?.items ?? [], [fresh])
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>()
    for (const item of items) {
      const list = map.get(item.episode.airdate)
      if (list) list.push(item)
      else map.set(item.episode.airdate, [item])
    }
    return map
  }, [items])
  const monthItems = items.filter((item) => monthOf(item.episode.airdate) === month)

  // The chosen day: today in the current month, else the first day with episodes, else the 1st.
  const fallbackDay =
    monthOf(today) === month ? today : (monthItems[0]?.episode.airdate ?? `${month}-01`)
  const [picked, setPicked] = useState<string | null>(null)
  const selected = picked && grid.days.includes(picked) ? picked : fallbackDay
  useDocumentTitle(`${t('calendar.title')} · ${formats.month(month)}`)

  const cells = useRef(new Map<string, HTMLButtonElement>())
  // A day to focus once its cell exists: arrowing off the grid turns the month first.
  const focusDay = useRef<string | null>(null)
  useEffect(() => {
    const day = focusDay.current
    const cell = day ? cells.current.get(day) : undefined
    if (!cell) return
    focusDay.current = null
    cell.focus()
  })
  const goToMonth = (next: string, day?: string) => {
    setPicked(day ?? null)
    setParams(
      (current) => {
        const copy = new URLSearchParams(current)
        if (next === monthOf(today)) copy.delete('month')
        else copy.set('month', next)
        return copy
      },
      { replace: true },
    )
  }
  const moveTo = (day: string) => {
    if (grid.days.includes(day)) {
      setPicked(day)
      cells.current.get(day)?.focus()
      return
    }
    // Off the grid: turn the page and keep the focus on the same day of the new month.
    focusDay.current = day
    goToMonth(monthOf(day), day)
  }
  const onCellKey = (day: string) => (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    }[event.key]
    if (step !== undefined) {
      event.preventDefault()
      moveTo(addDays(day, step))
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault()
      const target = shiftMonth(monthOf(day), event.key === 'PageUp' ? -1 : 1)
      // The same day of the month, or the last one when the month is shorter (31 → 30).
      const last = addDays(`${shiftMonth(target, 1)}-01`, -1)
      const same = `${target}${day.slice(7)}`
      moveTo(same <= last ? same : last)
    }
  }

  const weeks: string[][] = []
  for (let index = 0; index < grid.days.length; index += 7)
    weeks.push(grid.days.slice(index, index + 7))
  const weekdays = weekdayOrder(first)

  return (
    <>
      <PageHeader title={t('calendar.title')} revealTitle />
      <PageBody>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-fg-3">{t('calendar.title')}</p>
            <h1
              id="calendar-month"
              className="display mt-0.5 text-3xl sm:text-4xl"
              aria-live="polite"
            >
              {formats.month(month)}
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              disabled={month === monthOf(today)}
              onClick={() => goToMonth(monthOf(today), today)}
            >
              {t('calendar.today')}
            </Button>
            <Tooltip content={t('calendar.previous')}>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('calendar.previous')}
                onClick={() => goToMonth(shiftMonth(month, -1))}
              >
                <ChevronLeft />
              </Button>
            </Tooltip>
            <Tooltip content={t('calendar.next')}>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('calendar.next')}
                onClick={() => goToMonth(shiftMonth(month, 1))}
              >
                <ChevronRight />
              </Button>
            </Tooltip>
          </div>
        </div>

        {fresh && !monthItems.length ? (
          <div className="mt-5 rounded-xl bg-raised px-4 py-3.5 ring-1 ring-line ring-inset">
            <p className="text-base font-medium">{t('calendar.empty')}</p>
            <p className="mt-0.5 text-sm text-fg-2">{t('calendar.emptyHint')}</p>
          </div>
        ) : null}

        {!fresh && calendar.isError ? (
          <div className="mt-6 rounded-xl bg-raised px-4 py-8 text-center ring-1 ring-line ring-inset">
            <p className="text-base text-fg-2">{t('errors.generic')}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              loading={calendar.isFetching}
              onClick={() => void calendar.refetch()}
            >
              {t('common.retry')}
            </Button>
          </div>
        ) : (
          // The grid stays while another month loads, so the focus and the layout keep still.
          <>
            <div className="mt-6 grid gap-6 max-md:hidden lg:grid-cols-[minmax(0,1fr)_320px]">
              <div role="grid" aria-labelledby="calendar-month" data-testid="calendar-grid">
                <div role="row" className="grid grid-cols-7 gap-1 pb-1">
                  {weekdays.map((weekday) => (
                    <div
                      key={weekday}
                      role="columnheader"
                      aria-label={formats.weekdayLong(weekday)}
                      className="px-1.5 text-xs font-medium text-fg-3 first-letter:uppercase"
                    >
                      {formats.weekdayShort(weekday)}
                    </div>
                  ))}
                </div>
                {weeks.map((week) => (
                  <div
                    key={week[0]}
                    role="row"
                    className="grid grid-cols-7 gap-1 border-t border-line-subtle pt-1 pb-1"
                  >
                    {week.map((day) => (
                      <DayCell
                        key={day}
                        day={day}
                        items={byDay.get(day) ?? []}
                        inMonth={monthOf(day) === month}
                        today={today}
                        selected={day === selected}
                        onSelect={() => setPicked(day)}
                        onKeyDown={onCellKey(day)}
                        cellRef={(element) => {
                          if (element) cells.current.set(day, element)
                          else cells.current.delete(day)
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <DayPanel
                day={selected}
                items={byDay.get(selected) ?? []}
                today={today}
                loading={!fresh}
              />
            </div>
            {!fresh ? (
              <Skeleton className="mt-5 h-64 w-full rounded-xl md:hidden" />
            ) : monthItems.length ? (
              <div className="mt-5 md:hidden">
                <Agenda items={monthItems} today={today} />
              </div>
            ) : null}
          </>
        )}
      </PageBody>
    </>
  )
}
