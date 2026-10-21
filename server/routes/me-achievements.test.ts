import { describe, expect, it } from 'vitest'
import { registerAccount, testApp } from '../test-utils.ts'

const account = { name: 'Ach', email: 'ach@example.com', password: 'correct horse battery' }

describe('GET /api/me/steam/achievements/:appid', () => {
  it('is null without a linked Steam account', async () => {
    const t = testApp()
    await registerAccount(t, account)
    const response = await t.request('GET', '/api/me/steam/achievements/400')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ unlocked: null })
  })

  it('rejects a bad app id', async () => {
    const t = testApp()
    await registerAccount(t, account)
    const response = await t.request('GET', '/api/me/steam/achievements/abc')
    expect(response.status).toBe(400)
  })
})
