import { describe, expect, it } from 'vitest'
import {
  claimSteamSync,
  deferSteamSync,
  markSteamSynced,
  STEAM_SYNC_INTERVAL,
  STEAM_SYNC_RETRY,
} from './steam-sync.ts'
import { registerAccount, testApp } from '../test-utils.ts'

const account = { name: 'Sync', email: 'sync@example.com', password: 'correct horse battery' }
const now = 1_800_000_000_000

describe('steam auto-sync', () => {
  it('claims at most one sync per interval', async () => {
    const t = testApp()
    const userId = (await registerAccount(t, account)).body.user.id as string
    expect(claimSteamSync(t.db, userId, now)).toBe(true)
    expect(claimSteamSync(t.db, userId, now + 1000)).toBe(false)
    expect(claimSteamSync(t.db, userId, now + STEAM_SYNC_INTERVAL - 1)).toBe(false)
    expect(claimSteamSync(t.db, userId, now + STEAM_SYNC_INTERVAL)).toBe(true)
  })

  it('a manual import resets the clock, a failure retries sooner', async () => {
    const t = testApp()
    const userId = (await registerAccount(t, account)).body.user.id as string
    markSteamSynced(t.db, userId, now)
    expect(claimSteamSync(t.db, userId, now + 60_000)).toBe(false)
    deferSteamSync(t.db, userId, now)
    expect(claimSteamSync(t.db, userId, now + STEAM_SYNC_RETRY - 1)).toBe(false)
    expect(claimSteamSync(t.db, userId, now + STEAM_SYNC_RETRY)).toBe(true)
  })

  it('does nothing for an account without Steam', async () => {
    const t = testApp()
    await registerAccount(t, account)
    const response = await t.request('POST', '/api/me/steam/sync', {})
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ synced: false })
  })
})
