import { Layers } from 'lucide-react'
import { Link } from 'react-router'
import { collectionHref } from '@/components/CollectionCard'
import { useI18n } from '@/i18n'
import { useCollections } from '@/lib/collections'

/** «В подборках»: the user's collections that hold this title, each a link. Nothing otherwise. */
export function InCollections({ titleId }: { titleId: string }) {
  const { t } = useI18n()
  const collections = useCollections(titleId)
  const holding = (collections.data ?? []).filter((collection) => collection.contains)
  if (!holding.length) return null
  return (
    <section
      aria-labelledby="in-collections-heading"
      data-testid="in-collections"
      className="rounded-xl bg-raised p-4 ring-1 ring-line ring-inset"
    >
      <h2 id="in-collections-heading" className="mb-2.5 text-md font-semibold tracking-[-0.01em]">
        {t('collections.inCollections')}
      </h2>
      <ul className="flex flex-wrap gap-1.5">
        {holding.map((collection) => (
          <li key={collection.id}>
            <Link
              to={collectionHref(collection.id)}
              className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full bg-panel px-3 text-sm font-medium text-fg-2 ring-1 ring-line ring-inset transition-colors hover:text-fg hover:ring-line-strong pointer-coarse:h-10"
            >
              <Layers className="size-3.5 shrink-0" />
              <span className="truncate">{collection.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
