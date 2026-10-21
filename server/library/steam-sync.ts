import { sql, type DB } from '../db/index.ts'

/** Automatic Steam syncs run at most this often per user. */
export const STEAM_SYNC_INTERVAL = 6 * 60 * 60_000
/** After a failed automatic sync, the next one may run this soon instead. */
export const STEAM_SYNC_RETRY = 30 * 60_000

/**
 * Reserves the next automatic sync for a user. False when one ran (or started) within the
 * interval, so several tabs or page loads never hit Steam twice.
 */
export function claimSteamSync(db: DB, userId: string, now = Date.now()): boolean {
  const result = sql(
    db,
    `INSERT INTO steam_sync (user_id, synced_at) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET synced_at = excluded.synced_at
     WHERE steam_sync.synced_at <= ?`,
  ).run(userId, now, now - STEAM_SYNC_INTERVAL)
  return Number(result.changes) > 0
}

/** Records a finished sync; manual imports count too. */
export function markSteamSynced(db: DB, userId: string, now = Date.now()) {
  sql(
    db,
    `INSERT INTO steam_sync (user_id, synced_at) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET synced_at = excluded.synced_at`,
  ).run(userId, now)
}

/** A failed sync is retried after STEAM_SYNC_RETRY rather than a full interval. */
export function deferSteamSync(db: DB, userId: string, now = Date.now()) {
  markSteamSynced(db, userId, now - STEAM_SYNC_INTERVAL + STEAM_SYNC_RETRY)
}
