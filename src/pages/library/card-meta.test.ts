import { describe, expect, it } from 'vitest'
import { showsProgress } from './card-meta.ts'

describe('showsProgress', () => {
  it('keeps progress while a title is under way', () => {
    expect(showsProgress('in_progress')).toBe(true)
    expect(showsProgress('paused')).toBe(true)
  })

  it('drops it where the status already says it all', () => {
    // «Пройдено · 100 %», «Просмотрено · 12/12», «Брошено · 3/12»: the status is the news.
    expect(showsProgress('completed')).toBe(false)
    expect(showsProgress('dropped')).toBe(false)
    expect(showsProgress('planned')).toBe(false)
  })
})
