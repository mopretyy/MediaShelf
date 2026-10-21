import { describe, expect, it } from 'vitest'
import { parsePlayerAchievements } from './steam-achievements.ts'

describe('player achievements', () => {
  it('keeps only unlocked names', () => {
    expect(
      parsePlayerAchievements({
        playerstats: {
          success: true,
          achievements: [
            { apiname: 'A', achieved: 1 },
            { apiname: 'B', achieved: 0 },
            { apiname: 'C', achieved: 1 },
          ],
        },
      }),
    ).toEqual(['A', 'C'])
  })

  it('returns null when Steam refuses (private profile, no stats)', () => {
    expect(parsePlayerAchievements({ playerstats: { success: false } })).toBeNull()
    expect(parsePlayerAchievements(null)).toBeNull()
  })

  it('a game with no unlocks is an empty list, not unknown', () => {
    expect(parsePlayerAchievements({ playerstats: { success: true } })).toEqual([])
  })
})
