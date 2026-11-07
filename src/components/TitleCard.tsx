import { Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { isValidElement, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { LibraryEntry, TitleRecord } from '@shared/types.ts'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { useLibraryMap } from '@/lib/queries'
import {
  formatRating,
  ratingSourceLabel,
  statusLabelKey,
  titleHref,
  titleName,
  yearRange,
} from '@/lib/titles'
import { Poster } from './Poster'
import { StatusIcon } from './StatusIcon'
import { Button } from './ui/button'
import { Skeleton } from './ui/misc'
import { Tooltip } from './ui/tooltip'
import { useLibraryActions } from './library-actions'

interface TitleCardProps {
  title: TitleRecord
  entry?: LibraryEntry | null
  showKind?: boolean
  rank?: number
  className?: string
  eager?: boolean
  /**
   * Replaces the default details (kind, year, rating): the reader's own state, most important
   * first. Screen readers hear it as the link's description.
   */
  meta?: ReactNode[]
}

/**
 * One line of card details, most important first. What does not fit drops out whole from the
 * end instead of cutting a word to «П…»: the row wraps and only its first line shows.
 */
function MetaLine({ id, items }: { id?: string; items: ReactNode[] }) {
  const shown = items.filter((item) => item !== null && item !== undefined && item !== false)
  return (
    <p
      id={id}
      className="mt-0.5 flex h-4 flex-wrap items-center overflow-hidden text-xs leading-4 text-fg-3"
    >
      {shown.map((item, index) => (
        <span
          key={isValidElement(item) && item.key != null ? item.key : index}
          className="flex max-w-full shrink-0 items-center"
        >
          {index ? (
            <span aria-hidden="true" className="px-1">
              ·
            </span>
          ) : null}
          {item}
        </span>
      ))}
    </p>
  )
}

export function TitleCard({
  title,
  entry,
  showKind,
  rank,
  className,
  eager,
  meta,
}: TitleCardProps) {
  const { t, locale, fmt } = useI18n()
  const metaId = useId()
  const library = useLibraryMap()
  const saved = entry ?? library.get(title.id) ?? null
  const actions = useLibraryActions()
  const name = titleName(title.names, locale)
  const rating = title.ratings[0]
  const year = yearRange(title)
  const progress =
    saved && saved.status === 'in_progress' && saved.progress > 0 && saved.progress < 100
      ? saved.progress
      : null

  const card = (
    <div className={cn('group/card relative min-w-0', className)}>
      <Link
        to={titleHref(title.id)}
        className="block rounded-md outline-offset-4"
        aria-label={[name, year, t(`kind.${title.kind}`)].filter(Boolean).join(', ')}
        aria-describedby={meta ? metaId : undefined}
      >
        {/* Alive under the pointer: the card lifts 2 px, the picture eases in 3 % and a soft light
            falls from the top edge; a press gives a little. Reduced motion makes it instant. */}
        <div className="relative transition-transform duration-300 ease-out group-hover/card:-translate-y-0.5 group-active/card:scale-[0.98]">
          <Poster
            src={title.poster}
            alt={name}
            kind={title.kind}
            eager={eager}
            className={cn(
              'shadow-poster transition-[box-shadow] duration-300 group-hover/card:ring-line-strong',
              '[&_img]:transition-[opacity,transform] [&_img]:duration-500 group-hover/card:[&_img]:scale-[1.03]',
              'after:pointer-events-none after:absolute after:inset-0 after:bg-gradient-to-b after:from-white/12 after:to-transparent after:to-40% after:opacity-0 after:transition-opacity after:duration-300 group-hover/card:after:opacity-100',
            )}
          />
          {saved ? (
            <Tooltip content={t(statusLabelKey(saved.kind, saved.status))}>
              <span className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md">
                <StatusIcon status={saved.status} className="size-3.5 [--panel:#000]" />
              </span>
            </Tooltip>
          ) : null}
          {progress !== null ? (
            <div className="absolute inset-x-0 bottom-0 rounded-b-md bg-gradient-to-t from-black/70 to-transparent px-2 pt-6 pb-2">
              <div className="h-[3px] overflow-hidden rounded-full bg-white/25">
                <div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : null}
        </div>
        {/* Ranked rows give the name up to two lines, in a caption of fixed height (two lines
            and the details) so the posters and numerals of a row stay level. */}
        <div className={cn('mt-2 px-0.5', rank !== undefined && 'h-[54px]')}>
          <p
            className={cn(
              'text-sm leading-[18px] font-medium text-fg',
              rank === undefined ? 'truncate' : 'line-clamp-2',
            )}
            title={name}
          >
            {name}
          </p>
          <MetaLine
            id={metaId}
            items={
              meta ?? [
                showKind ? <span className="truncate">{t(`kind.${title.kind}`)}</span> : null,
                year ? <span className="tabular">{year}</span> : null,
                rating ? (
                  <span className="tabular">
                    {ratingSourceLabel(rating.source)} {formatRating(rating, fmt)}
                  </span>
                ) : null,
              ]
            }
          />
        </div>
      </Link>
      {!saved ? (
        <Tooltip content={t('title.addToLibrary')}>
          <Button
            variant="primary"
            size="icon-sm"
            aria-label={`${t('title.addToLibrary')}: ${name}`}
            onClick={() => actions.add(title, 'planned')}
            className={cn(
              'absolute top-1.5 right-1.5 size-7 rounded-full shadow-md transition-opacity duration-200 max-md:hidden',
              // With a mouse it shows on hover or focus, and until then it is not there to click:
              // an invisible button in the poster's corner would add the title by accident.
              'pointer-events-none opacity-0 group-focus-within/card:pointer-events-auto group-focus-within/card:opacity-100 group-hover/card:pointer-events-auto group-hover/card:opacity-100',
              // Touch tablets cannot hover, so there it is always on view, with a 44 px target.
              '[@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100',
              'pointer-coarse:pointer-events-auto pointer-coarse:size-8 pointer-coarse:opacity-100 pointer-coarse:before:absolute pointer-coarse:before:-inset-1.5',
            )}
          >
            <Plus />
          </Button>
        </Tooltip>
      ) : null}
    </div>
  )

  if (rank === undefined) return card
  return (
    // relative: holds the sr-only label inside the shelf's scroller (it would widen the page).
    <div className="relative flex items-end">
      <span className="sr-only">{t('discover.rank', { rank })}</span>
      {/* The hollow numeral tucks under the poster's corner, its foot level with the poster's
          bottom edge: pb is the caption's fixed height (8 + 54 px), and a 0.73 line height makes
          the line box the digits' own height. Tabular figures keep a «1» from hiding behind the
          poster. */}
      <span
        aria-hidden="true"
        className="-mr-4 shrink-0 pb-[62px] text-[104px] leading-[0.73] font-bold tracking-[-0.06em] text-transparent tabular-nums select-none [-webkit-text-stroke:1.5px_var(--fg-3)] sm:-mr-5 sm:text-[128px]"
      >
        {rank}
      </span>
      {/* A fixed width keeps every poster in a row the same size, whatever the numeral's width. */}
      <div className={cn('relative shrink-0', RANKED_CARD_WIDTH)}>{card}</div>
    </div>
  )
}

const RANKED_CARD_WIDTH = 'w-[132px] sm:w-[172px]'

export function TitleCardSkeleton({ className, ranked }: { className?: string; ranked?: boolean }) {
  const skeleton = (
    <div className={cn('min-w-0', ranked && RANKED_CARD_WIDTH, className)}>
      <Skeleton className="aspect-[2/3] w-full rounded-md" />
      <Skeleton className="mt-2.5 h-3.5 w-4/5" />
      {ranked ? <Skeleton className="mt-1.5 h-3.5 w-3/5" /> : null}
      <Skeleton className="mt-1.5 h-3 w-1/2" />
    </div>
  )
  // Leaves the numeral's room, so the row does not jump when the charts arrive.
  return ranked ? <div className="pl-11 sm:pl-14">{skeleton}</div> : skeleton
}

export const GRID_CLASS =
  'grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-x-3 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(148px,1fr))] sm:gap-x-4 sm:gap-y-7'

export function TitleGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(GRID_CLASS, className)}>{children}</div>
}

/** Horizontal shelf with snap scrolling and edge arrows on pointer devices. */
export function Shelf({
  children,
  className,
  itemClassName = 'w-[124px] sm:w-[152px]',
  label,
}: {
  children: ReactNode[]
  className?: string
  itemClassName?: string
  label: string
}) {
  const { t } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: true, end: true })

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () =>
      setEdges((prev) => {
        const start = element.scrollLeft <= 4
        const end = element.scrollLeft + element.clientWidth >= element.scrollWidth - 4
        // Same values: return the old object so React skips the re-render.
        return prev.start === start && prev.end === end ? prev : { start, end }
      })
    update()
    element.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => {
      element.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [children.length])

  const scroll = (direction: 1 | -1) => {
    const element = ref.current
    if (element)
      element.scrollBy({ left: direction * element.clientWidth * 0.85, behavior: 'smooth' })
  }

  return (
    <div className={cn('group/shelf relative -mx-4 sm:-mx-6 lg:-mx-8', className)}>
      <div
        ref={ref}
        role="list"
        aria-label={label}
        className="no-scrollbar flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pt-1 pb-3 sm:scroll-px-6 sm:gap-4 sm:px-6 lg:scroll-px-8 lg:px-8"
      >
        {children.map((child, index) => (
          <div
            role="listitem"
            // Prefer the child's own key so items keep their state when the list reorders.
            key={isValidElement(child) && child.key != null ? child.key : index}
            className={cn('shrink-0 snap-start', itemClassName)}
          >
            {child}
          </div>
        ))}
      </div>
      {/* Arrows are for mice: touch screens swipe the shelf, and a hover-only arrow there would
          be an invisible target over the posters. */}
      {!edges.start ? (
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label={t('common.back')}
          onClick={() => scroll(-1)}
          className="absolute top-[38%] left-2 rounded-full bg-floating opacity-0 shadow-floating transition-opacity group-hover/shelf:opacity-100 max-md:hidden pointer-coarse:hidden"
        >
          <ChevronLeft />
        </Button>
      ) : null}
      {!edges.end ? (
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label={t('common.more')}
          onClick={() => scroll(1)}
          className="absolute top-[38%] right-2 rounded-full bg-floating opacity-0 shadow-floating transition-opacity group-hover/shelf:opacity-100 max-md:hidden pointer-coarse:hidden"
        >
          <ChevronRight />
        </Button>
      ) : null}
    </div>
  )
}

export function AddedCheck() {
  return <Check className="size-3.5" />
}
