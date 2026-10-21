import { titleId } from '../../shared/ids.ts'
import type { TitleRecord } from '../../shared/types.ts'
import type { DB } from '../db/index.ts'
import { ApiError } from '../http/errors.ts'
import { createEntry, getEntry, updateEntry } from './entries.ts'
import type { TitleStore } from './titles.ts'

export interface OwnedGame {
  appid: number
  name: string
  playtimeMinutes: number
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

/** Best effort: public game lists render right in the HTML, no key needed. Exported for tests. */
export function parseGamesPage(html: string): OwnedGame[] {
  const games = new Map<number, OwnedGame>()
  // Embedded data: {"appid":400,"name":"Portal",...,"hours_forever":"12.5",...}
  const jsonRe = /\{[^{}]*"appid"\s*:\s*"?(\d+)"?[^{}]*?\}/g
  let match: RegExpExecArray | null
  while ((match = jsonRe.exec(html)) !== null) {
    const block = match[0]
    const appid = Number(match[1])
    if (!appid || games.has(appid)) continue
    const name = /"name"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(block)?.[1]
    const hours = /"hours_forever"\s*:\s*"([^"]*)"/.exec(block)?.[1]
    if (name) {
      games.set(appid, {
        appid,
        name: decodeEntities(name.replace(/\\"/g, '"')),
        playtimeMinutes: Math.round(parseFloat((hours ?? '').replace(',', '.')) * 60) || 0,
      })
    }
  }
  if (!games.size) {
    // Legacy rows: a store link, a name cell and an "N hrs on record" cell per game.
    const rowRe =
      /\/app\/(\d+)[\s\S]{0,2000}?gameListRowItemName[^>]*>([^<]+)<[\s\S]{0,2000}?([\d.,]+)\s*hrs on record/gi
    while ((match = rowRe.exec(html)) !== null) {
      const appid = Number(match[1])
      if (!appid || games.has(appid)) continue
      games.set(appid, {
        appid,
        name: decodeEntities(match[2].trim()),
        playtimeMinutes: Math.round(parseFloat(match[3].replace(',', '.')) * 60) || 0,
      })
    }
  }
  return [...games.values()]
}

async function fetchOwnedGamesPublic(steamId: string): Promise<OwnedGame[]> {
  const html = await fetch(
    `https://steamcommunity.com/profiles/${encodeURIComponent(steamId)}/games/?tab=all`,
    { headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'english' } },
  )
    .then((response) => response.text())
    .catch(() => {
      throw new ApiError(502, 'CATALOG_UNAVAILABLE', 'Steam did not answer')
    })
  const games = parseGamesPage(html)
  if (!games.length) throw new ApiError(403, 'PROFILE_PRIVATE', 'Steam profile is private')
  return games
}

/**
 * Recent games from the open part of the profile (best effort, partial list).
 * Exported for tests.
 */
export function parseProfileGames(html: string): OwnedGame[] {
  const games = new Map<number, OwnedGame>()
  const re =
    /\/app\/(\d+)[\s\S]{0,3000}?([\d.,]+)\s*hrs on record[\s\S]{0,500}?game_name[^>]*><a[^>]*>([^<]+)</g
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    const appid = Number(match[1])
    if (!appid || games.has(appid)) continue
    games.set(appid, {
      appid,
      name: decodeEntities(match[3].trim()),
      playtimeMinutes: Math.round(parseFloat(match[2].replace(',', '.')) * 60) || 0,
    })
  }
  return [...games.values()]
}

async function fetchProfileGames(steamId: string): Promise<OwnedGame[]> {
  const html = await fetch(`https://steamcommunity.com/profiles/${encodeURIComponent(steamId)}/`, {
    headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'english' },
  })
    .then((response) => response.text())
    .catch(() => {
      throw new ApiError(502, 'CATALOG_UNAVAILABLE', 'Steam did not answer')
    })
  const games = parseProfileGames(html)
  if (!games.length) throw new ApiError(403, 'PROFILE_PRIVATE', 'Steam profile is private')
  return games
}

/**
 * Owned games: official API when the site key is set, otherwise the public
 * games page, otherwise recent games from the profile (partial list).
 * Either way the user does nothing.
 */
export async function fetchOwnedGames(
  apiKey: string | null,
  steamId: string,
): Promise<{ games: OwnedGame[]; partial: boolean }> {
  if (apiKey) {
    try {
      const games = await fetchOwnedGamesApi(apiKey, steamId)
      return { games, partial: false }
    } catch {
      // A bad/expired key or a private profile both fall back to keyless paths.
    }
  }
  try {
    return { games: await fetchOwnedGamesPublic(steamId), partial: false }
  } catch (error) {
    if (error instanceof ApiError && error.code !== 'PROFILE_PRIVATE') throw error
    // The full list sits behind a login wall; take the visible recent games.
    return { games: await fetchProfileGames(steamId), partial: true }
  }
}

async function fetchOwnedGamesApi(apiKey: string, steamId: string): Promise<OwnedGame[]> {
  const url =
    `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/` +
    `?key=${encodeURIComponent(apiKey)}&steamid=${encodeURIComponent(steamId)}` +
    `&include_appinfo=1&include_played_free_games=1&format=json`
  let json: { response?: { games?: { appid: number; name?: string; playtime_forever?: number }[] } }
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Steam: ${response.status}`)
    json = (await response.json()) as typeof json
  } catch {
    throw new ApiError(502, 'CATALOG_UNAVAILABLE', 'Steam did not answer')
  }
  if (!json.response?.games) throw new ApiError(403, 'PROFILE_PRIVATE', 'Steam profile is private')
  return json.response.games.map((game) => ({
    appid: game.appid,
    name: game.name ?? `App ${game.appid}`,
    playtimeMinutes: game.playtime_forever ?? 0,
  }))
}

/**
 * App ids played in the last two weeks (official API, needs a key).
 * Null when unknown: no key, bad key, private profile or Steam down.
 */
export async function fetchRecentAppIds(
  apiKey: string | null,
  steamId: string,
): Promise<Set<number> | null> {
  if (!apiKey) return null
  const url =
    `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/` +
    `?key=${encodeURIComponent(apiKey)}&steamid=${encodeURIComponent(steamId)}&format=json`
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const json = (await response.json()) as {
      response?: { total_count?: number; games?: { appid: number }[] }
    }
    // A private profile answers with an empty object, not an empty list.
    if (!json.response || json.response.total_count === undefined) return null
    return new Set((json.response.games ?? []).map((game) => game.appid))
  } catch {
    return null
  }
}

/** Minimal record from the app list: details load when the title is opened. */
export function steamAppRecord(appid: number, name: string): TitleRecord {
  return {
    id: titleId.steam(appid),
    kind: 'game',
    names: { original: name },
    year: null,
    poster: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`,
    backdrop: null,
    genres: [],
    ratings: [],
    externalIds: { steam: String(appid) },
  }
}

export interface SteamImportResult {
  total: number
  imported: number
  /** Already in the library: rating and notes are left untouched. */
  existing: number
  /** Of `existing`: Steam entries whose hours went up. */
  updated: number
  /** Of `existing`: planned/paused games played again → in progress. */
  resumed: number
  /** Of `existing`: in-progress games not played in two weeks → paused. */
  paused: number
  /** Could not be stored. */
  failed: number
  /** existing + failed, kept for older clients. */
  skipped: number
}

const toHours = (minutes: number) => Math.round((minutes / 60) * 10) / 10 || null

/**
 * Adds owned games as Steam entries and, on re-runs, syncs existing ones.
 *
 * Status rules (Steam entries only; completed and dropped are never touched):
 * - hours went up → planned/paused becomes in progress;
 * - `recent` known and the game is not in it, hours unchanged → in progress becomes paused.
 * Without `recent` (no API key) nothing is ever paused automatically.
 */
export function importSteamLibrary(
  db: DB,
  titles: TitleStore,
  userId: string,
  games: OwnedGame[],
  recent: Set<number> | null = null,
): SteamImportResult {
  let imported = 0
  let existing = 0
  let updated = 0
  let resumed = 0
  let paused = 0
  let failed = 0
  for (const game of games) {
    try {
      const record = steamAppRecord(game.appid, game.name)
      const current = getEntry(db, userId, record.id)
      if (current) {
        existing += 1
        if (current.store !== 'steam') continue
        const hours = toHours(game.playtimeMinutes)
        const grew = hours !== null && hours > (current.hours ?? 0)
        if (grew) {
          const resume = current.status === 'planned' || current.status === 'paused'
          updateEntry(db, userId, record.id, resume ? { hours, status: 'in_progress' } : { hours })
          updated += 1
          if (resume) resumed += 1
        } else if (recent && current.status === 'in_progress' && !recent.has(game.appid)) {
          updateEntry(db, userId, record.id, { status: 'paused' })
          paused += 1
        }
        continue
      }
      titles.putImported(record)
      const played = game.playtimeMinutes > 0
      createEntry(db, userId, record, {
        status: !played ? 'planned' : recent && !recent.has(game.appid) ? 'paused' : 'in_progress',
      })
      updateEntry(db, userId, record.id, {
        store: 'steam',
        platform: 'pc',
        hours: toHours(game.playtimeMinutes),
      })
      imported += 1
    } catch {
      failed += 1
    }
  }
  return {
    total: games.length,
    imported,
    existing,
    updated,
    resumed,
    paused,
    failed,
    skipped: existing + failed,
  }
}
