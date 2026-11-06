import { describe, expect, it } from 'vitest'
import type { AiringItem } from '../../shared/types.ts'
import { daysBetween, groupByDay, relativeDay } from './airing-days.ts'

const item = (titleId: string, airdate: string, number = 1) =>
  ({ titleId, episode: { season: 1, number, name: null, airdate } }) as AiringItem

describe('airing helpers', () => {
  it('counts whole days across months, years and DST changes', () => {
    expect(daysBetween('2026-11-06', '2026-11-07')).toBe(1)
    expect(daysBetween('2026-11-06', '2026-10-30')).toBe(-7)
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
  })

  it('names nearby days and leaves distant ones to the date', () => {
    expect(relativeDay('2026-11-07', '2026-11-06', 'ru')).toBe('завтра')
    expect(relativeDay('2026-11-05', '2026-11-06', 'en')).toBe('yesterday')
    expect(relativeDay('2026-11-06', '2026-11-06', 'en')).toBe('today')
    expect(relativeDay('2026-11-09', '2026-11-06', 'en')).toBe('in 3 days')
    expect(relativeDay('2026-11-20', '2026-11-06', 'en')).toBeNull()
  })

  it('groups consecutive items by air date', () => {
    const groups = groupByDay([
      item('a', '2026-11-07'),
      item('b', '2026-11-07'),
      item('a', '2026-11-14', 2),
    ])
    expect(groups.map((group) => [group.day, group.items.length])).toEqual([
      ['2026-11-07', 2],
      ['2026-11-14', 1],
    ])
  })
})
