/**
 * The entry behind the 'favorite' profile cover: the first favourite, newest first, that has a
 * backdrop. One without a backdrop would leave the banner empty. Used by the server (the
 * profile's `bannerImage`) and by the cover editor's preview, so both pick the same title.
 */
export function favoriteBanner<
  T extends { favorite: boolean; title?: { backdrop?: string | null } | null },
>(entries: readonly T[]): T | undefined {
  return entries.find((entry) => entry.favorite && entry.title?.backdrop)
}
