import { Hono } from 'hono'
import type {
  ActivityItem,
  BannerId,
  LibraryEntry,
  PublicEntry,
  PublicUser,
  UserProfile,
} from '../../shared/types.ts'
import type { AppDeps, AppEnv } from '../context.ts'
import { requireUser } from '../context.ts'
import { coverVersion, getCover } from '../auth/covers.ts'
import { favoriteBanner } from '../../shared/banner.ts'
import { BANNERS } from '../../shared/types.ts'
import { notFound } from '../http/errors.ts'
import { listActivity } from '../library/activity.ts'
import { listEntries } from '../library/entries.ts'
import { computeStats } from '../library/stats.ts'
import { findUserById, toUser } from '../auth/users.ts'

/** Whitelist, not blacklist: a new private field on LibraryEntry stays private by default. */
function toPublicEntry(entry: LibraryEntry): PublicEntry {
  return {
    titleId: entry.titleId,
    kind: entry.kind,
    status: entry.status,
    rating: entry.rating,
    favorite: entry.favorite,
    progress: entry.progress,
    hours: entry.hours,
    watchedEpisodes: entry.watchedEpisodes,
    totalEpisodes: entry.totalEpisodes,
    title: entry.title,
  }
}

/** The banner a user shows; covers from the earlier preset list fall back to the poster collage. */
function bannerOf(row: ReturnType<typeof findUserById>): BannerId {
  const banner = row ? toUser(row).preferences.banner : undefined
  return (BANNERS as readonly string[]).includes(banner ?? 'none') ? (banner ?? 'none') : 'none'
}

export function usersRoutes(deps: AppDeps) {
  const { db } = deps
  const app = new Hono<AppEnv>()

  app.get('/:id/cover', (c) => {
    const viewer = requireUser(c)
    const id = c.req.param('id')
    // An uploaded picture someone is not showing stays private: only its owner can see it.
    if (viewer.id !== id && bannerOf(findUserById(db, id)) !== 'image') throw notFound('No cover')
    const cover = getCover(db, id)
    if (!cover) throw notFound('No cover')
    // Revalidated on every use: a replaced cover shows up at once, an unchanged one costs a 304.
    const etag = `"${cover.version}"`
    const headers = { ETag: etag, 'Cache-Control': 'private, no-cache' }
    if (c.req.header('if-none-match') === etag) return c.body(null, 304, headers)
    return c.body(cover.data as Uint8Array<ArrayBuffer>, 200, {
      ...headers,
      'Content-Type': cover.mime,
    })
  })

  app.get('/:id/profile', (c) => {
    const viewer = requireUser(c)
    const id = c.req.param('id')
    const row = findUserById(db, id)
    if (!row) throw notFound('User not found')

    const user = toUser(row)
    const prefs = user.preferences
    const banner = bannerOf(row)
    const publicUser: PublicUser = {
      id: user.id,
      name: user.name,
      createdAt: user.createdAt,
      avatar: prefs.avatar,
      avatarBg: prefs.avatarBg,
      avatarVariant: prefs.avatarVariant,
      banner,
      bannerPosition: prefs.bannerPosition,
      steamLinked: Boolean(prefs.steamId),
    }

    const all = listEntries(db, id)
    const favourites = all.filter((e) => e.favorite).slice(0, 12)
    const completed = all.filter((e) => e.status === 'completed').slice(0, 12)
    const inProgress = all.filter((e) => e.status === 'in_progress').slice(0, 8)
    // listEntries is newest first, so every list below is "most recent first".
    const heroPosters = [
      ...new Set(
        [...favourites, ...completed, ...inProgress]
          .map((e) => e.title?.poster)
          .filter((src): src is string => Boolean(src)),
      ),
    ].slice(0, 6)

    const activity = listActivity(db, id, 10) as ActivityItem[]
    // Count days and "this year" in the viewer's zone, exactly like /api/library/stats.
    const offset = Number(c.req.query('tz') ?? 0)
    const zone = c.req.query('zone')
    const stats = computeStats(db, id, {
      timeZone: zone && zone.length <= 64 ? zone : undefined,
      offsetMinutes: Number.isFinite(offset) ? offset : 0,
    })

    let bannerImage: string | null = null
    // Any favourite, not only the twelve listed: the first one with a backdrop to show.
    if (banner === 'favorite') bannerImage = favoriteBanner(all)?.title?.backdrop ?? null
    else if (banner === 'title') {
      const picked = all.find((entry) => entry.titleId === prefs.bannerTitleId)
      bannerImage = picked?.title?.backdrop ?? picked?.title?.poster ?? null
    }
    // Whether a picture was uploaded is the owner's business unless it is the shown banner.
    const cover = banner === 'image' || viewer.id === id ? coverVersion(db, id) : null
    if (banner === 'image') bannerImage = cover ? `/api/users/${id}/cover?v=${cover}` : null

    const profile: UserProfile = {
      user: publicUser,
      stats,
      activity,
      favorites: favourites.map(toPublicEntry),
      completed: completed.map(toPublicEntry),
      inProgress: inProgress.map(toPublicEntry),
      heroPosters,
      bannerImage,
      coverVersion: cover,
    }
    return c.json(profile)
  })

  return app
}
