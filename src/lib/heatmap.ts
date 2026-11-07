// The year heatmap's grid: 53 week columns of 7 days ending with the current week. Pure.
import type { Weekday } from './calendar-grid.ts'

export interface HeatCell {
  day: string
  count: number
  /** 0 nothing, 1–4 from a little to the busiest days. */
  level: 0 | 1 | 2 | 3 | 4
}

const DAY_MS = 86_400_000
const toMs = (day: string) => Date.parse(`${day}T00:00:00Z`)
const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const weekdayOf = (ms: number) => {
  const sunday0 = new Date(ms).getUTCDay()
  return sunday0 === 0 ? 7 : sunday0
}

/**
 * How dark a day is: 1 for a single action, 4 for the busiest day, on a log scale in between, so
 * one very busy day (an import, a binge) does not leave every other day at the faintest shade.
 */
export function heatLevel(count: number, max: number): HeatCell['level'] {
  if (count <= 0 || max <= 0) return 0
  const ratio = max > 1 ? Math.log(count) / Math.log(max) : 1
  return (1 + Math.round(Math.min(1, ratio) * 3)) as HeatCell['level']
}

/** Columns of seven days (from the first weekday), the last one holding `today`; days after
 * today are null. */
export function heatmapWeeks(
  activity: { day: string; count: number }[],
  today: string,
  first: Weekday,
  weeks = 53,
): (HeatCell | null)[][] {
  const counts = new Map(activity.map((item) => [item.day, item.count]))
  const max = Math.max(0, ...activity.map((item) => item.count))
  const end = toMs(today)
  const startOfWeek = end - ((weekdayOf(end) - first + 7) % 7) * DAY_MS
  const start = startOfWeek - (weeks - 1) * 7 * DAY_MS
  const columns: (HeatCell | null)[][] = []
  for (let week = 0; week < weeks; week++) {
    const column: (HeatCell | null)[] = []
    for (let index = 0; index < 7; index++) {
      const ms = start + (week * 7 + index) * DAY_MS
      if (ms > end) {
        column.push(null)
        continue
      }
      const day = toDay(ms)
      const count = counts.get(day) ?? 0
      column.push({ day, count, level: heatLevel(count, max) })
    }
    columns.push(column)
  }
  return columns
}

/** The month a column starts, when the 1st of that month falls in it (for the labels on top). */
export function monthStarts(columns: (HeatCell | null)[][]): (string | null)[] {
  return columns.map((column) => {
    const first = column.find((cell) => cell?.day.endsWith('-01'))
    return first ? first.day.slice(0, 7) : null
  })
}
