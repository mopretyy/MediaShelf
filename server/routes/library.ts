import { Hono } from 'hono'
import { z } from 'zod'
import {
  entryCreateSchema,
  entryPatchSchema,
  episodeNoteSchema,
  episodesMarkSchema,
  playthroughPatchSchema,
  playthroughSchema,
  titleIdSchema,
} from '../../shared/schemas.ts'
import { isTitleId } from '../../shared/ids.ts'
import { parseJson } from '../db/index.ts'
import {
  limit,
  requireUser,
  requestLocale,
  requestRegion,
  type AppContext,
  type AppDeps,
  type AppEnv,
} from '../context.ts'
import { ApiError, notFound } from '../http/errors.ts'
import { listActivity } from '../library/activity.ts'
import {
  addDays,
  CALENDAR_MAX_DAYS,
  computeAiring,
  computeCalendar,
  isDay,
  pickRefreshes,
  staleEpisodeLists,
} from '../library/airing.ts'
import {
  addPlaythrough,
  createEntry,
  deleteEntry,
  deletePlaythrough,
  getEntry,
  listEntries,
  listEpisodeMarks,
  markEpisodes,
  markNextEpisode,
  setEpisodeNote,
  updateEntry,
  updatePlaythrough,
} from '../library/entries.ts'
import { ensureEpisodeList, episodeList, resolveTitle } from '../library/resolve.ts'
import { computeStats } from '../library/stats.ts'
import { exportEntry, importEntries } from '../library/transfer.ts'
import type { PlatformId } from '../../shared/types.ts'

export function libraryRoutes(deps: AppDeps) {
  const { db, limits } = deps
  const app = new Hono<AppEnv>()
  // Episode-feed background refreshes: when each title was last attempted, and which still run.
  const refreshTried = new Map<string, number>()
  const refreshing = new Set<string>()

  app.use('*', async (c, next) => {
    if (c.req.method !== 'GET') limit(limits, 'library', c.get('user')?.id ?? 'anonymous')
    await next()
  })

  const titleParam = (value: string) => titleIdSchema.parse(value)
  const hasEpisodes = (id: string) => /^(series|tvmaze|anime)-/.test(id)

  app.get('/', (c) => {
    const user = requireUser(c)
    return c.json({ entries: listEntries(db, user.id) })
  })

  app.get('/stats', (c) => {
    const user = requireUser(c)
    const offset = Number(c.req.query('tz') ?? 0)
    const timeZone = c.req.query('zone')
    return c.json(
      computeStats(db, user.id, {
        timeZone: timeZone && timeZone.length <= 64 ? timeZone : undefined,
        offsetMinutes: Number.isFinite(offset) ? offset : 0,
      }),
    )
  })

  app.get('/activity', (c) => {
    const user = requireUser(c)
    const query = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).default(30),
        before: z.coerce.number().int().min(1).optional(),
      })
      .parse(c.req.query())
    return c.json({ items: listActivity(db, user.id, query.limit, query.before) })
  })

  // New and upcoming episodes of followed shows. Lists that are missing or due are refreshed in
  // the background; `refreshing` tells the client to ask again shortly instead of waiting here.
  /** Starts background refreshes of due episode lists; true while any of them still runs. */
  const refreshDueLists = (c: AppContext, userId: string) => {
    const stale = staleEpisodeLists(db, userId)
    const batch = pickRefreshes(stale, refreshTried)
    const locale = requestLocale(c)
    const region = requestRegion(c)
    for (const id of batch) {
      refreshing.add(id)
      void episodeList(deps, id, locale, region)
        .catch(() => null)
        .finally(() => refreshing.delete(id))
    }
    // Still true while an earlier request's refresh runs, so the client keeps polling until done.
    return batch.length > 0 || stale.some((id) => refreshing.has(id))
  }

  app.get('/airing', (c) => {
    const user = requireUser(c)
    const requested = c.req.query('today')
    const today = isDay(requested) ? requested : new Date().toISOString().slice(0, 10)
    const busy = refreshDueLists(c, user.id)
    return c.json({ ...computeAiring(db, user.id, today), refreshing: busy })
  })

  // Episodes of followed shows between two days (the month calendar), watched or not. At most
  // six weeks per request: a month grid with its leading and trailing days.
  app.get('/calendar', (c) => {
    const user = requireUser(c)
    const from = c.req.query('from')
    const to = c.req.query('to')
    if (!isDay(from) || !isDay(to) || to < from || addDays(from, CALENDAR_MAX_DAYS - 1) < to)
      throw new ApiError(400, 'BAD_REQUEST', 'from and to must be days at most six weeks apart')
    const busy = refreshDueLists(c, user.id)
    return c.json({ ...computeCalendar(db, user.id, from, to), refreshing: busy })
  })

  app.post('/', async (c) => {
    const user = requireUser(c)
    const input = entryCreateSchema.parse(await c.req.json())
    const locale = requestLocale(c)
    const region = requestRegion(c)
    const title = await resolveTitle(deps, input.titleId, locale, region)
    if (hasEpisodes(title.id) && input.status === 'completed')
      await ensureEpisodeList(deps, title.id, locale, region)
    const preferences = parseJson<{ platforms?: PlatformId[] }>(user.preferences, {})
    const platform = preferences.platforms?.length === 1 ? preferences.platforms[0] : null
    const result = createEntry(db, user.id, title, { ...input, platform })
    // Warm the episode list so progress and "next episode" are ready on the next view.
    if (hasEpisodes(title.id)) void ensureEpisodeList(deps, title.id, locale, region)
    return c.json(result, result.created ? 201 : 200)
  })

  app.get('/:titleId', (c) => {
    const user = requireUser(c)
    const entry = getEntry(db, user.id, titleParam(c.req.param('titleId')))
    if (!entry) throw notFound('Entry not found')
    return c.json({ entry })
  })

  app.patch('/:titleId', async (c) => {
    const user = requireUser(c)
    const titleId = titleParam(c.req.param('titleId'))
    const patch = entryPatchSchema.parse(await c.req.json())
    if (patch.status === 'completed' && hasEpisodes(titleId)) {
      // Check ownership before touching upstream catalogs.
      if (!getEntry(db, user.id, titleId)) throw notFound('Entry not found')
      await ensureEpisodeList(deps, titleId, requestLocale(c), requestRegion(c))
    }
    return c.json(updateEntry(db, user.id, titleId, patch))
  })

  // Undo after a removal: the snapshot the DELETE returned (export format), put back as it was,
  // episode marks, playthroughs and dates included.
  app.post('/restore', async (c) => {
    const user = requireUser(c)
    const body = z.object({ entry: z.unknown() }).parse(await c.req.json())
    const titleId = (body.entry as { titleId?: unknown }).titleId
    // Added again (another tab, the palette) before Undo: never overwrite the newer entry.
    if (typeof titleId === 'string' && isTitleId(titleId) && getEntry(db, user.id, titleId))
      throw new ApiError(409, 'ENTRY_EXISTS', 'The title is already back in the library')
    const { imported } = importEntries(db, deps.titles, user.id, [body.entry])
    const entry = imported && typeof titleId === 'string' ? getEntry(db, user.id, titleId) : null
    if (!entry) throw new ApiError(400, 'VALIDATION', 'Snapshot could not be restored')
    return c.json({ entry, marks: listEpisodeMarks(db, user.id, entry.titleId) })
  })

  app.delete('/:titleId', (c) => {
    const user = requireUser(c)
    const titleId = titleParam(c.req.param('titleId'))
    const entry = getEntry(db, user.id, titleId)
    if (!entry) throw notFound('Entry not found')
    // Everything the delete wipes (marks and playthroughs cascade), so Undo can restore it.
    const snapshot = exportEntry(db, user.id, entry)
    deleteEntry(db, user.id, titleId)
    return c.json({ ok: true, snapshot })
  })

  app.get('/:titleId/episodes', (c) => {
    const user = requireUser(c)
    const titleId = titleParam(c.req.param('titleId'))
    return c.json({ marks: listEpisodeMarks(db, user.id, titleId) })
  })

  app.post('/:titleId/episodes', async (c) => {
    const user = requireUser(c)
    const titleId = titleParam(c.req.param('titleId'))
    const input = episodesMarkSchema.parse(await c.req.json())
    if (!getEntry(db, user.id, titleId)) throw notFound('Entry not found')
    await ensureEpisodeList(deps, titleId, requestLocale(c), requestRegion(c))
    const result = markEpisodes(db, user.id, titleId, input.episodes, input.watched)
    return c.json({ ...result, marks: listEpisodeMarks(db, user.id, titleId) })
  })

  app.post('/:titleId/episodes/next', async (c) => {
    const user = requireUser(c)
    const titleId = titleParam(c.req.param('titleId'))
    if (!getEntry(db, user.id, titleId)) throw notFound('Entry not found')
    await ensureEpisodeList(deps, titleId, requestLocale(c), requestRegion(c))
    const result = markNextEpisode(db, user.id, titleId)
    return c.json({ ...result, marks: listEpisodeMarks(db, user.id, titleId) })
  })

  app.put('/:titleId/episodes/note', async (c) => {
    const user = requireUser(c)
    const titleId = titleParam(c.req.param('titleId'))
    const input = episodeNoteSchema.parse(await c.req.json())
    return c.json({ marks: setEpisodeNote(db, user.id, titleId, input) })
  })

  app.post('/:titleId/playthroughs', async (c) => {
    const user = requireUser(c)
    const titleId = titleParam(c.req.param('titleId'))
    const input = playthroughSchema.parse(await c.req.json())
    return c.json({ entry: addPlaythrough(db, user.id, titleId, input) }, 201)
  })

  app.patch('/:titleId/playthroughs/:id', async (c) => {
    const user = requireUser(c)
    const titleId = titleParam(c.req.param('titleId'))
    const id = z.uuid().parse(c.req.param('id'))
    const patch = playthroughPatchSchema.parse(await c.req.json())
    return c.json({ entry: updatePlaythrough(db, user.id, titleId, id, patch) })
  })

  app.delete('/:titleId/playthroughs/:id', (c) => {
    const user = requireUser(c)
    const titleId = titleParam(c.req.param('titleId'))
    const id = z.uuid().parse(c.req.param('id'))
    return c.json({ entry: deletePlaythrough(db, user.id, titleId, id) })
  })

  return app
}
