import { Link } from 'react-router'
import type { CollectionSummary } from '@shared/types.ts'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'

export const collectionHref = (id: string) => `/collections/${id}`

/**
 * A collection as a small shelf: its latest four posters side by side on a raised surface, the
 * name and how many titles it holds. Empty places stay quiet hairline slots.
 */
export function CollectionCard({
  collection,
  className,
}: {
  collection: CollectionSummary
  className?: string
}) {
  const { t } = useI18n()
  const slots = Array.from({ length: 4 }, (_, index) => collection.posters[index] ?? null)
  return (
    <Link
      to={collectionHref(collection.id)}
      data-testid="collection-card"
      className={cn(
        'group/collection block rounded-xl bg-raised p-2.5 ring-1 ring-line ring-inset outline-offset-4 transition-colors hover:ring-line-strong',
        className,
      )}
    >
      <div aria-hidden="true" className="grid grid-cols-4 gap-1.5">
        {slots.map((poster, index) =>
          poster ? (
            <img
              key={index}
              src={poster}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="aspect-[2/3] w-full rounded-sm object-cover ring-1 ring-line-subtle transition-transform duration-500 ease-out group-hover/collection:-translate-y-0.5"
              style={{ transitionDelay: `${index * 30}ms` }}
            />
          ) : (
            <span
              key={index}
              className="aspect-[2/3] rounded-sm bg-active ring-1 ring-line-subtle ring-inset"
            />
          ),
        )}
      </div>
      <div className="px-1 pt-2.5 pb-0.5">
        <p className="truncate text-base font-semibold tracking-tight">{collection.name}</p>
        <p className="truncate text-sm text-fg-3">
          {t('count.titles', { count: collection.count })}
          {collection.description ? ` · ${collection.description}` : ''}
        </p>
      </div>
    </Link>
  )
}
