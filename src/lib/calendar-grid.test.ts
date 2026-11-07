import { describe, expect, it } from 'vitest'
import { firstWeekday, isMonth, monthGrid, shiftMonth, weekdayOrder } from './calendar-grid.ts'

describe('monthGrid', () => {
  it('covers whole weeks around the month, from Monday', () => {
    // November 2026 starts on a Sunday and ends on a Monday.
    const grid = monthGrid('2026-11', 1)
    expect(grid.from).toBe('2026-10-26')
    expect(grid.to).toBe('2026-12-06')
    expect(grid.days).toHaveLength(42)
  })

  it('starts on Sunday where weeks do', () => {
    const grid = monthGrid('2026-11', 7)
    expect(grid.from).toBe('2026-11-01')
    expect(grid.to).toBe('2026-12-05')
    expect(grid.days).toHaveLength(35)
  })

  it('needs only four rows for a February that starts on the first weekday', () => {
    const grid = monthGrid('2027-02', 1)
    expect(grid).toMatchObject({ from: '2027-02-01', to: '2027-02-28' })
    expect(grid.days).toHaveLength(28)
  })

  it('walks across a year and a leap day', () => {
    expect(monthGrid('2028-02', 1).days).toContain('2028-02-29')
    expect(monthGrid('2026-12', 1).to).toBe('2027-01-03')
  })
})

describe('month helpers', () => {
  it('shifts months across years', () => {
    expect(shiftMonth('2026-11', 1)).toBe('2026-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })

  it('accepts only real months', () => {
    expect(isMonth('2026-11')).toBe(true)
    expect(isMonth('2026-13')).toBe(false)
    expect(isMonth('2026-1')).toBe(false)
    expect(isMonth('abc')).toBe(false)
    expect(isMonth(null)).toBe(false)
  })

  it('orders weekdays from the first day of the week', () => {
    expect(weekdayOrder(1)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(weekdayOrder(7)).toEqual([7, 1, 2, 3, 4, 5, 6])
  })

  it('starts weeks on Monday in Russian and on Sunday in American English', () => {
    expect(firstWeekday('ru')).toBe(1)
    expect(firstWeekday('de')).toBe(1)
    expect(firstWeekday('en-US')).toBe(7)
  })
})
