import type { CollectionDetail, CollectionSummary, TitleRecord } from '../../shared/types.ts'
import { sql, transaction, type DB } from '../db/index.ts'
import { ApiError, notFound } from '../http/errors.ts'

export const MAX_COLLECTIONS = 100
export const MAX_COLLECTION_ITEMS = 500

interface CollectionRow {
  id: string
  user_id: string
  name: string
  description: string
  updated_at: number
}

const iso = (ms: number) => new Date(ms).toISOString()

function summaryOf(db: DB, row: CollectionRow): CollectionSummary {
  const { count } = sql(
    db,
    'SELECT COUNT(*) AS count FROM collection_items WHERE collection_id = ?',
  ).get(row.id) as { count: number }
  const posters = (
    sql(
      db,
      `SELECT t.data FROM collection_items i JOIN titles t ON t.id = i.title_id
       WHERE i.collection_id = ? ORDER BY i.added_at DESC, i.title_id LIMIT 12`,
    ).all(row.id) as { data: string }[]
  )
    .map((item) => (JSON.parse(item.data) as TitleRecord).poster)
    .filter((poster): poster is string => Boolean(poster))
    .slice(0, 4)
  const owner = sql(db, 'SELECT name FROM users WHERE id = ?').get(row.user_id) as
    { name: string } | undefined
  return {
    id: row.id,
    ownerId: row.user_id,
    ownerName: owner?.name ?? '',
    name: row.name,
    description: row.description,
    count,
    posters,
    updatedAt: iso(row.updated_at),
  }
}

/** A user's collections, the most recently changed first; with `titleId`, which hold it. */
export function listCollections(db: DB, userId: string, titleId?: string): CollectionSummary[] {
  const rows = sql(
    db,
    'SELECT id, user_id, name, description, updated_at FROM collections WHERE user_id = ? ORDER BY updated_at DESC, id',
  ).all(userId) as unknown as CollectionRow[]
  const holding = titleId
    ? new Set(
        (
          sql(
            db,
            `SELECT i.collection_id FROM collection_items i JOIN collections c ON c.id = i.collection_id
             WHERE c.user_id = ? AND i.title_id = ?`,
          ).all(userId, titleId) as { collection_id: string }[]
        ).map((row) => row.collection_id),
      )
    : null
  return rows.map((row) => ({
    ...summaryOf(db, row),
    ...(holding ? { contains: holding.has(row.id) } : {}),
  }))
}

function findRow(db: DB, id: string) {
  return sql(
    db,
    'SELECT id, user_id, name, description, updated_at FROM collections WHERE id = ?',
  ).get(id) as CollectionRow | undefined
}

/** A collection with its titles; any signed-in viewer may see it, as with profiles. */
export function getCollection(db: DB, id: string): CollectionDetail {
  const row = findRow(db, id)
  if (!row) throw notFound('Collection not found')
  const items = (
    sql(
      db,
      `SELECT t.data, i.added_at FROM collection_items i JOIN titles t ON t.id = i.title_id
       WHERE i.collection_id = ? ORDER BY i.added_at DESC, i.title_id`,
    ).all(id) as { data: string; added_at: number }[]
  ).map((item) => ({ title: JSON.parse(item.data) as TitleRecord, addedAt: iso(item.added_at) }))
  return { ...summaryOf(db, row), items }
}

/** The collection, if it belongs to the user: others' collections are read-only (404). */
function ownRow(db: DB, userId: string, id: string) {
  const row = findRow(db, id)
  if (!row || row.user_id !== userId) throw notFound('Collection not found')
  return row
}

export function createCollection(
  db: DB,
  userId: string,
  input: { name: string; description?: string },
): CollectionSummary {
  const { count } = sql(db, 'SELECT COUNT(*) AS count FROM collections WHERE user_id = ?').get(
    userId,
  ) as { count: number }
  if (count >= MAX_COLLECTIONS)
    throw new ApiError(409, 'LIMIT_REACHED', `At most ${MAX_COLLECTIONS} collections`)
  const id = crypto.randomUUID()
  const now = Date.now()
  sql(
    db,
    'INSERT INTO collections (id, user_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, userId, input.name, input.description ?? '', now, now)
  return summaryOf(db, findRow(db, id)!)
}

export function updateCollection(
  db: DB,
  userId: string,
  id: string,
  input: { name?: string; description?: string },
): CollectionSummary {
  const row = ownRow(db, userId, id)
  sql(db, 'UPDATE collections SET name = ?, description = ?, updated_at = ? WHERE id = ?').run(
    input.name ?? row.name,
    input.description ?? row.description,
    Date.now(),
    id,
  )
  return summaryOf(db, findRow(db, id)!)
}

export function deleteCollection(db: DB, userId: string, id: string) {
  ownRow(db, userId, id)
  sql(db, 'DELETE FROM collections WHERE id = ?').run(id)
}

/** Adds a title (already stored in `titles`); adding it twice changes nothing. */
export function addToCollection(db: DB, userId: string, id: string, titleId: string) {
  ownRow(db, userId, id)
  transaction(db, () => {
    const exists = sql(
      db,
      'SELECT 1 FROM collection_items WHERE collection_id = ? AND title_id = ?',
    ).get(id, titleId)
    if (exists) return
    const { count } = sql(
      db,
      'SELECT COUNT(*) AS count FROM collection_items WHERE collection_id = ?',
    ).get(id) as { count: number }
    if (count >= MAX_COLLECTION_ITEMS)
      throw new ApiError(409, 'LIMIT_REACHED', `At most ${MAX_COLLECTION_ITEMS} titles`)
    const now = Date.now()
    sql(
      db,
      'INSERT INTO collection_items (collection_id, title_id, added_at) VALUES (?, ?, ?)',
    ).run(id, titleId, now)
    sql(db, 'UPDATE collections SET updated_at = ? WHERE id = ?').run(now, id)
  })
  return summaryOf(db, findRow(db, id)!)
}

export function removeFromCollection(db: DB, userId: string, id: string, titleId: string) {
  ownRow(db, userId, id)
  const result = sql(
    db,
    'DELETE FROM collection_items WHERE collection_id = ? AND title_id = ?',
  ).run(id, titleId)
  if (result.changes)
    sql(db, 'UPDATE collections SET updated_at = ? WHERE id = ?').run(Date.now(), id)
  return summaryOf(db, findRow(db, id)!)
}
