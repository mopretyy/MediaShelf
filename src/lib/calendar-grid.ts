// Pure date helpers for the month calendar, kept apart from React so they can be unit tested.
// Days are YYYY-MM-DD strings in the reader's calendar, computed in UTC to avoid DST shifts.

const DAY_MS = 86_400_000

/** 'YYYY-MM' that exists. */
export function isMonth(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false
  const year = Number(value.slice(0, 4))
  return year >= 1900 && year <= 2100
}

export const monthOf = (day: string) => day.slice(0, 7)

export function shiftMonth(month: string, delta: number): string {
  const date = new Date(`${month}-01T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + delta)
  return date.toISOString().slice(0, 7)
}

/** 1 = Monday … 7 = Sunday, as `Intl.Locale#weekInfo` counts them. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** The day a week starts on for a language: Sunday for English (US), Monday for the rest. */
export function firstWeekday(locale: string): Weekday {
  try {
    const info = new Intl.Locale(locale) as Intl.Locale & {
      weekInfo?: { firstDay: number }
      getWeekInfo?: () => { firstDay: number }
    }
    const first = info.getWeekInfo?.().firstDay ?? info.weekInfo?.firstDay
    if (first && first >= 1 && first <= 7) return first as Weekday
  } catch {
    /* fall through */
  }
  return locale.startsWith('en') ? 7 : 1
}

const weekdayOf = (day: string): Weekday => {
  const sunday0 = new Date(`${day}T00:00:00Z`).getUTCDay()
  return (sunday0 === 0 ? 7 : sunday0) as Weekday
}

const addDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)

/**
 * The days a month grid shows: whole weeks from the one holding the 1st to the one holding the
 * last day, so the grid has 4 to 6 rows. `from` and `to` are what the calendar asks the server for.
 */
export function monthGrid(month: string, first: Weekday) {
  const start = `${month}-01`
  const end = addDays(`${shiftMonth(month, 1)}-01`, -1)
  const lead = (weekdayOf(start) - first + 7) % 7
  const last = ((first + 5) % 7) + 1
  const trail = (last - weekdayOf(end) + 7) % 7
  const from = addDays(start, -lead)
  const to = addDays(end, trail)
  const days: string[] = []
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day)
  return { from, to, days }
}

/** The seven weekdays of a grid row in order, for the column headings. */
export function weekdayOrder(first: Weekday): Weekday[] {
  return Array.from({ length: 7 }, (_, index) => (((first - 1 + index) % 7) + 1) as Weekday)
}
