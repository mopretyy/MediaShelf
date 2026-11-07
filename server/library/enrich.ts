import type { Locale } from '../../shared/types.ts'
import type { AppDeps } from '../context.ts'
import { sql } from '../db/index.ts'
import { titleDetails } from './resolve.ts'

const MAX_TITLES = 1000
const WORKERS = 3
const running = new Set<string>()

function unverifiedTitles(deps: AppDeps, userId: string) {
  return (
    sql(
      deps.db,
      `SELECT t.id FROM titles t JOIN entries e ON e.title_id = t.id
       WHERE e.user_id = ? AND t.verified = 0 ORDER BY e.updated_at DESC LIMIT ?`,
    ).all(userId, MAX_TITLES) as { id: string }[]
  ).map((row) => row.id)
}

/**
 * Imported titles start as stubs (name, poster, year from the file). This fetches the real
 * catalog records in the background, so localised names, descriptions and backdrops fill in
 * without the user opening every title. Per-host throttling in the catalog client keeps the
 * sources happy. One run per user: an import that lands mid-run is picked up by the next scan,
 * and titles a source can't resolve are tried once per run.
 */
export async function enrichImportedTitles(
  deps: AppDeps,
  userId: string,
  locale: Locale,
  region: string,
) {
  if (running.has(userId)) return 0
  running.add(userId)
  const attempted = new Set<string>()
  let done = 0
  try {
    for (;;) {
      // No await between this scan and leaving the loop, so nothing imported can slip through.
      const ids = unverifiedTitles(deps, userId).filter((id) => !attempted.has(id))
      if (!ids.length || attempted.size >= MAX_TITLES) break
      for (const id of ids) attempted.add(id)
      let next = 0
      const worker = async () => {
        while (next < ids.length) {
          const id = ids[next++]
          if (await titleDetails(deps, id, locale, region).catch(() => null)) done++
        }
      }
      await Promise.all(Array.from({ length: WORKERS }, worker))
    }
  } finally {
    running.delete(userId)
  }
  return done
}
