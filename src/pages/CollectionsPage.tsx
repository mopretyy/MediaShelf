import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { PageBody, PageHeader } from '@/app/PageHeader'
import { CollectionCard, collectionHref } from '@/components/CollectionCard'
import { CollectionFormDialog } from '@/components/CollectionDialogs'
import { PosterFan } from '@/components/PosterFan'
import { Button } from '@/components/ui/button'
import { EmptyState, Skeleton } from '@/components/ui/misc'
import { useI18n } from '@/i18n'
import { useCollections } from '@/lib/collections'
import { useDocumentTitle } from '@/lib/hooks'

export const COLLECTION_GRID =
  'grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] sm:gap-4'

/** The user's own collections («Ужасы на Хеллоуин», «С друзьями»), and a way to start one. */
export default function CollectionsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const collections = useCollections()
  // «Новая подборка» from the command palette arrives as ?new=1: open the form, drop the flag.
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(() => params.get('new') === '1')
  useEffect(() => {
    if (params.get('new') !== '1') return
    const next = new URLSearchParams(params)
    next.delete('new')
    setParams(next, { replace: true })
  }, [params, setParams])
  useDocumentTitle(t('collections.title'))
  const list = collections.data ?? []
  const create = (
    <Button variant="primary" onClick={() => setCreating(true)}>
      <Plus />
      {t('collections.create')}
    </Button>
  )
  return (
    <>
      <PageHeader title={t('collections.title')} revealTitle />
      <PageBody>
        <div className="flex flex-wrap items-end justify-between gap-4 pt-2 md:pt-6">
          <h1 className="display text-3xl sm:text-4xl">{t('collections.title')}</h1>
          {list.length ? create : null}
        </div>
        {collections.isLoading ? (
          <div className={`mt-6 ${COLLECTION_GRID}`}>
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-[170px] rounded-xl" />
            ))}
          </div>
        ) : list.length ? (
          <div className={`mt-6 ${COLLECTION_GRID}`}>
            {list.map((collection) => (
              <CollectionCard key={collection.id} collection={collection} />
            ))}
          </div>
        ) : (
          <EmptyState
            art={<PosterFan />}
            title={t('collections.empty')}
            text={t('collections.emptyText')}
            action={create}
            className="max-w-md"
          />
        )}
      </PageBody>
      <CollectionFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(collection) => navigate(collectionHref(collection.id))}
      />
    </>
  )
}
