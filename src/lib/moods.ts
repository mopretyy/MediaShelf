// Moods for Discover: «Уютное», «Напряжённое»… Each is a rule over a title's genres (and length
// for «Коротко»), applied to the popular titles of every kind. Pure, so it can be unit tested.
import type { TitleRecord } from '../../shared/types.ts'

export const MOOD_IDS = ['cozy', 'laugh', 'tense', 'mind', 'epic', 'short'] as const
export type MoodId = (typeof MOOD_IDS)[number]

const set = (...genres: string[]) => new Set(genres)
const has = (title: TitleRecord, genres: Set<string>) => title.genres.some((g) => genres.has(g))

const COZY = set(
  'Comedy',
  'Family',
  'Animation',
  'Romance',
  'Slice of Life',
  'Music',
  'Musical',
  'Kids',
  'Cozy',
  'Relaxing',
  'Wholesome',
  'Cute',
  'Farming Sim',
  'Life Sim',
  'Casual',
)
const DARK = set(
  'Horror',
  'Thriller',
  'Crime',
  'War',
  'Survival Horror',
  'Psychological Horror',
  'Psychological',
  'Gore',
)
const TENSE = set(
  'Thriller',
  'Horror',
  'Crime',
  'Mystery',
  'Suspense',
  'Survival Horror',
  'Psychological Horror',
  'Psychological',
  'Stealth',
  'Survival',
)
const MIND = set(
  'Sci-Fi',
  'Mystery',
  'Psychological',
  'Puzzle',
  'Cyberpunk',
  'Supernatural',
  'Detective',
  'Time Travel',
)
const EPIC = set(
  'Fantasy',
  'Adventure',
  'War',
  'History',
  'RPG',
  'Action RPG',
  'JRPG',
  'Open World',
  'Mecha',
  'Western',
)
const SHORT_GAMES = set(
  'Short',
  'Casual',
  'Puzzle',
  'Arcade',
  'Card Game',
  'Roguelike',
  'Roguelite',
  '2D Platformer',
  'Platformer',
)

/** Short enough for one evening: a film under 1 h 45 min, half-hour episodes, a quick game. */
function isShort(title: TitleRecord) {
  if (title.kind === 'movie') return Boolean(title.runtime && title.runtime <= 105)
  if (title.kind === 'game') return has(title, SHORT_GAMES)
  return Boolean(title.runtime && title.runtime <= 30)
}

export const MOODS: Record<MoodId, (title: TitleRecord) => boolean> = {
  cozy: (title) => has(title, COZY) && !has(title, DARK),
  laugh: (title) => title.genres.includes('Comedy') && !has(title, set('Horror', 'Gore')),
  tense: (title) => has(title, TENSE),
  mind: (title) => has(title, MIND),
  epic: (title) => has(title, EPIC),
  short: isShort,
}

export const isMood = (value: string | null): value is MoodId =>
  Boolean(value && (MOOD_IDS as readonly string[]).includes(value))

const score = (title: TitleRecord) => {
  const rating = title.ratings[0]
  return rating ? rating.value / rating.max : -1
}

/**
 * The titles that fit a mood, each once, with a poster: the best rated of each kind, taken in
 * turns (Steam's percentages would otherwise bury every film), popularity breaking ties.
 */
export function moodTitles(pool: TitleRecord[], mood: MoodId): TitleRecord[] {
  const seen = new Set<string>()
  const byKind = new Map<string, { title: TitleRecord; order: number }[]>()
  pool.forEach((title, order) => {
    if (!title.poster || !MOODS[mood](title) || seen.has(title.id)) return
    seen.add(title.id)
    const list = byKind.get(title.kind) ?? []
    list.push({ title, order })
    byKind.set(title.kind, list)
  })
  const lists = [...byKind.values()].map((list) =>
    list.sort((a, b) => score(b.title) - score(a.title) || a.order - b.order),
  )
  const out: TitleRecord[] = []
  for (let index = 0; lists.some((list) => index < list.length); index++)
    for (const list of lists) if (list[index]) out.push(list[index].title)
  return out
}
