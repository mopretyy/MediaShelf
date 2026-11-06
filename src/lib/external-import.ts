import type { Kind, Status } from '../../shared/types.ts'

/**
 * Converters from other services' export files to MediaShell's own export format, so they go
 * through the regular, transactional /api/me/import. Pure functions: no DOM, no React.
 *
 * - MyAnimeList and Shikimori: the anime list XML (MyAnimeList's own export is gzipped).
 * - IMDb: the ratings CSV (rated = watched, with the score) and the watchlist CSV (planned).
 *
 * Both carry exact ids (MAL id = Shikimori id, IMDb tt…), so nothing is matched by name.
 */

export type ExternalSource = 'mal' | 'imdb-ratings' | 'imdb-watchlist'

export interface ExternalEntry {
  titleId: string
  status: Status
  rating: number | null
  favorite: false
  notes: string
  progress: number
  platform: null
  store: null
  hours: null
  addedAt: string | null
  startedAt: string | null
  finishedAt: string | null
  position: number
  title: {
    id: string
    kind: Kind
    names: { original: string; en?: string }
    year: number | null
    poster: string | null
    backdrop: string | null
    genres: string[]
    ratings: []
    runtime: number | null
    seasons: null
    episodes: number | null
    externalIds: Record<string, string>
  }
  playthroughs: []
  episodes: { season: number; number: number; watchedAt: string; rating: null; note: string }[]
}

export interface ConvertedFile {
  source: ExternalSource
  entries: ExternalEntry[]
  /** Rows that could not become a library entry (episodes, games, broken rows). */
  skipped: number
}

const SHIKIMORI_ORIGIN = 'https://shikimori.io'
const METAHUB = 'https://images.metahub.space'

// ---------------------------------------------------------------------------
// Small helpers

const XML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

function decodeXml(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, name: string) => {
    if (name[0] === '#') {
      const code =
        name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : Number(name.slice(1))
      // An out-of-range reference would throw and abort the whole file: keep it as written.
      return code <= 0x10ffff ? String.fromCodePoint(code) : match
    }
    return XML_ENTITIES[name.toLowerCase()] ?? match
  })
}

/** "2024-03-05" (or a full timestamp) → ISO at noon UTC, so no time zone moves the day. */
function isoDay(value: string | undefined): string | null {
  const match = value?.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match || match[1] === '0000' || match[2] === '00' || match[3] === '00') return null
  const iso = `${match[1]}-${match[2]}-${match[3]}T12:00:00.000Z`
  const time = Date.parse(iso)
  // Date.parse rolls impossible days over (2024-02-30 → March 1st): require a round trip.
  return Number.isNaN(time) || new Date(time).toISOString() !== iso ? null : iso
}

function intOrNull(value: string | undefined, min: number, max: number) {
  const number = Number(value?.trim())
  return Number.isInteger(number) && number >= min && number <= max ? number : null
}

function clip(value: string, max: number) {
  return value.length > max ? value.slice(0, max) : value
}

const genreList = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((genre) => genre.trim())
    .filter(Boolean)
    .slice(0, 10)
    .map((genre) => clip(genre, 60))

// ---------------------------------------------------------------------------
// MyAnimeList / Shikimori XML

const MAL_STATUS: Record<string, Status> = {
  watching: 'in_progress',
  '1': 'in_progress',
  completed: 'completed',
  '2': 'completed',
  'on-hold': 'paused',
  onhold: 'paused',
  '3': 'paused',
  dropped: 'dropped',
  '4': 'dropped',
  'plan to watch': 'planned',
  plantowatch: 'planned',
  planned: 'planned',
  '6': 'planned',
}

function xmlFields(block: string) {
  const fields: Record<string, string> = {}
  const pattern = /<([a-z_]+)>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/\1>/gi
  for (const match of block.matchAll(pattern))
    fields[match[1].toLowerCase()] = match[2] ?? decodeXml(match[3] ?? '')
  return fields
}

export function isMalXml(text: string) {
  return (
    /<myanimelist[\s>]/i.test(text.slice(0, 4000)) || /<anime>\s*<series_animedb_id>/i.test(text)
  )
}

export function convertMalXml(text: string, now = new Date().toISOString()): ConvertedFile {
  const entries: ExternalEntry[] = []
  let skipped = 0
  for (const [, block] of text.matchAll(/<anime>([\s\S]*?)<\/anime>/gi)) {
    const fields = xmlFields(block)
    const id = intOrNull(fields.series_animedb_id, 1, 999_999_999)
    const status = MAL_STATUS[(fields.my_status ?? '').trim().toLowerCase()]
    const name = (fields.series_title ?? '').trim()
    if (!id || !status || !name) {
      skipped++
      continue
    }
    const total = intOrNull(fields.series_episodes, 1, 100_000)
    const watchedRaw = intOrNull(fields.my_watched_episodes, 0, 100_000) ?? 0
    // Some exports leave the counter at 0 for completed titles: completed means all of them.
    const watched = Math.min(
      status === 'completed' && total ? Math.max(watchedRaw, total) : watchedRaw,
      total ?? watchedRaw,
      20_000,
    )
    const startedAt = isoDay(fields.my_start_date)
    const finishedAt = status === 'completed' ? isoDay(fields.my_finish_date) : null
    const watchedAt = finishedAt ?? startedAt ?? now
    const titleId = `anime-${id}`
    entries.push({
      titleId,
      status,
      rating: intOrNull(fields.my_score, 1, 10),
      favorite: false,
      notes: clip((fields.my_comments ?? '').trim(), 5000),
      progress: status === 'completed' ? 100 : total ? Math.round((watched / total) * 100) : 0,
      platform: null,
      store: null,
      hours: null,
      addedAt: startedAt ?? finishedAt,
      startedAt,
      finishedAt,
      position: entries.length,
      title: {
        id: titleId,
        kind: 'anime',
        names: { original: clip(name, 300) },
        year: null,
        poster: `${SHIKIMORI_ORIGIN}/system/animes/original/${id}.jpg`,
        backdrop: null,
        genres: [],
        ratings: [],
        runtime: null,
        seasons: null,
        episodes: total,
        externalIds: { mal: String(id) },
      },
      playthroughs: [],
      episodes: Array.from({ length: watched }, (_, index) => ({
        season: 1,
        number: index + 1,
        watchedAt,
        rating: null,
        note: '',
      })),
    })
  }
  return { source: 'mal', entries, skipped }
}

// ---------------------------------------------------------------------------
// IMDb CSV

/** RFC 4180 rows: quoted fields may hold commas, quotes ("") and line breaks. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  for (let index = 0; index < input.length; index++) {
    const char = input[index]
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        field += '"'
        index++
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[index + 1] === '\n') index++
      row.push(field)
      if (row.some((value) => value !== '')) rows.push(row)
      row = []
      field = ''
    } else field += char
  }
  row.push(field)
  if (row.some((value) => value !== '')) rows.push(row)
  return rows
}

const IMDB_KIND: Record<string, Kind> = {
  movie: 'movie',
  tvmovie: 'movie',
  tvspecial: 'movie',
  video: 'movie',
  short: 'movie',
  tvshort: 'movie',
  tvseries: 'series',
  tvminiseries: 'series',
}

export function isImdbCsv(text: string) {
  const header = parseCsv(text.slice(0, 2000))[0] ?? []
  return header.some((cell) => cell.trim().toLowerCase() === 'const')
}

export function convertImdbCsv(text: string): ConvertedFile {
  const [header = [], ...rows] = parseCsv(text)
  const column = (name: string) =>
    header.findIndex((cell) => cell.trim().toLowerCase() === name.toLowerCase())
  const at = {
    id: column('Const'),
    rating: column('Your Rating'),
    rated: column('Date Rated'),
    created: column('Created'),
    title: column('Title'),
    original: column('Original Title'),
    type: column('Title Type'),
    year: column('Year'),
    runtime: column('Runtime (mins)'),
    genres: column('Genres'),
    position: column('Position'),
  }
  // A ratings export has "Your Rating" and no "Position". The watchlist export has "Position" and,
  // in its current format, an often empty "Your Rating" column too: every row decides by itself.
  const watchlist = at.position >= 0 || at.rating < 0
  const entries: ExternalEntry[] = []
  const seen = new Set<string>()
  let skipped = 0
  for (const cells of rows) {
    const cell = (index: number) => (index >= 0 ? (cells[index] ?? '').trim() : '')
    const tt = cell(at.id)
    const kind = IMDB_KIND[cell(at.type).toLowerCase().replace(/[\s-]/g, '')]
    const name = cell(at.original) || cell(at.title)
    if (!/^tt\d{5,12}$/.test(tt) || !kind || !name) {
      skipped++
      continue
    }
    const titleId = `${kind}-${tt}`
    if (seen.has(titleId)) continue
    seen.add(titleId)
    const rating = intOrNull(cell(at.rating), 1, 10)
    const watched = watchlist ? rating !== null : true
    const status: Status = watched ? 'completed' : 'planned'
    const finishedAt = watched ? isoDay(cell(at.rated)) : null
    const english = cell(at.title)
    entries.push({
      titleId,
      status,
      rating: watched ? rating : null,
      favorite: false,
      notes: '',
      progress: status === 'completed' && kind === 'movie' ? 100 : 0,
      platform: null,
      store: null,
      hours: null,
      addedAt: isoDay(cell(at.created)) ?? finishedAt,
      startedAt: null,
      finishedAt,
      position: entries.length,
      title: {
        id: titleId,
        kind,
        names: english && english !== name ? { original: name, en: english } : { original: name },
        year: intOrNull(cell(at.year), 1850, 2200),
        poster: `${METAHUB}/poster/medium/${tt}/img`,
        backdrop: `${METAHUB}/background/medium/${tt}/img`,
        genres: genreList(cell(at.genres)),
        ratings: [],
        runtime: intOrNull(cell(at.runtime), 1, 100_000),
        seasons: null,
        episodes: null,
        externalIds: { imdb: tt },
      },
      playthroughs: [],
      episodes: [],
    })
  }
  return { source: watchlist ? 'imdb-watchlist' : 'imdb-ratings', entries, skipped }
}

/** Detects the format and converts; null when the file is neither. */
export function convertExternal(text: string): ConvertedFile | null {
  if (isMalXml(text)) return convertMalXml(text)
  if (isImdbCsv(text)) return convertImdbCsv(text)
  return null
}

/** The payload /api/me/import accepts, leaving out titles already in the library. */
export function toImportPayload(file: ConvertedFile, existing: ReadonlySet<string>) {
  const entries = file.entries.filter((entry) => !existing.has(entry.titleId))
  return {
    payload: { format: 'mediashelf' as const, version: 4 as const, entries },
    existing: file.entries.length - entries.length,
  }
}
