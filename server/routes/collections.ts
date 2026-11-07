import { Hono } from 'hono'
import { z } from 'zod'
import { titleIdSchema } from '../../shared/schemas.ts'
import {
  limit,
  requestLocale,
  requestRegion,
  requireUser,
  type AppDeps,
  type AppEnv,
} from '../context.ts'
import {
  addToCollection,
  createCollection,
  deleteCollection,
  getCollection,
  listCollections,
  removeFromCollection,
  reorderCollection,
  updateCollection,
} from '../library/collections.ts'
import { resolveTitle } from '../library/resolve.ts'

const name = z.string().trim().min(1).max(80)
const description = z.string().trim().max(500)
const createSchema = z.object({ name, description: description.optional() })
const updateSchema = z
  .object({
    name: name.optional(),
    description: description.optional(),
    coverTitleId: titleIdSchema.nullable().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.coverTitleId !== undefined,
  )
const itemSchema = z.object({ titleId: titleIdSchema })
const orderSchema = z.object({ titleIds: z.array(titleIdSchema).max(500) })

/** /api/collections: the signed-in user's collections; anyone signed in may look at one. */
export function collectionsRoutes(deps: AppDeps) {
  const { db, limits } = deps
  const app = new Hono<AppEnv>()

  app.get('/', (c) => {
    const user = requireUser(c)
    const titleId = c.req.query('titleId')
    const parsed = titleId ? titleIdSchema.safeParse(titleId) : null
    return c.json({
      collections: listCollections(db, user.id, parsed?.success ? parsed.data : undefined),
    })
  })

  app.post('/', async (c) => {
    const user = requireUser(c)
    limit(limits, 'library', user.id)
    const input = createSchema.parse(await c.req.json())
    return c.json({ collection: createCollection(db, user.id, input) }, 201)
  })

  app.get('/:id', (c) => {
    requireUser(c)
    return c.json({ collection: getCollection(db, c.req.param('id')) })
  })

  app.patch('/:id', async (c) => {
    const user = requireUser(c)
    limit(limits, 'library', user.id)
    const input = updateSchema.parse(await c.req.json())
    return c.json({ collection: updateCollection(db, user.id, c.req.param('id'), input) })
  })

  app.delete('/:id', (c) => {
    const user = requireUser(c)
    limit(limits, 'library', user.id)
    deleteCollection(db, user.id, c.req.param('id'))
    return c.json({ ok: true })
  })

  app.post('/:id/items', async (c) => {
    const user = requireUser(c)
    limit(limits, 'library', user.id)
    const { titleId } = itemSchema.parse(await c.req.json())
    // Any title, in the library or not: stored the way adding to the library stores it.
    await resolveTitle(deps, titleId, requestLocale(c), requestRegion(c))
    return c.json({ collection: addToCollection(db, user.id, c.req.param('id'), titleId) })
  })

  // The whole order at once, as the page shows it after a drag.
  app.put('/:id/order', async (c) => {
    const user = requireUser(c)
    limit(limits, 'library', user.id)
    const { titleIds } = orderSchema.parse(await c.req.json())
    return c.json({ collection: reorderCollection(db, user.id, c.req.param('id'), titleIds) })
  })

  app.delete('/:id/items/:titleId', (c) => {
    const user = requireUser(c)
    limit(limits, 'library', user.id)
    const titleId = titleIdSchema.parse(c.req.param('titleId'))
    return c.json({
      collection: removeFromCollection(db, user.id, c.req.param('id'), titleId),
    })
  })

  return app
}
