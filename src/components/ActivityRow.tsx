import { Link } from 'react-router'
import type { ActivityItem } from '@shared/types.ts'
import { Poster } from '@/components/Poster'
import { StatusIcon } from '@/components/StatusIcon'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { statusLabelKey, titleHref, titleName } from '@/lib/titles'

/**
 * How a row tells the time: «3 недели назад» in a plain feed, «14:05» or nothing at all under
 * a day heading, which already says when.
 */
export type ActivityTime = 'relative' | 'clock' | 'none'

/** One line of the activity feed: poster, title, what happened, when. */
export function ActivityRow({
  item,
  time = 'relative',
}: {
  item: ActivityItem
  time?: ActivityTime
}) {
  const { t, locale, fmt } = useI18n()
  const status = item.data.status ? t(statusLabelKey(item.kind, item.data.status)) : ''
  const text =
    item.type === 'added'
      ? t('activity.added', { status })
      : item.type === 'status'
        ? t('activity.status', { status })
        : item.type === 'rated'
          ? t('activity.rated', { rating: item.data.rating ?? '' })
          : item.type === 'favorite'
            ? t('activity.favorite')
            : item.type === 'episodes'
              ? t('activity.episodes', { count: item.data.count ?? 1 })
              : item.type === 'playthrough'
                ? t('activity.playthrough')
                : t('activity.removed')
  // mergeActivity folds a rating made together with a status change into the status line.
  const withRating =
    (item.type === 'added' || item.type === 'status') && item.data.rating
      ? `${text} · ${t('activity.rated', { rating: item.data.rating })}`
      : text
  return (
    <li>
      <Link
        to={titleHref(item.titleId)}
        className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-hover"
      >
        <Poster
          src={item.title?.poster}
          alt=""
          kind={item.kind}
          sizes="sm"
          className="w-8 shrink-0"
          rounded="rounded-xs"
        />
        <span className="min-w-0 flex-1">
          {/* Two lines before an ellipsis: in the profile rail one line cut most titles short. */}
          <span className="line-clamp-2 text-base break-words">
            {item.title ? titleName(item.title.names, locale) : item.titleId}
          </span>
          {/* truncate on the inner span: on a flex container it clips without an ellipsis. */}
          <span className="flex min-w-0 items-center gap-1.5 text-sm text-fg-3">
            {item.data.status ? (
              <StatusIcon status={item.data.status} className="size-3.5 shrink-0" />
            ) : null}
            <span className="truncate">{withRating}</span>
          </span>
        </span>
        {time === 'none' ? null : (
          <time
            dateTime={item.createdAt}
            className={cn('shrink-0 text-xs text-fg-3', time === 'clock' && 'tabular-nums')}
          >
            {time === 'clock'
              ? new Date(item.createdAt).toLocaleTimeString(locale, {
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : fmt.relative(item.createdAt)}
          </time>
        )}
      </Link>
    </li>
  )
}
