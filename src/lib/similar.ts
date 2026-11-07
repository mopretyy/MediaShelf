// «Похожее» on a title page: titles of the same kind that share its genres, from the popular and
// all-time charts (no recommendation API needed). Pure, so it can be unit tested.
import type { TitleRecord } from '../../shared/types.ts'

const score = (title: TitleRecord) => {
  const rating = title.ratings[0]
  return rating ? rating.value / rating.max : 0
}

/**
 * Up to `limit` titles like `title`: the same kind, a poster, at least one shared genre (two when
 * the title has three or more, so a lone «Drama» does not make everything alike). Ranked by the
 * share of genres in common, then by rating.
 */
export function similarTitles(title: TitleRecord, pool: TitleRecord[], limit = 12): TitleRecord[] {
  const genres = new Set(title.genres)
  if (!genres.size) return []
  const needed = genres.size >= 3 ? 2 : 1
  const seen = new Set<string>([title.id])
  const ranked: { title: TitleRecord; match: number; order: number }[] = []
  pool.forEach((candidate, order) => {
    if (candidate.kind !== title.kind || !candidate.poster || seen.has(candidate.id)) return
    seen.add(candidate.id)
    const shared = candidate.genres.filter((genre) => genres.has(genre)).length
    if (shared < needed) return
    const union = new Set([...genres, ...candidate.genres]).size
    ranked.push({ title: candidate, match: shared / union, order })
  })
  return ranked
    .sort((a, b) => b.match - a.match || score(b.title) - score(a.title) || a.order - b.order)
    .slice(0, limit)
    .map((item) => item.title)
}
