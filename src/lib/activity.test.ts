import { describe, expect, it } from 'vitest'
import { formatDayHeading } from './activity.ts'

describe('formatDayHeading', () => {
  const now = new Date(2026, 10, 6, 15, 0)

  it('leaves the year out for days of the current year', () => {
    expect(formatDayHeading(new Date(2026, 9, 17, 23, 30), 'ru', now)).toBe('17 октября')
    expect(formatDayHeading(new Date(2026, 0, 1, 0, 5), 'ru', now)).toBe('1 января')
    expect(formatDayHeading(new Date(2026, 9, 17), 'en', now)).toBe('October 17')
  })

  it('names the year for earlier ones, without «г.»', () => {
    expect(formatDayHeading(new Date(2025, 1, 19), 'ru', now)).toBe('19 февраля 2025')
    expect(formatDayHeading(new Date(2025, 11, 31), 'uk', now)).toBe('31 грудня 2025')
    expect(formatDayHeading(new Date(2025, 1, 19), 'en', now)).toBe('February 19, 2025')
  })
})
