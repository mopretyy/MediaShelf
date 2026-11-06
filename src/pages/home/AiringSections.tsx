import { Check, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import type { AiringItem } from '@shared/types.ts'
import { Poster } from '@/components/Poster'
import { Shelf } from '@/components/TitleCard'
import { useErrorMessage } from '@/components/library-actions'
import { Button } from '@/components/ui/button'
import { SectionHeader } from '@/components/ui/misc'
import { useI18n } from '@/i18n'
import { useAiring } from '@/lib/airing'
import { groupByDay, relativeDay } from '@/lib/airing-days'
import { cn } from '@/lib/cn'
import { useMarkNext } from '@/lib/queries'
import { episodeCode, statusLabelKey, titleHref, titleName } from '@/lib/titles'

const VISIBLE_DAYS = 4

function dayLabel(day: string, locale: string, withWeekday = true) {
  return new Intl.DateTimeFormat(locale, {
    ...(withWeekday ? { weekday: 'short' as const } : {}),
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`))
}

function useEpisodeText() {
  const { t } = useI18n()
  return (item: AiringItem) =>
    [t('episodes.code', episodeCode(item.episode.season, item.episode.number)), item.episode.name]
      .filter(Boolean)
      .join(' · ')
}

function FreshCard({ item, today }: { item: AiringItem; today: string }) {
  const { t, locale } = useI18n()
  const markNext = useMarkNext()
  const message = useErrorMessage()
  const episodeText = useEpisodeText()
  const name = titleName(item.title.names, locale)
  const when =
    relativeDay(item.episode.airdate, today, locale) ??
    dayLabel(item.episode.airdate, locale, false)
  const code = t('episodes.code', episodeCode(item.episode.season, item.episode.number))
  return (
    <div className="flex h-full gap-3.5 rounded-xl bg-raised p-3 ring-1 ring-line ring-inset">
      <Link
        to={titleHref(item.titleId)}
        tabIndex={-1}
        aria-hidden="true"
        className="w-[68px] shrink-0 self-start rounded-md"
      >
        <Poster src={item.title.poster} alt="" kind={item.kind} sizes="sm" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          to={titleHref(item.titleId)}
          className="truncate rounded-sm text-md font-semibold tracking-tight hover:underline hover:decoration-line-strong hover:underline-offset-4"
        >
          {name}
        </Link>
        <p className="mt-0.5 truncate text-sm text-fg-2">{episodeText(item)}</p>
        <p className="mt-0.5 truncate text-xs text-fg-3">
          {t('airing.aired', { when })}
          {item.count > 1 ? ` · ${t('airing.more', { count: item.count - 1 })}` : ''}
        </p>
        <div className="mt-auto pt-3">
          <Button
            size="xs"
            variant="secondary"
            loading={markNext.isPending}
            onClick={() =>
              markNext.mutate(item.titleId, {
                onSuccess: ({ statusChanged }) =>
                  toast(
                    statusChanged
                      ? t('toast.autoStatus', {
                          status: t(statusLabelKey(item.kind, statusChanged.to)),
                        })
                      : t('toast.episodeMarked'),
                    { description: `${name} · ${code}` },
                  ),
                onError: (error) => toast.error(message(error)),
              })
            }
          >
            <Check />
            {t('airing.watched')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function UpcomingList({ items, today }: { items: AiringItem[]; today: string }) {
  const { t, locale } = useI18n()
  const episodeText = useEpisodeText()
  const [expanded, setExpanded] = useState(false)
  const groups = groupByDay(items)
  const visible = expanded ? groups : groups.slice(0, VISIBLE_DAYS)
  return (
    <>
      <ul className="divide-y divide-line overflow-hidden rounded-xl bg-raised ring-1 ring-line ring-inset">
        {visible.map((group) => {
          const relative = relativeDay(group.day, today, locale)
          const date = dayLabel(group.day, locale)
          return (
            <li
              key={group.day}
              className="grid gap-x-6 gap-y-2.5 px-4 py-3.5 sm:grid-cols-[148px_minmax(0,1fr)] sm:px-5"
            >
              <div className="flex items-baseline gap-2 sm:block">
                <p className="text-base font-semibold first-letter:uppercase">{relative ?? date}</p>
                {relative ? <p className="text-sm text-fg-3 tabular-nums">{date}</p> : null}
              </div>
              <ul className="grid gap-2.5">
                {group.items.map((item) => (
                  <li key={`${item.titleId}:${item.episode.season}:${item.episode.number}`}>
                    <Link
                      to={titleHref(item.titleId)}
                      className="group/upcoming -m-1 flex items-center gap-3 rounded-md p-1 transition-colors hover:bg-hover"
                    >
                      <Poster
                        src={item.title.poster}
                        alt=""
                        kind={item.kind}
                        sizes="sm"
                        rounded="rounded-sm"
                        className="w-9 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-medium">
                          {titleName(item.title.names, locale)}
                        </p>
                        <p className="truncate text-sm text-fg-2">
                          {episodeText(item)}
                          {item.episode.number === 1 ? (
                            <span className="ml-2 rounded-sm px-1.5 py-px text-2xs font-medium text-fg ring-1 ring-line-strong ring-inset">
                              {t('airing.premiere')}
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ul>
      {groups.length > VISIBLE_DAYS ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? t('airing.showLess') : t('airing.showAll')}
          <ChevronDown className={cn('transition-transform', expanded && 'rotate-180')} />
        </Button>
      ) : null}
    </>
  )
}

/**
 * Home's personal episode feed: fresh episodes of shows you had caught up on (with a one-tap
 * "watched") and a short calendar of what airs next. Renders nothing when there is nothing to say.
 */
export function AiringSections() {
  const { t } = useI18n()
  const airing = useAiring()
  const data = airing.data
  if (!data || (!data.fresh.length && !data.upcoming.length)) return null
  return (
    <>
      {data.fresh.length ? (
        <section className="mt-12" aria-labelledby="fresh-heading">
          <SectionHeader id="fresh-heading" title={t('airing.freshTitle')} />
          <Shelf label={t('airing.freshTitle')} itemClassName="w-[300px] sm:w-[340px]">
            {data.fresh.map((item) => (
              <FreshCard key={item.titleId} item={item} today={data.today} />
            ))}
          </Shelf>
        </section>
      ) : null}
      {data.upcoming.length ? (
        <section className="mt-12" aria-labelledby="upcoming-heading">
          <SectionHeader id="upcoming-heading" title={t('airing.upcomingTitle')} />
          <UpcomingList items={data.upcoming} today={data.today} />
        </section>
      ) : null}
    </>
  )
}
