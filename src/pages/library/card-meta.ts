// Relative import (not @shared): unit tests type-check this file under tsconfig.node.json,
// which has no path aliases.
import type { Status } from '../../../shared/types.ts'

/**
 * Whether progress is worth printing next to a status: only while a title is under way.
 * Anywhere else it repeats the status («Пройдено · 100 %», «Просмотрено · 12/12»).
 */
export function showsProgress(status: Status) {
  return status === 'in_progress' || status === 'paused'
}
