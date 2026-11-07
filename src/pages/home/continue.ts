import { toast } from 'sonner'
import type { LibraryEntry } from '@shared/types.ts'
import { useErrorMessage } from '@/components/library-actions'
import { useI18n } from '@/i18n'
import { useMarkNext } from '@/lib/queries'
import { episodeCode, localToday, statusLabelKey, titleName } from '@/lib/titles'

const episodic = (entry: LibraryEntry) => entry.kind === 'series' || entry.kind === 'anime'

/** A series or anime whose next episode is out: "+1 episode" can mark it. */
export function canMarkNext(entry: LibraryEntry, today = localToday()) {
  const next = entry.nextEpisode
  return episodic(entry) && Boolean(next) && (!next!.airdate || next!.airdate <= today)
}

/** The line under a title you are in the middle of: next episode, progress or status. */
export function useContinueSubtitle() {
  const { t } = useI18n()
  return (entry: LibraryEntry) => {
    const next = entry.nextEpisode
    if (episodic(entry)) {
      if (next)
        return [t('episodes.code', episodeCode(next.season, next.number)), next.name]
          .filter(Boolean)
          .join(' · ')
      if (entry.progress >= 100) return t('home.caughtUp')
      if (entry.totalEpisodes)
        return t('episodes.watchedOf', {
          watched: entry.watchedEpisodes,
          total: entry.totalEpisodes,
        })
      return t('home.percent', { value: entry.progress })
    }
    if (entry.kind === 'game') return t('home.percent', { value: entry.progress })
    return t(statusLabelKey(entry.kind, entry.status))
  }
}

/** "+1 episode" with the same toasts wherever it is offered (Continue cards, the Home hero). */
export function useMarkNextWithToast() {
  const { t, locale } = useI18n()
  const markNext = useMarkNext()
  const message = useErrorMessage()
  return {
    isPending: markNext.isPending,
    mark(entry: LibraryEntry) {
      const next = entry.nextEpisode
      if (!next) return
      const name = titleName(entry.title.names, locale)
      markNext.mutate(entry.titleId, {
        onSuccess: ({ statusChanged }) =>
          toast(
            statusChanged
              ? t('toast.autoStatus', { status: t(statusLabelKey(entry.kind, statusChanged.to)) })
              : t('toast.episodeMarked'),
            {
              description: `${name} · ${t('episodes.code', episodeCode(next.season, next.number))}`,
            },
          ),
        onError: (error) => toast.error(message(error)),
      })
    },
  }
}
