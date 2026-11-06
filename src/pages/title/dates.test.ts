import { describe, expect, it } from 'vitest'
import { fromDateInput, parseDateDraft, toDateInput } from './dates.ts'

// The saved moments are built from local days, so the assertions hold in any time zone.
const at = (day: string, time: string) => new Date(`${day}T${time}`).toISOString()

describe('toDateInput / fromDateInput', () => {
  it('round-trips a picked day through the saved moment (local noon)', () => {
    expect(fromDateInput('2026-10-10')).toBe(at('2026-10-10', '12:00:00'))
    expect(toDateInput(fromDateInput('2026-10-10'))).toBe('2026-10-10')
    expect(toDateInput(at('2026-10-10', '23:30:00'))).toBe('2026-10-10')
    expect(fromDateInput('')).toBeNull()
    expect(toDateInput(null)).toBe('')
  })
})

describe('parseDateDraft', () => {
  const today = '2026-11-06'
  const start = at('2026-10-10', '20:00:00')
  const finish = at('2026-10-20', '09:30:00')

  it('saves a picked day as local noon, and an emptied field as no date', () => {
    expect(parseDateDraft('2026-10-15', {}, today)).toEqual({ value: at('2026-10-15', '12:00:00') })
    expect(parseDateDraft('', { start, finish }, today)).toEqual({ value: null })
  })

  it('refuses a finish before the start and a start after the finish', () => {
    expect(parseDateDraft('2026-10-01', { start }, today)).toEqual({ problem: 'before_start' })
    expect(parseDateDraft('2026-10-25', { finish }, today)).toEqual({ problem: 'after_finish' })
    expect(parseDateDraft('2026-10-15', { start }, today)).toEqual({
      value: at('2026-10-15', '12:00:00'),
    })
    expect(parseDateDraft('2026-10-15', { finish }, today)).toEqual({
      value: at('2026-10-15', '12:00:00'),
    })
  })

  it('keeps the order on the same day as the other date, where noon would break it', () => {
    // Started at 20:00 on the 10th: a finish on the 10th can't be noon of that day.
    expect(parseDateDraft('2026-10-10', { start }, today)).toEqual({ value: start })
    // Finished at 09:30 on the 20th: a start on the 20th can't be noon of that day.
    expect(parseDateDraft('2026-10-20', { finish }, today)).toEqual({ value: finish })
    // Noon already sits on the right side: keep it.
    const morning = at('2026-10-10', '08:00:00')
    expect(parseDateDraft('2026-10-10', { start: morning }, today)).toEqual({
      value: at('2026-10-10', '12:00:00'),
    })
  })

  it('refuses partial or implausible dates', () => {
    for (const draft of ['202-10-10', '1899-12-31', '2026-02-31', '2026-13-01'])
      expect(parseDateDraft(draft, {}, today)).toEqual({ problem: 'invalid' })
  })

  it('refuses days after today, like the picker does, and accepts today itself', () => {
    for (const draft of ['2026-11-07', '2026-12-01', '2027-01-01'])
      expect(parseDateDraft(draft, {}, today)).toEqual({ problem: 'in_future' })
    expect(parseDateDraft('2026-11-06', {}, today)).toEqual({ value: at('2026-11-06', '12:00:00') })
  })
})
