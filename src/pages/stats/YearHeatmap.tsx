import { Fragment, useLayoutEffect, useMemo, useRef } from 'react'
import { useI18n } from '@/i18n'
import { firstWeekday, weekdayOrder } from '@/lib/calendar-grid'
import { cn } from '@/lib/cn'
import { heatmapWeeks, monthStarts, type HeatCell } from '@/lib/heatmap'
import { localToday } from '@/lib/titles'
import { StatCard } from './StatCard'

/** Shades of the text colour only: the chrome stays black and white (DESIGN.md). */
const LEVELS: Record<HeatCell['level'], string> = {
  0: 'bg-active',
  1: 'bg-fg/20',
  2: 'bg-fg/40',
  3: 'bg-fg/65',
  4: 'bg-fg',
}

/**
 * The year at a glance: 53 weeks of days, darker where more happened (statuses, episodes,
 * ratings, playthroughs). Scrolls sideways on phones, the latest weeks in view.
 */
export function YearHeatmap({
  days,
  className,
}: {
  days: { day: string; count: number }[]
  className?: string
}) {
  const { t, locale } = useI18n()
  const today = localToday()
  const first = firstWeekday(locale)
  const columns = useMemo(() => heatmapWeeks(days, today, first), [days, today, first])
  const months = useMemo(() => monthStarts(columns), [columns])
  const monthName = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }),
    [locale],
  )
  const dayName = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }),
    [locale],
  )
  const weekday = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }),
    [locale],
  )
  const active = days.filter((item) => item.count > 0).length
  const scroller = useRef<HTMLDivElement>(null)
  // Phones see the latest weeks first; the past is a swipe to the left.
  useLayoutEffect(() => {
    const element = scroller.current
    if (element) element.scrollLeft = element.scrollWidth
  }, [columns])

  const label = (cell: HeatCell) =>
    `${dayName.format(new Date(`${cell.day}T00:00:00Z`))}: ${
      cell.count ? t('stats.heatmapDay', { count: cell.count }) : t('stats.heatmapNone')
    }`

  return (
    <StatCard
      title={t('stats.heatmapTitle')}
      meta={t('stats.heatmapMeta', { count: active })}
      className={className}
    >
      <div
        ref={scroller}
        role="img"
        aria-label={`${t('stats.heatmapTitle')}: ${t('stats.heatmapMeta', { count: active })}`}
        data-testid="year-heatmap"
        className="no-scrollbar -mx-1 overflow-x-auto px-1"
      >
        {/* One grid for the month labels, the weekday labels and the days, so they line up; the
            columns stretch to the card's width and keep at least 11 px (phones scroll). */}
        <div
          className="grid min-w-[760px] gap-[3px]"
          style={{ gridTemplateColumns: `auto repeat(${columns.length}, minmax(11px, 1fr))` }}
          aria-hidden="true"
        >
          <span />
          {months.map((month, index) => (
            <span
              key={`m${index}`}
              className="h-4 overflow-visible text-2xs whitespace-nowrap text-fg-3"
            >
              {month ? monthName.format(new Date(`${month}-01T00:00:00Z`)).replace('.', '') : ''}
            </span>
          ))}
          {weekdayOrder(first).map((day, row) => (
            <Fragment key={day}>
              <span
                className={cn(
                  'self-center pr-1.5 text-2xs leading-none text-fg-3',
                  row % 2 ? '' : 'invisible',
                )}
              >
                {weekday.format(new Date(`2024-01-0${day}T00:00:00Z`))}
              </span>
              {columns.map((column, index) => {
                const cell = column[row]
                return cell ? (
                  <span
                    key={cell.day}
                    title={label(cell)}
                    data-level={cell.level}
                    data-day={cell.day}
                    className={cn(
                      'aspect-square w-full rounded-[3px]',
                      LEVELS[cell.level],
                      cell.day === today && 'ring-1 ring-fg-3 ring-offset-1 ring-offset-raised',
                    )}
                  />
                ) : (
                  <span key={`empty-${index}`} />
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>
      <div
        className="mt-3 flex items-center justify-end gap-1.5 text-xs text-fg-3"
        aria-hidden="true"
      >
        {t('stats.heatmapLess')}
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <span key={level} className={cn('size-[11px] rounded-[3px]', LEVELS[level])} />
        ))}
        {t('stats.heatmapMore')}
      </div>
    </StatCard>
  )
}
