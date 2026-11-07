import { z } from 'zod'
import { isTitleId, kindOfTitleId } from '../../shared/ids.ts'
import { isStatusAllowed } from '../../shared/status.ts'
import type { LibraryEntry, TitleRecord, User } from '../../shared/types.ts'
import { KINDS, PLATFORMS, STATUSES, STORES } from '../../shared/types.ts'
import { sql, transaction, type DB } from '../db/index.ts'
import {
  listEntries,
  listEpisodeMarks,
  MAX_ENTRIES,
  MAX_PLAYTHROUGHS,
  refreshEpisodeCounters,
} from './entries.ts'
import { MAX_COLLECTION_ITEMS, MAX_COLLECTIONS } from './collections.ts'
import type { TitleStore } from './titles.ts'

// Imported artwork may only point at the image CDNs the catalogs themselves use.
const IMAGE_HOSTS = [
  'steamstatic.com',
  'steampowered.com',
  'gog-statics.com',
  'gog.com',
  'media-amazon.com',
  'metahub.space',
  'strem.io',
  'tvmaze.com',
  'shikimori.io',
  'shikimori.one',
  'anilist.co',
  'myanimelist.net',
  'wikimedia.org',
]
const httpsUrl = z
  .string()
  .max(2000)
  .refine((value) => {
    try {
      const url = new URL(value)
      return (
        url.protocol === 'https:' &&
        IMAGE_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
      )
    } catch {
      return false
    }
  })
const text = (max: number) => z.string().max(max)
const iso = z.iso.datetime({ offset: true }).nullable().optional()

const titleSchema = z.object({
  id: z.string().refine(isTitleId),
  kind: z.enum(KINDS),
  names: z.object({
    original: text(300).min(1),
    en: text(300).optional(),
    ru: text(300).optional(),
  }),
  year: z.number().int().min(1850).max(2200).nullable(),
  poster: httpsUrl.nullable().catch(null),
  backdrop: httpsUrl.nullable().catch(null),
  genres: z.array(text(60)).max(10).catch([]),
  ratings: z
    .array(
      z.object({
        source: z.enum(['imdb', 'steam', 'shikimori', 'metacritic', 'tvmaze', 'anilist']),
        value: z.number().min(0).max(100),
        max: z.union([z.literal(10), z.literal(100)]),
        votes: z.number().int().min(0).optional(),
      }),
    )
    .max(6)
    .catch([]),
  runtime: z.number().int().min(0).max(100000).nullable().optional().catch(null),
  seasons: z.number().int().min(0).max(1000).nullable().optional().catch(null),
  episodes: z.number().int().min(0).max(100000).nullable().optional().catch(null),
  externalIds: z.record(z.string().max(30), text(40)).catch({}),
})

const entrySchema = z.object({
  titleId: z.string().refine(isTitleId),
  status: z.enum(STATUSES),
  rating: z.number().int().min(1).max(10).nullable().catch(null),
  favorite: z.boolean().catch(false),
  notes: text(5000).catch(''),
  progress: z.number().int().min(0).max(100).catch(0),
  platform: z.enum(PLATFORMS).nullable().catch(null),
  store: z.enum(STORES).nullable().catch(null),
  hours: z.number().min(0).max(100000).nullable().catch(null),
  addedAt: iso,
  startedAt: iso,
  finishedAt: iso,
  position: z.number().finite().catch(0),
  title: titleSchema,
  playthroughs: z
    .array(
      z.object({
        label: text(80).catch(''),
        platform: z.enum(PLATFORMS).nullable().catch(null),
        store: z.enum(STORES).nullable().catch(null),
        status: z.enum(STATUSES).catch('in_progress'),
        progress: z.number().int().min(0).max(100).catch(0),
        hours: z.number().min(0).max(100000).nullable().catch(null),
        startedAt: iso,
        finishedAt: iso,
        note: text(2000).catch(''),
      }),
    )
    .max(MAX_PLAYTHROUGHS)
    .catch([]),
  episodes: z
    .array(
      z.object({
        season: z.number().int().min(0).max(500),
        number: z.number().int().min(0).max(100000),
        watchedAt: iso,
        rating: z.number().int().min(1).max(10).nullable().catch(null),
        note: text(2000).catch(''),
        // Marked by "completed" rather than by hand: leaving "completed" clears it again.
        auto: z.boolean().optional().catch(undefined),
      }),
    )
    .max(20000)
    .catch([]),
})

const collectionSchema = z.object({
  name: text(80).trim().min(1),
  description: text(500).catch(''),
  cover: z.string().refine(isTitleId).nullable().optional().catch(null),
  items: z
    .array(z.object({ titleId: z.string().refine(isTitleId), addedAt: iso, title: titleSchema }))
    .max(MAX_COLLECTION_ITEMS)
    .catch([]),
})

export const importSchema = z.object({
  // Legacy 'mediadeck' files still import after the rename to MediaShell.
  format: z.enum(['mediashelf', 'mediadeck']),
  version: z.literal(4),
  entries: z.array(z.unknown()).max(MAX_ENTRIES),
  // Added later in version 4: files without it import as before.
  collections: z.array(z.unknown()).max(MAX_COLLECTIONS).optional(),
})

/** The part of a title record an export carries: enough to show it before a refresh. */
function titleSnapshot(db: DB, titleId: string) {
  const stored = sql(db, 'SELECT data FROM titles WHERE id = ?').get(titleId) as { data: string }
  const title = JSON.parse(stored.data) as TitleRecord
  return {
    id: title.id,
    kind: title.kind,
    names: title.names,
    year: title.year,
    poster: title.poster,
    backdrop: title.backdrop,
    genres: title.genres,
    ratings: title.ratings,
    runtime: title.runtime ?? null,
    seasons: title.seasons ?? null,
    episodes: title.episodes ?? null,
    externalIds: title.externalIds,
  }
}

/** One entry in export format: everything needed to recreate it, marks and playthroughs included. */
export function exportEntry(db: DB, userId: string, entry: LibraryEntry) {
  return {
    titleId: entry.titleId,
    status: entry.status,
    rating: entry.rating,
    favorite: entry.favorite,
    notes: entry.notes,
    progress: entry.progress,
    platform: entry.platform,
    store: entry.store,
    hours: entry.hours,
    addedAt: entry.addedAt,
    startedAt: entry.startedAt,
    finishedAt: entry.finishedAt,
    position: entry.position,
    title: titleSnapshot(db, entry.titleId),
    playthroughs: entry.playthroughs.map(({ id: _id, updatedAt: _updated, ...rest }) => rest),
    episodes: snapshotMarks(db, userId, entry.titleId),
  }
}

/** Episode marks as `listEpisodeMarks` returns them, plus whether "completed" set them. */
function snapshotMarks(db: DB, userId: string, titleId: string) {
  const auto = new Set(
    (
      sql(
        db,
        'SELECT season, number FROM episode_marks WHERE user_id = ? AND title_id = ? AND auto = 1',
      ).all(userId, titleId) as { season: number; number: number }[]
    ).map((row) => `${row.season}:${row.number}`),
  )
  return listEpisodeMarks(db, userId, titleId).map((mark) =>
    auto.has(`${mark.season}:${mark.number}`) ? { ...mark, auto: true } : mark,
  )
}

export type EntrySnapshot = ReturnType<typeof exportEntry>

/** The user's collections with their titles, oldest first so an import keeps the order. */
function exportCollections(db: DB, userId: string) {
  const rows = sql(
    db,
    'SELECT id, name, description, cover_title_id FROM collections WHERE user_id = ? ORDER BY updated_at, id',
  ).all(userId) as {
    id: string
    name: string
    description: string
    cover_title_id: string | null
  }[]
  return rows.map((row) => ({
    name: row.name,
    description: row.description,
    cover: row.cover_title_id,
    items: (
      sql(
        db,
        'SELECT title_id, added_at FROM collection_items WHERE collection_id = ? ORDER BY added_at, title_id',
      ).all(row.id) as { title_id: string; added_at: number }[]
    ).map((item) => ({
      titleId: item.title_id,
      addedAt: new Date(item.added_at).toISOString(),
      title: titleSnapshot(db, item.title_id),
    })),
  }))
}

export function exportLibrary(db: DB, user: User) {
  const entries = listEntries(db, user.id).map((entry) => exportEntry(db, user.id, entry))
  return {
    format: 'mediashelf' as const,
    version: 4 as const,
    exportedAt: new Date().toISOString(),
    profile: { name: user.name, preferences: user.preferences },
    entries,
    collections: exportCollections(db, user.id),
  }
}

/**
 * Collections from an export: one with the same name gets the missing titles, a new one is
 * created otherwise (within the limits). Invalid collections and items are skipped.
 */
function importCollections(db: DB, titles: TitleStore, userId: string, collections: unknown[]) {
  let imported = 0
  transaction(db, () => {
    for (const raw of collections) {
      const parsed = collectionSchema.safeParse(raw)
      if (!parsed.success) continue
      const input = parsed.data
      let row = sql(db, 'SELECT id FROM collections WHERE user_id = ? AND name = ?').get(
        userId,
        input.name,
      ) as { id: string } | undefined
      const now = Date.now()
      if (!row) {
        const { count } = sql(
          db,
          'SELECT COUNT(*) AS count FROM collections WHERE user_id = ?',
        ).get(userId) as { count: number }
        if (count >= MAX_COLLECTIONS) continue
        row = { id: crypto.randomUUID() }
        sql(
          db,
          'INSERT INTO collections (id, user_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        ).run(row.id, userId, input.name, input.description, now, now)
      }
      const insert = sql(
        db,
        'INSERT OR IGNORE INTO collection_items (collection_id, title_id, added_at) VALUES (?, ?, ?)',
      )
      for (const item of input.items) {
        if (item.title.id !== item.titleId || kindOfTitleId(item.titleId) !== item.title.kind)
          continue
        const { count } = sql(
          db,
          'SELECT COUNT(*) AS count FROM collection_items WHERE collection_id = ?',
        ).get(row.id) as { count: number }
        if (count >= MAX_COLLECTION_ITEMS) break
        titles.putImported(item.title as TitleRecord)
        insert.run(row.id, item.titleId, ms(item.addedAt) ?? now)
      }
      // The picked cover comes along when its title did and nothing was picked here yet.
      if (input.cover)
        sql(
          db,
          `UPDATE collections SET cover_title_id = ? WHERE id = ? AND cover_title_id IS NULL
             AND EXISTS (SELECT 1 FROM collection_items WHERE collection_id = ? AND title_id = ?)`,
        ).run(input.cover, row.id, row.id, input.cover)
      imported++
    }
  })
  return imported
}

const ms = (value: string | null | undefined) => (value ? Date.parse(value) : null)

/** Merges an export into the user's library; existing entries are overwritten. */
export function importLibrary(db: DB, titles: TitleStore, userId: string, payload: unknown) {
  const { entries, collections } = importSchema.parse(payload)
  const result = importEntries(db, titles, userId, entries)
  // Reported only when there were some, so the answer for older files stays as it was.
  const imported = importCollections(db, titles, userId, collections ?? [])
  return imported ? { ...result, collections: imported } : result
}

/**
 * Writes export-format entries (see `exportEntry`) in one transaction, skipping invalid ones.
 * Also used by Undo after a removal, which restores the snapshot the DELETE returned.
 */
export function importEntries(db: DB, titles: TitleStore, userId: string, entries: unknown[]) {
  let imported = 0
  let skipped = 0
  transaction(db, () => {
    const { count } = sql(db, 'SELECT COUNT(*) AS count FROM entries WHERE user_id = ?').get(
      userId,
    ) as { count: number }
    let room = MAX_ENTRIES - count
    for (const raw of entries) {
      const parsed = entrySchema.safeParse(raw)
      if (
        !parsed.success ||
        parsed.data.title.id !== parsed.data.titleId ||
        kindOfTitleId(parsed.data.titleId) !== parsed.data.title.kind ||
        !isStatusAllowed(parsed.data.title.kind, parsed.data.status)
      ) {
        skipped++
        continue
      }
      const entry = parsed.data
      const exists = sql(db, 'SELECT 1 FROM entries WHERE user_id = ? AND title_id = ?').get(
        userId,
        entry.titleId,
      )
      if (!exists && room <= 0) {
        skipped++
        continue
      }
      if (!exists) room--
      titles.putImported(entry.title as TitleRecord)
      const now = Date.now()
      sql(
        db,
        `INSERT INTO entries (user_id, title_id, kind, status, rating, favorite, notes, progress, platform,
           store, hours, watched_episodes, total_episodes, next_episode, position, added_at, updated_at,
           started_at, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, title_id) DO UPDATE SET status = excluded.status, rating = excluded.rating,
           favorite = excluded.favorite, notes = excluded.notes, progress = excluded.progress,
           platform = excluded.platform, store = excluded.store, hours = excluded.hours,
           position = excluded.position, updated_at = excluded.updated_at,
           started_at = excluded.started_at, finished_at = excluded.finished_at`,
      ).run(
        userId,
        entry.titleId,
        entry.title.kind,
        entry.status,
        entry.rating,
        entry.favorite ? 1 : 0,
        entry.notes,
        entry.progress,
        entry.title.kind === 'game' ? entry.platform : null,
        entry.title.kind === 'game' ? entry.store : null,
        entry.title.kind === 'game' ? entry.hours : null,
        entry.title.episodes ?? null,
        entry.position,
        ms(entry.addedAt) ?? now,
        now,
        ms(entry.startedAt),
        ms(entry.finishedAt),
      )
      if (entry.title.kind === 'game') {
        sql(db, 'DELETE FROM playthroughs WHERE user_id = ? AND title_id = ?').run(
          userId,
          entry.titleId,
        )
        const insert = sql(
          db,
          `INSERT INTO playthroughs (id, user_id, title_id, label, platform, store, status, progress, hours,
             started_at, finished_at, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        for (const p of entry.playthroughs)
          insert.run(
            crypto.randomUUID(),
            userId,
            entry.titleId,
            p.label,
            p.platform,
            p.store,
            p.status,
            p.progress,
            p.hours,
            ms(p.startedAt),
            ms(p.finishedAt),
            p.note,
            now,
            now,
          )
      } else if (entry.title.kind !== 'movie') {
        const insert = sql(
          db,
          `INSERT INTO episode_marks (user_id, title_id, season, number, watched_at, rating, note, auto)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT DO UPDATE SET watched_at = excluded.watched_at, rating = excluded.rating,
             note = excluded.note, auto = excluded.auto`,
        )
        for (const e of entry.episodes)
          insert.run(
            userId,
            entry.titleId,
            e.season,
            e.number,
            ms(e.watchedAt),
            e.rating,
            e.note,
            e.auto && e.watchedAt ? 1 : 0,
          )
        const { count } = sql(
          db,
          'SELECT COUNT(*) AS count FROM episode_marks WHERE user_id = ? AND title_id = ? AND season > 0 AND watched_at IS NOT NULL',
        ).get(userId, entry.titleId) as { count: number }
        sql(db, 'UPDATE entries SET watched_episodes = ? WHERE user_id = ? AND title_id = ?').run(
          count,
          userId,
          entry.titleId,
        )
        // With a stored episode list this also restores "next episode" and the progress bar.
        refreshEpisodeCounters(db, userId, entry.titleId)
      }
      imported++
    }
  })
  return { imported, skipped }
}
