// Relative import (not @shared): unit tests type-check this file under tsconfig.node.json,
// which has no path aliases.
import type { TitleRecord } from '../../shared/types.ts'

const PREFIX = 'mediashelf:recent-titles'
const LIMIT = 6

/**
 * Who opened the titles: a user id, or null for a guest. Each account gets its own list, so the
 * next person signing in on a shared browser doesn't see what the previous one was browsing.
 */
export type RecentOwner = string | null

const keyFor = (owner: RecentOwner) => `${PREFIX}:${owner ?? 'guest'}`

/** Titles the owner opened lately, newest first. Device-local, nothing leaves the browser. */
export function readRecent(owner: RecentOwner): TitleRecord[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(keyFor(owner)) ?? '[]')
    return Array.isArray(value) ? (value as TitleRecord[]).slice(0, LIMIT) : []
  } catch {
    return []
  }
}

export function rememberTitle(title: TitleRecord, owner: RecentOwner) {
  // Only what a list row needs, so a long description never fills the storage.
  const slim: TitleRecord = {
    id: title.id,
    kind: title.kind,
    names: title.names,
    year: title.year,
    endYear: title.endYear,
    airing: title.airing,
    poster: title.poster,
    backdrop: null,
    genres: [],
    ratings: [],
    externalIds: {},
  }
  try {
    const next = [slim, ...readRecent(owner).filter((item) => item.id !== slim.id)].slice(0, LIMIT)
    localStorage.setItem(keyFor(owner), JSON.stringify(next))
    // The single list used before accounts got their own; nobody can tell whose it was.
    localStorage.removeItem(PREFIX)
  } catch {
    /* private mode or full storage: recents are a nicety */
  }
}

/** Forgets the owner's list (a deleted account, or the guest list when the person changes). */
export function forgetRecent(owner: RecentOwner) {
  try {
    localStorage.removeItem(keyFor(owner))
    localStorage.removeItem(PREFIX)
  } catch {
    /* ignore */
  }
}
