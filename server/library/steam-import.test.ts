import { describe, expect, it } from 'vitest'
import { updateEntry } from './entries.ts'
import { TitleStore } from './titles.ts'
import {
  importSteamLibrary,
  parseGamesPage,
  parseProfileGames,
  steamAppRecord,
} from './steam-import.ts'
import { registerAccount, testApp } from '../test-utils.ts'

const account = { name: 'Дима', email: 'steam@example.com', password: 'correct horse battery' }

describe('steam import', () => {
  it('builds steam title ids with header art', () => {
    expect(steamAppRecord(400, 'Portal')).toMatchObject({
      id: 'steam-400',
      kind: 'game',
      externalIds: { steam: '400' },
    })
  })

  it('parses embedded game data from a public games page', () => {
    const html =
      '<script>var rgGames = [{"appid":400,"name":"Portal","hours_forever":"12.5"},{"appid":620,"name":"Portal 2","hours_forever":""}];</script>'
    expect(parseGamesPage(html)).toEqual([
      { appid: 400, name: 'Portal', playtimeMinutes: 750 },
      { appid: 620, name: 'Portal 2', playtimeMinutes: 0 },
    ])
  })

  it('parses legacy game rows', () => {
    const html =
      '<a href="https://steamcommunity.com/app/400"><div class="gameListRowItemName">Portal</div><div>10.5 hrs on record</div></a>'
    expect(parseGamesPage(html)).toEqual([{ appid: 400, name: 'Portal', playtimeMinutes: 630 }])
  })

  it('finds nothing on a login wall', () => {
    expect(parseGamesPage('<html><body>Sign In</body></html>')).toEqual([])
  })

  it('parses recent games from a profile page', () => {
    const html =
      '<div class="recent_game"><a href="https://steamcommunity.com/app/292030"><img></a>' +
      '<div>165 hrs on record<br></div><div class="game_name"><a class="whiteLink" href="https://steamcommunity.com/app/292030">The Witcher 3</a></div></div>'
    expect(parseProfileGames(html)).toEqual([
      { appid: 292030, name: 'The Witcher 3', playtimeMinutes: 9900 },
    ])
  })

  it('imports owned games as Steam entries', async () => {
    const t = testApp()
    const registered = await registerAccount(t, account)
    const userId = registered.body.user.id as string
    const result = importSteamLibrary(t.db, new TitleStore(t.db), userId, [
      { appid: 400, name: 'Portal', playtimeMinutes: 750 },
      { appid: 620, name: 'Portal 2', playtimeMinutes: 0 },
    ])
    expect(result).toEqual({
      total: 2,
      imported: 2,
      existing: 0,
      updated: 0,
      resumed: 0,
      paused: 0,
      failed: 0,
      skipped: 0,
    })
    const library = await t.request('GET', '/api/library')
    const byId = Object.fromEntries(
      (
        library.body.entries as { titleId: string; status: string; store: string; hours: number }[]
      ).map((e) => [e.titleId, e]),
    )
    expect(byId['steam-400']).toMatchObject({ status: 'in_progress', store: 'steam', hours: 12.5 })
    expect(byId['steam-620']).toMatchObject({ status: 'planned', store: 'steam' })
    // Re-import with the same hours changes nothing.
    expect(
      importSteamLibrary(t.db, new TitleStore(t.db), userId, [
        { appid: 400, name: 'Portal', playtimeMinutes: 750 },
      ]),
    ).toEqual({
      total: 1,
      imported: 0,
      existing: 1,
      updated: 0,
      resumed: 0,
      paused: 0,
      failed: 0,
      skipped: 1,
    })
  })

  it('re-import refreshes hours but keeps the status the user set', async () => {
    const t = testApp()
    const registered = await registerAccount(t, account)
    const userId = registered.body.user.id as string
    const store = new TitleStore(t.db)
    importSteamLibrary(t.db, store, userId, [{ appid: 400, name: 'Portal', playtimeMinutes: 600 }])
    updateEntry(t.db, userId, 'steam-400', { status: 'completed' })
    const result = importSteamLibrary(t.db, store, userId, [
      { appid: 400, name: 'Portal', playtimeMinutes: 900 },
    ])
    expect(result).toMatchObject({ imported: 0, existing: 1, updated: 1 })
    const library = await t.request('GET', '/api/library')
    const entry = (
      library.body.entries as { titleId: string; status: string; hours: number }[]
    ).find((e) => e.titleId === 'steam-400')
    expect(entry).toMatchObject({ status: 'completed', hours: 15 })
  })
  it('auto-pauses and resumes steam games, never touching finished ones', async () => {
    const t = testApp()
    const registered = await registerAccount(t, account)
    const userId = registered.body.user.id as string
    const store = new TitleStore(t.db)
    const statusOf = async (id: string) => {
      const library = await t.request('GET', '/api/library')
      return (library.body.entries as { titleId: string; status: string }[]).find(
        (e) => e.titleId === id,
      )?.status
    }
    // First import with a known recent list: played-but-not-recent games start paused.
    importSteamLibrary(
      t.db,
      store,
      userId,
      [
        { appid: 400, name: 'Portal', playtimeMinutes: 600 },
        { appid: 620, name: 'Portal 2', playtimeMinutes: 300 },
        { appid: 70, name: 'Half-Life', playtimeMinutes: 900 },
      ],
      new Set([400]),
    )
    expect(await statusOf('steam-400')).toBe('in_progress')
    expect(await statusOf('steam-620')).toBe('paused')
    updateEntry(t.db, userId, 'steam-70', { status: 'completed' })

    // Two weeks later: Portal not played, Portal 2 played again, Half-Life replayed.
    const result = importSteamLibrary(
      t.db,
      store,
      userId,
      [
        { appid: 400, name: 'Portal', playtimeMinutes: 600 },
        { appid: 620, name: 'Portal 2', playtimeMinutes: 420 },
        { appid: 70, name: 'Half-Life', playtimeMinutes: 960 },
      ],
      new Set([620, 70]),
    )
    expect(result).toMatchObject({ updated: 2, resumed: 1, paused: 1 })
    expect(await statusOf('steam-400')).toBe('paused')
    expect(await statusOf('steam-620')).toBe('in_progress')
    expect(await statusOf('steam-70')).toBe('completed')
  })

  it('never pauses without a recent list (no API key)', async () => {
    const t = testApp()
    const registered = await registerAccount(t, account)
    const userId = registered.body.user.id as string
    const store = new TitleStore(t.db)
    const games = [{ appid: 400, name: 'Portal', playtimeMinutes: 600 }]
    importSteamLibrary(t.db, store, userId, games)
    expect(importSteamLibrary(t.db, store, userId, games)).toMatchObject({ paused: 0 })
  })
})
