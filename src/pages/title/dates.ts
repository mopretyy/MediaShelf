/** The day an ISO moment falls on in the reader's time zone ("YYYY-MM-DD"), as a date input shows it. */
export function toDateInput(iso: string | null) {
  if (!iso) return ''
  const date = new Date(iso)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

/** The moment saved for a picked day: local noon, so the day survives a time-zone change. */
export function fromDateInput(value: string) {
  return value ? new Date(`${value}T12:00:00`).toISOString() : null
}

/** What can be wrong with a typed date; all but 'invalid' are keys of errors.fields. */
export type DateProblem = 'invalid' | 'in_future' | 'before_start' | 'after_finish'

/**
 * Turns what was typed into a start or finish date into the moment to save, checked the way
 * the server checks it: the start may not come after the finish. `start` is the saved start
 * (when editing the finish date) and `finish` the saved finish (when editing the start date).
 */
export function parseDateDraft(
  draft: string,
  { start, finish }: { start?: string | null; finish?: string | null },
  today = toDateInput(new Date().toISOString()),
): { value: string | null } | { problem: DateProblem } {
  if (!draft) return { value: null }
  const year = Number(draft.slice(0, 4))
  const noon = new Date(`${draft}T12:00:00`).getTime()
  const real =
    /^\d{4}-\d{2}-\d{2}$/.test(draft) &&
    !Number.isNaN(noon) &&
    // Date rolls "02-31" over into March instead of failing.
    toDateInput(new Date(noon).toISOString()) === draft
  if (!real || year < 1900) return { problem: 'invalid' }
  // The picker stops at today, and so does a typed or stepped day.
  if (draft > today) return { problem: 'in_future' }
  if (start && draft < toDateInput(start)) return { problem: 'before_start' }
  if (finish && draft > toDateInput(finish)) return { problem: 'after_finish' }
  // Same day as the other date: noon can still land on the wrong side of it (a title started
  // at 20:00 and finished that day), and the server compares exact moments. Take that moment.
  if (start && noon < Date.parse(start)) return { value: start }
  if (finish && noon > Date.parse(finish)) return { value: finish }
  return { value: new Date(noon).toISOString() }
}
