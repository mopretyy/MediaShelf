import { useCommandState } from 'cmdk'
import type { ReactNode } from 'react'
import type { LibraryEntry, TitleRecord } from '@shared/types.ts'
import { PosterFan } from '@/components/PosterFan'
import { Backdrop, Poster } from '@/components/Poster'
import { StatusIcon } from '@/components/StatusIcon'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { useDebounced } from '@/lib/hooks'
import { useTitle } from '@/lib/queries'
import {
  entryProgressText,
  formatRating,
  genreList,
  ratingSourceLabel,
  secondaryName,
  statusLabelKey,
  titleName,
  yearRange,
} from '@/lib/titles'

/** A row of the palette that is not a title: a page, an action or a language. */
export interface PreviewCommand {
  value: string
  label: ReactNode
  icon: ReactNode
  detail?: ReactNode
  lang?: string
}

/** How long a row has to stay selected before its full details are asked for. */
const DWELL = 280

/**
 * The right column of the command palette on wide screens: a frame, the poster, the name and a
 * few facts about the selected title, so arrowing through results answers «which one is it?»
 * without opening each. Details are fetched after a short dwell and share the title page's cache,
 * so the page then opens instantly. Decorative for assistive technology: the option text already
 * names the title, and the column would only repeat it.
 */
export function PalettePreview({
  titles,
  commands,
  library,
}: {
  titles: Map<string, TitleRecord>
  commands: PreviewCommand[]
  library: Map<string, LibraryEntry>
}) {
  const value = useCommandState((state) => state.value) ?? ''
  const title = titles.get(value)
  const command = title ? undefined : commands.find((item) => item.value === value)
  return (
    <aside
      aria-hidden="true"
      data-testid="palette-preview"
      className="relative hidden overflow-hidden border-l border-line md:block"
    >
      {title ? (
        <TitlePreview key={title.id} title={title} entry={library.get(title.id)} />
      ) : command ? (
        <CommandPreview command={command} />
      ) : (
        <div className="flex h-full items-center justify-center p-6">
          <PosterFan />
        </div>
      )}
    </aside>
  )
}

function CommandPreview({ command }: { command: PreviewCommand }) {
  return (
    <div className="flex h-full animate-fade-in flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="grid size-16 place-items-center rounded-2xl bg-raised text-fg-2 ring-1 ring-line ring-inset [&_svg]:size-7">
        {command.icon}
      </span>
      <div className="min-w-0">
        <p lang={command.lang} className="display text-2xl break-words text-fg">
          {command.label}
        </p>
        {command.detail ? (
          <p className="mt-1 flex items-center justify-center gap-1 text-sm text-fg-3 [&_svg]:hidden">
            {command.detail}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function TitlePreview({ title: base, entry }: { title: TitleRecord; entry?: LibraryEntry }) {
  const { t, locale, fmt } = useI18n()
  // Ask for the full record only once the selection rests here: arrowing through ten rows
  // should not start ten requests. A failed request keeps the record the list already had.
  const settled = useDebounced(base.id, DWELL) === base.id
  const details = useTitle(base.id, settled && !base.detailed)
  const title = details.data ?? base
  const name = titleName(title.names, locale)
  const original = secondaryName(title.names, locale)
  const rating = title.ratings[0]
  const description = title.descriptions?.[locale] ?? title.descriptions?.en
  const facts = [t(`kind.${title.kind}`), yearRange(title), ...genreList(title.genres, locale, 2)]
    .filter(Boolean)
    .join(' · ')
  const progress = entry ? entryProgressText(entry, t) : null

  return (
    <div className="flex h-full flex-col">
      <div className="dark relative aspect-video shrink-0 overflow-hidden bg-black">
        {title.backdrop ? (
          <Backdrop
            src={title.backdrop}
            className="absolute inset-0 size-full object-[center_25%]"
          />
        ) : title.poster ? (
          <img
            src={title.poster}
            alt=""
            decoding="async"
            referrerPolicy="no-referrer"
            className="absolute inset-0 size-full scale-125 object-cover opacity-70 blur-2xl"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="absolute bottom-3 left-3 w-[68px]">
          <Poster
            src={title.poster}
            alt={name}
            kind={title.kind}
            sizes="sm"
            className="shadow-poster"
          />
        </div>
        {rating ? (
          <span className="tabular absolute right-3 bottom-3 rounded-md bg-black/55 px-1.5 py-0.5 text-xs font-medium text-white ring-1 ring-white/15 backdrop-blur-md ring-inset">
            {ratingSourceLabel(rating.source)} {formatRating(rating, fmt)}
          </span>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 animate-fade-in flex-col gap-2 px-4 pt-3.5 pb-4">
        <div className="min-w-0">
          <p className="display line-clamp-2 text-xl break-words text-fg">{name}</p>
          {original ? <p className="mt-0.5 truncate text-sm text-fg-3">{original}</p> : null}
        </div>
        <p className="text-sm text-fg-2">{facts}</p>
        {entry ? (
          <p className="flex items-center gap-1.5 text-sm text-fg">
            <StatusIcon status={entry.status} className="size-4 text-fg-2" />
            {t(statusLabelKey(entry.kind, entry.status))}
            {progress ? <span className="tabular text-fg-3">· {progress}</span> : null}
          </p>
        ) : null}
        {description ? (
          <p
            className={cn(
              'min-h-0 overflow-hidden text-sm leading-relaxed text-fg-3',
              // Clamp by lines where the column allows, so no line is cut in half.
              entry ? 'line-clamp-5' : 'line-clamp-6',
            )}
          >
            {description}
          </p>
        ) : details.isFetching ? (
          <div className="space-y-2 pt-1">
            <div className="h-3 w-full animate-shimmer rounded bg-skeleton" />
            <div className="h-3 w-4/5 animate-shimmer rounded bg-skeleton" />
            <div className="h-3 w-3/5 animate-shimmer rounded bg-skeleton" />
          </div>
        ) : null}
      </div>
    </div>
  )
}
