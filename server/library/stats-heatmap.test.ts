import { describe, expect, it } from 'vitest'
import { registerAccount, testApp } from '../test-utils.ts'
import { computeStats, HEATMAP_DAYS } from './stats.ts'

const DAY = 86_400_000

async function userWithActivity(stamps: number[]) {
  const t = testApp()
  await registerAccount(t, { name: 'Аня', email: 'anya@example.com', password: 'correct horse 42' })
  const user = (await t.request('GET', '/api/auth/session')).body.user
  t.db.prepare('DELETE FROM activity WHERE user_id = ?').run(user.id)
  const insert = t.db.prepare(
    "INSERT INTO activity (user_id, title_id, kind, type, data, created_at) VALUES (?, 'movie-tt0816692', 'movie', 'status', '{}', ?)",
  )
  for (const at of stamps) insert.run(user.id, at)
  return { t, user }
}

describe('year heatmap', () => {
  it('counts what happened each day of the last 53 weeks, in the user’s calendar', async () => {
    const now = Date.now()
    const today = new Date(now).toISOString().slice(0, 10)
    const { t, user } = await userWithActivity([
      now - 1000,
      now - 2000,
      now - 3 * DAY,
      now - (HEATMAP_DAYS + 5) * DAY, // too old
    ])
    const { activityDays } = computeStats(t.db, user.id, { timeZone: 'UTC' })
    expect(activityDays.at(-1)).toEqual({ day: today, count: 2 })
    expect(activityDays).toHaveLength(2)
    expect(activityDays[0].count).toBe(1)
    // Oldest first.
    expect(activityDays[0].day < activityDays[1].day).toBe(true)
  })

  it('puts a late evening on the day it was where the user lives', async () => {
    // 23:30 UTC on 1 March is already 2 March in Chișinău (UTC+2).
    const at = Date.UTC(new Date().getUTCFullYear(), 2, 1, 23, 30)
    if (at > Date.now()) return // early in the year: the day is in the future
    const { t, user } = await userWithActivity([at])
    const utc = computeStats(t.db, user.id, { timeZone: 'UTC' }).activityDays
    const local = computeStats(t.db, user.id, { timeZone: 'Europe/Chisinau' }).activityDays
    expect(utc.map((d) => d.day.slice(5))).toEqual(['03-01'])
    expect(local.map((d) => d.day.slice(5))).toEqual(['03-02'])
  })
})
