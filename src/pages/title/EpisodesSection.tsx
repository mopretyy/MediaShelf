import { Check, MessageSquareText, MoreHorizontal, Plus } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { Episode, EpisodeMark, LibraryEntry, TitleRecord } from '@shared/types.ts'
import { useErrorMessage, useLibraryActions } from '@/components/library-actions'
import { RatingScale } from '@/components/StatusControls'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/input'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { ProgressBar, SectionHeader, Skeleton } from '@/components/ui/misc'
import { Segmented } from '@/components/ui/segmented'
import { Select } from '@/components/ui/select'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { useEpisodeNote, useMarkEpisodes } from '@/lib/queries'
import { episodeCode, localToday, statusLabelKey, titleName } from '@/lib/titles'
import { useEpisodeProgress } from './use-episode-progress'

const key = (e: { season: number; number: number }) => `${e.season}:${e.number}`
const PAGE = 100

function NoteDialog({
  titleId,
  episode,
  mark,
  onClose,
}: {
  titleId: string
  episode: Episode
  mark: EpisodeMark | undefined
  onClose(): void
}) {
  const { t } = useI18n()
  const save = useEpisodeNote()
  const message = useErrorMessage()
  const [note, setNote] = useState(mark?.note ?? '')
  const [rating, setRating] = useState<number | null>(mark?.rating ?? null)
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={t('episodes.note')}
        description={[t('episodes.code', episodeCode(episode.season, episode.number)), episode.name]
          .filter(Boolean)
          .join(' · ')}
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate(
              { titleId, season: episode.season, number: episode.number, note, rating },
              { onSuccess: onClose, onError: (error) => toast.error(message(error)) },
            )
          }}
        >
          <div className="grid gap-2">
            <p className="text-sm font-medium">{t('episodes.ratingLabel')}</p>
            <RatingScale label={t('episodes.ratingLabel')} value={rating} onChange={setRating} />
            {/* Picking the current score again keeps it: clearing is this explicit action, after
                the scale so that it never takes the dialog's first focus. */}
            {rating !== null ? (
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 w-fit text-fg-3 max-sm:h-11"
                onClick={() => setRating(null)}
              >
                {t('title.clearRating')}
              </Button>
            ) : null}
          </div>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t('episodes.notePlaceholder')}
            maxLength={2000}
            aria-label={t('episodes.note')}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={save.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function EpisodesSection({
  title,
  entry,
}: {
  title: TitleRecord
  entry: LibraryEntry | null
}) {
  const { t, fmt, locale } = useI18n()
  // The same numbers as the entry panel: both count from the list and the marks.
  const progress = useEpisodeProgress(title.id, entry)
  const { list, next, unsure, percent } = progress
  const marksQuery = progress.marks
  const mark = useMarkEpisodes()
  const actions = useLibraryActions()
  const message = useErrorMessage()
  const [chosenSeason, setChosenSeason] = useState<number | null>(null)
  const [limit, setLimit] = useState(PAGE)
  const [noteFor, setNoteFor] = useState<Episode | null>(null)
  const rowIds = useId()
  const today = localToday()

  const seasons = useMemo(() => {
    const all = (list.data?.seasons ?? []).filter((season) => season.episodes.length)
    return [...all.filter((s) => s.number > 0), ...all.filter((s) => s.number === 0)]
  }, [list.data])
  const marks = useMemo(
    () => new Map((marksQuery.data ?? []).map((m) => [key(m), m])),
    [marksQuery.data],
  )
  const watched = (e: { season: number; number: number }) => Boolean(marks.get(key(e))?.watchedAt)
  const regular = useMemo(
    () => seasons.filter((s) => s.number > 0).flatMap((s) => s.episodes),
    [seasons],
  )

  const defaultSeason = next?.season ?? seasons[0]?.number ?? 1
  // A season picked on another title may not exist here: fall back instead of an empty list.
  const seasonNumber =
    chosenSeason !== null && seasons.some((s) => s.number === chosenSeason)
      ? chosenSeason
      : seasons.some((s) => s.number === defaultSeason)
        ? defaultSeason
        : seasons[0]?.number
  const season = seasons.find((s) => s.number === seasonNumber)

  const run = (episodes: { season: number; number: number }[], value: boolean) => {
    if (!entry) {
      // Add the title first, then apply the click the user actually made.
      actions.add(
        title,
        'in_progress',
        value ? { onSuccess: () => applyMarks(episodes, value) } : {},
      )
      return
    }
    applyMarks(episodes, value)
  }

  const applyMarks = (episodes: { season: number; number: number }[], value: boolean) => {
    mark.mutate(
      { titleId: title.id, episodes, watched: value },
      {
        onSuccess: ({ statusChanged }) => {
          if (statusChanged)
            toast(
              t('toast.autoStatus', { status: t(statusLabelKey(title.kind, statusChanged.to)) }),
              {
                description: titleName(title.names, locale),
              },
            )
        },
        onError: (error) => toast.error(message(error)),
      },
    )
  }

  const aired = (e: { airdate: string | null }) => !e.airdate || e.airdate <= today

  if (list.isLoading)
    return (
      <section aria-busy="true">
        <SectionHeader title={t('title.episodes')} />
        <div className="grid gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-11 rounded-lg" />
          ))}
        </div>
      </section>
    )

  if (!seasons.length)
    return (
      <section>
        <SectionHeader title={t('title.episodes')} />
        <div className="rounded-xl bg-raised px-4 py-6 text-center ring-1 ring-line ring-inset">
          <p className="text-base font-medium">
            {list.isError ? t('episodes.loadError') : t('episodes.noList')}
          </p>
          <p className="mt-1 text-sm text-fg-3">{t('episodes.noListText')}</p>
          {list.isError ? (
            <Button className="mt-3" size="sm" onClick={() => void list.refetch()}>
              {t('common.retry')}
            </Button>
          ) : null}
        </div>
      </section>
    )

  const seasonEpisodes = season?.episodes ?? []
  const seasonAired = seasonEpisodes.filter(aired)
  const seasonDone = seasonAired.length > 0 && seasonAired.every(watched)

  return (
    <section aria-labelledby="episodes-heading">
      <SectionHeader
        id="episodes-heading"
        title={t('title.episodes')}
        action={
          entry && progress.total ? (
            <span className="tabular text-sm text-fg-2">
              {t('episodes.watchedOf', { watched: progress.watched, total: progress.total })}
            </span>
          ) : (
            <span className="text-sm text-fg-3">
              {t('count.episodes', { count: regular.length })}
            </span>
          )
        }
      />

      {entry ? (
        <div className="mb-4 rounded-xl bg-raised p-4 ring-1 ring-line ring-inset">
          <ProgressBar value={percent} label={t('title.progress')} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            {unsure && !next ? (
              <Skeleton className="h-5 w-48" />
            ) : next ? (
              <div className="min-w-0">
                <p className="text-xs font-medium text-fg-3">{t('episodes.next')}</p>
                <p className="truncate text-base">
                  <span className="tabular font-medium">
                    {t('episodes.code', episodeCode(next.season, next.number))}
                  </span>
                  {next.name ? <span className="text-fg-2"> · {next.name}</span> : null}
                </p>
                {next.airdate && next.airdate > today ? (
                  <p className="text-xs text-fg-3">
                    {t('episodes.airsOn', { date: fmt.date(next.airdate, 'long') })}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-base text-fg-2">
                {list.data?.ended === false ? t('episodes.waiting') : t('episodes.allWatched')}
              </p>
            )}
            {next && aired(next) ? (
              <Button
                variant="primary"
                size="sm"
                loading={mark.isPending}
                onClick={() => run([next], true)}
              >
                <Check />
                {t('episodes.markWatched')}
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-raised px-4 py-3 text-sm text-fg-2 ring-1 ring-line ring-inset">
          {t('episodes.addToTrack')}
          <Button size="sm" variant="primary" onClick={() => actions.add(title, 'planned')}>
            <Plus />
            {t('title.addToLibrary')}
          </Button>
        </p>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {seasons.length > 1 && seasons.length <= 6 ? (
          <Segmented
            size="sm"
            aria-label={t('title.seasons')}
            value={String(seasonNumber)}
            onChange={(value) => {
              setChosenSeason(Number(value))
              setLimit(PAGE)
            }}
            options={seasons.map((s) => ({
              value: String(s.number),
              label:
                s.number === 0
                  ? t('episodes.specials')
                  : t('episodes.season', { number: s.number }),
            }))}
          />
        ) : seasons.length > 6 ? (
          <Select
            size="sm"
            aria-label={t('title.seasons')}
            value={String(seasonNumber)}
            onValueChange={(value) => {
              setChosenSeason(Number(value))
              setLimit(PAGE)
            }}
            options={seasons.map((s) => ({
              value: String(s.number),
              label:
                s.number === 0
                  ? t('episodes.specials')
                  : t('episodes.season', { number: s.number }),
            }))}
            className="min-w-40"
          />
        ) : (
          <p className="text-sm font-medium text-fg-2">
            {seasonNumber === 0
              ? t('episodes.specials')
              : t('episodes.season', { number: seasonNumber ?? 1 })}
          </p>
        )}
        {entry && seasonAired.length ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => run(seasonAired, !seasonDone)}
            disabled={mark.isPending}
          >
            {seasonDone ? t('episodes.unmarkSeason') : t('episodes.markSeason')}
          </Button>
        ) : null}
      </div>

      <ol className="grid gap-px overflow-hidden rounded-xl ring-1 ring-line ring-inset">
        {seasonEpisodes.slice(0, limit).map((episode) => {
          const done = watched(episode)
          const future = !aired(episode)
          const note = marks.get(key(episode))
          const code = t('episodes.code', episodeCode(episode.season, episode.number))
          const date = episode.airdate
            ? future
              ? t('episodes.airsOn', { date: fmt.date(episode.airdate) })
              : fmt.date(episode.airdate)
            : null
          // The checkbox is named by the code and the name; the rest of the row describes it
          // (a checkbox's content is not read on its own).
          const details = [
            date,
            note?.rating ? t('title.ratingOption', { rating: note.rating }) : null,
            note?.note ? t('episodes.note') : null,
          ]
            .filter(Boolean)
            .join(', ')
          const detailsId = `${rowIds}-${episode.season}-${episode.number}`
          return (
            <li key={key(episode)} className={cn('bg-raised/60', future && 'opacity-60')}>
              {/* The whole row marks the episode, the circle only pictures it. The menu stays a
                  separate control next to it, never inside; the row lights up as one while the
                  checkbox part is under the pointer. */}
              <div
                className={cn(
                  'group flex items-center transition-colors duration-150',
                  !future && 'has-[[role=checkbox]:hover]:bg-hover',
                )}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  aria-label={`${code}${episode.name ? `, ${episode.name}` : ''}`}
                  aria-describedby={details ? detailsId : undefined}
                  disabled={future}
                  onClick={() => run([episode], !done)}
                  className="group/episode flex min-w-0 flex-1 items-center gap-2.5 self-stretch py-2.5 pr-3 pl-3 text-left focus-visible:-outline-offset-2 sm:gap-3"
                >
                  <span
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded-full transition-colors duration-150',
                      done
                        ? 'bg-fg text-panel'
                        : 'text-transparent ring-1 ring-line-strong ring-inset',
                      !done && !future && 'group-hover/episode:text-fg-3',
                    )}
                  >
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  <span className="tabular min-w-6 shrink-0 text-sm text-fg-3 sm:w-8">
                    {episode.number}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-base', done && 'text-fg-2')}>
                      {episode.name || t('episodes.episode', { number: episode.number })}
                    </span>
                    {date ? <span className="block truncate text-xs text-fg-3">{date}</span> : null}
                  </span>
                  {note?.rating ? (
                    <span className="tabular shrink-0 text-xs font-medium text-fg-2">
                      {note.rating}/10
                    </span>
                  ) : null}
                  {note?.note ? <MessageSquareText className="size-4 shrink-0 text-fg-3" /> : null}
                  {details ? (
                    <span id={detailsId} className="sr-only">
                      {details}
                    </span>
                  ) : null}
                </button>
                {entry ? (
                  <Menu>
                    <MenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={t('episodes.moreFor', { code })}
                        className="mr-2 opacity-60 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:size-9 pointer-coarse:opacity-100"
                      >
                        <MoreHorizontal />
                      </Button>
                    </MenuTrigger>
                    <MenuContent align="end">
                      <MenuItem onSelect={() => run([episode], !done)} disabled={future}>
                        <Check />
                        {done ? t('episodes.markUnwatched') : t('episodes.markWatched')}
                      </MenuItem>
                      {episode.season > 0 ? (
                        <MenuItem
                          disabled={future}
                          onSelect={() =>
                            run(
                              regular.filter(
                                (e) =>
                                  aired(e) &&
                                  (e.season < episode.season ||
                                    (e.season === episode.season && e.number <= episode.number)),
                              ),
                              true,
                            )
                          }
                        >
                          <Check />
                          {t('episodes.markUpTo')}
                        </MenuItem>
                      ) : null}
                      <MenuItem onSelect={() => setNoteFor(episode)}>
                        <MessageSquareText />
                        {t('episodes.note')}
                      </MenuItem>
                    </MenuContent>
                  </Menu>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
      {seasonEpisodes.length > limit ? (
        <div className="mt-3 flex justify-center">
          <Button variant="secondary" size="sm" onClick={() => setLimit((value) => value + PAGE)}>
            {t('common.showMore')}
          </Button>
        </div>
      ) : null}
      {list.data ? (
        <p className="mt-3 text-xs text-fg-3">
          {t('episodes.source', { source: t(`sources.${list.data.source}`) })}
        </p>
      ) : null}
      {noteFor ? (
        <NoteDialog
          titleId={title.id}
          episode={noteFor}
          mark={marks.get(key(noteFor))}
          onClose={() => setNoteFor(null)}
        />
      ) : null}
    </section>
  )
}
