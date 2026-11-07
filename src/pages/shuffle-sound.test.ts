import { describe, expect, it } from 'vitest'
import { cardUnderFrame } from './shuffle-sound.ts'

describe('cardUnderFrame', () => {
  it('counts the cards that have passed the frame, switching halfway between two', () => {
    expect(cardUnderFrame(500, 500, 172)).toBe(0)
    expect(cardUnderFrame(500, 500 - 85, 172)).toBe(0)
    expect(cardUnderFrame(500, 500 - 87, 172)).toBe(1)
    expect(cardUnderFrame(500, 500 - 172 * 9, 172)).toBe(9)
  })

  it('stays at zero without a card width', () => {
    expect(cardUnderFrame(500, 0, 0)).toBe(0)
  })
})
