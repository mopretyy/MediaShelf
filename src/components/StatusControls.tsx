import { Check, ChevronDown, Heart, Plus, Star, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { STATUSES_BY_KIND } from '@shared/status.ts'
import type { Kind, LibraryEntry, Status, TitleRecord } from '@shared/types.ts'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { useEntry } from '@/lib/queries'
import { statusLabelKey } from '@/lib/titles'
import { Button } from './ui/button'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from './ui/menu'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Tooltip } from './ui/tooltip'
import { StatusIcon } from './StatusIcon'
import { useLibraryActions } from './library-actions'

export function StatusMenuItems({
  kind,
  value,
  onSelect,
}: {
  kind: Kind
  value: Status | null
  onSelect(status: Status): void
}) {
  const { t } = useI18n()
  return (
    <MenuRadioGroup value={value ?? ''} onValueChange={(next) => onSelect(next as Status)}>
      {STATUSES_BY_KIND[kind].map((status) => (
        <MenuRadioItem key={status} value={status}>
          <StatusIcon status={status} />
          {t(statusLabelKey(kind, status))}
        </MenuRadioItem>
      ))}
    </MenuRadioGroup>
  )
}

/**
 * Primary library control: "Add" for new titles, the current status for saved ones. `className`
 * goes on the outer element of either state; given room (`flex-1`), both fill it. In a narrow
 * `@container` (the title hero on a 320 px phone) "Add to library" reads just "Add", and keeps
 * its full name for assistive technology.
 */
export function LibraryButton({
  title,
  size = 'md',
  className,
  onRemove,
}: {
  title: TitleRecord
  size?: 'sm' | 'md' | 'lg'
  className?: string
  onRemove?: () => void
}) {
  const { t } = useI18n()
  const entry = useEntry(title.id)
  const actions = useLibraryActions()

  if (!entry) {
    return (
      <div className={cn('inline-flex', className)}>
        <Button
          variant="primary"
          size={size}
          className="min-w-0 shrink grow rounded-r-none"
          onClick={() => actions.add(title, 'planned')}
          data-testid="add-to-library"
        >
          <Plus />
          <span className="truncate @max-2xs:sr-only">{t('title.addToLibrary')}</span>
          <span aria-hidden="true" className="hidden @max-2xs:inline">
            {t('common.add')}
          </span>
        </Button>
        <Menu>
          <MenuTrigger asChild>
            <Button
              variant="primary"
              size={size === 'lg' ? 'icon-lg' : size === 'sm' ? 'icon-sm' : 'icon'}
              className="rounded-l-none border-l border-primary-fg/15"
              aria-label={t('title.addAs')}
            >
              <ChevronDown />
            </Button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuLabel>{t('title.addAs')}</MenuLabel>
            <StatusMenuItems
              kind={title.kind}
              value={null}
              onSelect={(status) => actions.add(title, status)}
            />
          </MenuContent>
        </Menu>
      </div>
    )
  }

  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="secondary" size={size} className={className} data-testid="status-button">
          <StatusIcon status={entry.status} />
          {t(statusLabelKey(entry.kind, entry.status))}
          <ChevronDown className="!size-3.5 text-fg-3" />
        </Button>
      </MenuTrigger>
      <MenuContent align="start">
        <StatusMenuItems
          kind={entry.kind}
          value={entry.status}
          onSelect={(status) => actions.setStatus(entry, status)}
        />
        {onRemove ? (
          <>
            <MenuSeparator />
            <MenuItem destructive onSelect={onRemove}>
              <Trash2 />
              {t('title.removeFromLibrary')}
            </MenuItem>
          </>
        ) : null}
      </MenuContent>
    </Menu>
  )
}

export function FavoriteButton({
  entry,
  size = 'icon',
}: {
  entry: LibraryEntry
  size?: 'icon' | 'icon-sm' | 'icon-lg'
}) {
  const { t } = useI18n()
  const actions = useLibraryActions()
  const label = entry.favorite ? t('title.unfavorite') : t('title.favorite')
  return (
    <Tooltip content={label}>
      <Button
        variant="secondary"
        size={size}
        aria-label={label}
        aria-pressed={entry.favorite}
        onClick={() => actions.toggleFavorite(entry)}
      >
        <Heart
          className={cn(
            'transition-transform duration-200',
            entry.favorite && 'scale-110 fill-current',
          )}
        />
      </Button>
    </Tooltip>
  )
}

const SCORES = Array.from({ length: 10 }, (_, index) => index + 1)

/**
 * Where an arrow, Home or End key moves on the 1–10 scale; null for any other key. As in the APG
 * radio group, Right and Down go to the next score, Left and Up to the previous one.
 */
function scoreForKey(key: string, score: number) {
  const target =
    key === 'ArrowRight' || key === 'ArrowDown'
      ? score + 1
      : key === 'ArrowLeft' || key === 'ArrowUp'
        ? score - 1
        : key === 'Home'
          ? 1
          : key === 'End'
            ? 10
            : null
  return target === null ? null : Math.min(10, Math.max(1, target))
}

/**
 * The 1–10 scale as a radio group (APG): one Tab stop, and arrows, Home and End move the focus
 * and select the score they land on. A click, Enter or Space picks the score for good
 * (`onCommit`). Picking the current score again keeps it: clearing is always a separate, explicit
 * action. Phones get a 5 × 2 grid of 44 px targets, wider screens a compact row.
 */
export function RatingScale({
  value,
  onChange,
  onCommit,
  label,
}: {
  value: number | null
  /** Every selection, arrow keys included. */
  onChange(value: number): void
  /** A click, Enter or Space: the choice is final (a popover closes on it). */
  onCommit?(value: number): void
  label: string
}) {
  const { t } = useI18n()
  // Preview only for a mouse: touch has no hover to end it, and a tap commits anyway.
  const [hover, setHover] = useState<number | null>(null)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const shown = hover ?? value ?? 0
  const tabStop = value ?? 1
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, score: number) => {
    const target = scoreForKey(event.key, score)
    if (target === null) return
    event.preventDefault()
    buttons.current[target - 1]?.focus()
    if (target !== value) onChange(target)
  }
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid grid-cols-5 gap-1.5 sm:flex sm:items-center sm:gap-1"
      onPointerLeave={() => setHover(null)}
    >
      {SCORES.map((score) => (
        <button
          key={score}
          ref={(node) => {
            buttons.current[score - 1] = node
          }}
          type="button"
          role="radio"
          aria-checked={value === score}
          aria-label={t('title.ratingOption', { rating: score })}
          tabIndex={score === tabStop ? 0 : -1}
          onKeyDown={(event) => onKeyDown(event, score)}
          onPointerEnter={(event) => event.pointerType === 'mouse' && setHover(score)}
          onClick={() => {
            if (score !== value) onChange(score)
            onCommit?.(score)
          }}
          className={cn(
            'tabular grid h-11 w-full place-items-center rounded-md text-base font-semibold transition-colors duration-100',
            'sm:size-7 sm:text-sm sm:pointer-coarse:size-9',
            score <= shown
              ? 'bg-fg text-panel'
              : 'bg-raised text-fg-3 ring-1 ring-line ring-inset hover:text-fg',
          )}
        >
          {score}
        </button>
      ))}
    </div>
  )
}

/** Height of the phone tab bar, home indicator included (`--tabbar-h`, 0 from md up). */
function tabBarHeight() {
  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;bottom:0;height:var(--tabbar-h);visibility:hidden'
  document.body.append(probe)
  const height = probe.getBoundingClientRect().height
  probe.remove()
  return height
}

/**
 * The rating as a button with a popover scale. The default trigger fits an action bar: in a
 * narrow `@container` it shrinks to the star (and the score), so it stays on one row with its
 * neighbours on a 320 px phone.
 */
export function RatingButton({
  entry,
  trigger,
  size = 'md',
}: {
  entry: LibraryEntry
  trigger?: ReactNode
  size?: 'md' | 'lg'
}) {
  const { t } = useI18n()
  const actions = useLibraryActions()
  const [open, setOpen] = useState(false)
  // On a phone the popover keeps clear of the tab bar, flipping up rather than under it.
  const [bottomInset, setBottomInset] = useState(0)
  // Arrow keys select as they go (radio group). Their choice is saved once, when the popover
  // closes, rather than once per step with a toast each.
  const [draft, setDraft] = useState<number | null>(null)
  const save = (rating: number | null) => {
    if (rating !== entry.rating) actions.rate(entry, rating)
  }
  const close = () => {
    setDraft(null)
    setOpen(false)
  }
  const shown = draft ?? entry.rating
  // Leaving the page with the popover open (Back, a link) unmounts it without onOpenChange: save
  // the arrow-key choice the user saw selected then too.
  const pending = useRef({ draft, entry, rate: actions.rate })
  useEffect(() => {
    pending.current = { draft, entry, rate: actions.rate }
  })
  useEffect(
    () => () => {
      const { draft, entry, rate } = pending.current
      if (draft !== null && draft !== entry.rating) rate(entry, draft)
    },
    [],
  )
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setBottomInset(tabBarHeight())
          return setOpen(true)
        }
        if (draft !== null) save(draft)
        close()
      }}
    >
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button
            variant="secondary"
            size={size}
            aria-label={
              entry.rating ? t('title.yourRatingValue', { rating: entry.rating }) : undefined
            }
            className={entry.rating ? '@max-2xs:px-3.5' : '@max-2xs:w-11 @max-2xs:px-0'}
            data-testid="rating-button"
          >
            <Star className={cn(entry.rating && 'fill-current')} />
            {entry.rating ? (
              <span className="tabular">
                {entry.rating}
                <span className="@max-2xs:hidden">/10</span>
              </span>
            ) : (
              <span className="@max-2xs:sr-only">{t('title.rate')}</span>
            )}
          </Button>
        )}
      </PopoverTrigger>
      {/* A phone gets the 5 × 2 grid at a width that fits a 320 px screen. */}
      <PopoverContent
        align="start"
        collisionPadding={{ top: 8, right: 8, left: 8, bottom: 8 + bottomInset }}
        className="w-[min(18rem,calc(100vw-1rem))] sm:w-auto"
      >
        <p className="mb-2.5 text-sm font-medium">{t('title.yourRating')}</p>
        <RatingScale
          label={t('title.yourRating')}
          value={shown}
          onChange={setDraft}
          onCommit={(rating) => {
            save(rating)
            close()
          }}
        />
        {shown ? (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 -ml-3 text-fg-3 max-sm:h-11"
            onClick={() => {
              save(null)
              close()
            }}
          >
            {t('title.clearRating')}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

/** Compact status picker used on cards and list rows. */
export function StatusPicker({ entry, className }: { entry: LibraryEntry; className?: string }) {
  const { t } = useI18n()
  const actions = useLibraryActions()
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-sm text-fg-2 transition-colors hover:bg-hover hover:text-fg data-[state=open]:bg-hover',
            className,
          )}
        >
          <StatusIcon status={entry.status} />
          <span className="truncate">{t(statusLabelKey(entry.kind, entry.status))}</span>
        </button>
      </MenuTrigger>
      <MenuContent align="start">
        <StatusMenuItems
          kind={entry.kind}
          value={entry.status}
          onSelect={(status) => actions.setStatus(entry, status)}
        />
      </MenuContent>
    </Menu>
  )
}

export function InLibraryMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'grid size-6 place-items-center rounded-full bg-white text-black shadow-md',
        className,
      )}
    >
      <Check className="size-3.5" strokeWidth={3} />
    </span>
  )
}
