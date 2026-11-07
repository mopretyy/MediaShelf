import { describe, expect, it } from 'vitest'
import { heatLevel, heatmapWeeks, monthStarts } from './heatmap.ts'

describe('heatmapWeeks', () => {
  // Saturday, 7 November 2026.
  const today = '2026-11-07'

  it('ends with the current week, from Monday, with the days to come left empty', () => {
    const columns = heatmapWeeks([], today, 1)
    expect(columns).toHaveLength(53)
    const last = columns.at(-1)!
    expect(last[0]?.day).toBe('2026-11-02')
    expect(last[5]?.day).toBe(today)
    expect(last[6]).toBeNull()
    expect(columns[0][0]?.day).toBe('2025-11-03')
  })

  it('starts weeks on Sunday where they do', () => {
    const last = heatmapWeeks([], today, 7).at(-1)!
    expect(last[0]?.day).toBe('2026-11-01')
    expect(last[6]?.day).toBe(today)
  })

  it('shades on a log scale: one action is 1, the busiest day is 4', () => {
    expect(heatLevel(0, 50)).toBe(0)
    expect(heatLevel(1, 50)).toBe(1)
    expect(heatLevel(7, 50)).toBe(2)
    expect(heatLevel(10, 50)).toBe(3)
    expect(heatLevel(50, 50)).toBe(4)
    expect(heatLevel(1, 1)).toBe(4)
  })

  it('gives each day of the grid its level', () => {
    const cells = heatmapWeeks(
      [
        { day: '2026-11-02', count: 1 },
        { day: '2026-11-03', count: 4 },
        { day: '2026-11-04', count: 8 },
      ],
      today,
      1,
    ).at(-1)!
    expect(cells.slice(0, 4).map((cell) => cell?.level)).toEqual([1, 3, 4, 0])
  })

  it('marks the columns where a month begins', () => {
    const starts = monthStarts(heatmapWeeks([], today, 1))
    expect(starts.at(-1)).toBeNull()
    expect(starts.at(-2)).toBe('2026-11')
    expect(starts.filter(Boolean)).toHaveLength(12)
  })
})
