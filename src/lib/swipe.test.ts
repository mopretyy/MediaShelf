import { describe, expect, it } from 'vitest'
import { swipeDirection } from './swipe.ts'

describe('swipeDirection', () => {
  it('reads a far enough sideways move', () => {
    expect(swipeDirection(-120, 10)).toBe('left')
    expect(swipeDirection(90, -20)).toBe('right')
  })

  it('ignores short moves and vertical scrolls that drift', () => {
    expect(swipeDirection(-30, 0)).toBeNull()
    expect(swipeDirection(60, 80)).toBeNull()
    expect(swipeDirection(70, 50)).toBeNull()
  })
})
