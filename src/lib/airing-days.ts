import type { AiringItem } from '../../shared/types.ts'

// Pure date helpers for the episode feed (no React, so the unit tests can import them).

/** Whole days from `from` to `to`, both YYYY-MM-DD (negative when `to` is earlier). */
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

/** "today", "yesterday", "in 3 days" within a week of today; null further away. */
export function relativeDay(day: string, today: string, locale: string) {
  const diff = daysBetween(today, day)
  if (Math.abs(diff) > 6) return null
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(diff, 'day')
}

/** Upcoming items grouped by air date, in order. */
export function groupByDay(items: AiringItem[]) {
  const groups: { day: string; items: AiringItem[] }[] = []
  for (const item of items) {
    const last = groups[groups.length - 1]
    if (last?.day === item.episode.airdate) last.items.push(item)
    else groups.push({ day: item.episode.airdate, items: [item] })
  }
  return groups
}
