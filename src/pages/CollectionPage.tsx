import { Compass, Pencil, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { PageBody, PageHeader } from '@/app/PageHeader'
import { CollectionFormDialog } from '@/components/CollectionDialogs'
import { useErrorMessage } from '@/components/library-actions'
import { TitleCard, TitleCardSkeleton, TitleGrid } from '@/components/TitleCard'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { EmptyState, Skeleton } from '@/components/ui/misc'
import { Tooltip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { useCollection, useCollectionItem, useDeleteCollection } from '@/lib/collections'
import { useDocumentTitle } from '@/lib/hooks'
import { useUser } from '@/lib/queries'
import { titleName } from '@/lib/titles'

/**
 * One collection: its name and description, its titles as a poster grid, and for its owner the
 * ways to rename it, delete it or take a title out. Anyone signed in may look, like profiles.
 */
export default function CollectionPage() {
  const { id } = useParams()
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const user = useUser()
  const message = useErrorMessage()
  const collection = useCollection(id)
  const remove = useDeleteCollection()
  const item = useCollectionItem()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const data = collection.data
  const own = Boolean(data && user && data.ownerId === user.id)
  useDocumentTitle(data?.name ?? t('collections.title'))

  if (collection.isError)
    return (
      <>
        <PageHeader title={t('collections.title')} back />
        <PageBody>
          <EmptyState
            title={t('collections.notFound')}
            action={
              <Button asChild variant="secondary">
                <Link to="/collections">{t('collections.title')}</Link>
              </Button>
            }
          />
        </PageBody>
      </>
    )

  return (
    <>
      <PageHeader title={data?.name ?? t('collections.title')} back revealTitle={Boolean(data)} />
      <PageBody>
        <div className="flex flex-wrap items-end justify-between gap-4 pt-2 md:pt-6">
          <div className="min-w-0">
            <p className="text-sm font-medium text-fg-3">
              <Link
                to={own ? '/collections' : `/users/${data?.ownerId ?? ''}`}
                className="hover:text-fg"
              >
                {own || !data
                  ? t('collections.title')
                  : t('collections.by', { name: data.ownerName })}
              </Link>
            </p>
            {data ? (
              <>
                <h1 className="display mt-0.5 text-3xl break-words sm:text-4xl">{data.name}</h1>
                <p className="mt-1.5 max-w-2xl text-base text-fg-2">
                  {t('count.titles', { count: data.count })}
                  {data.description ? ` · ${data.description}` : ''}
                </p>
              </>
            ) : (
              <>
                <Skeleton className="mt-1 h-9 w-64" />
                <Skeleton className="mt-2 h-4 w-40" />
              </>
            )}
          </div>
          {own ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Pencil />
                {t('common.edit')}
              </Button>
              <Tooltip content={t('common.delete')}>
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label={t('common.delete')}
                  onClick={() => setDeleting(true)}
                >
                  <Trash2 />
                </Button>
              </Tooltip>
            </div>
          ) : null}
        </div>

        <div className="mt-6">
          {!data ? (
            <TitleGrid>
              {Array.from({ length: 12 }, (_, index) => (
                <TitleCardSkeleton key={index} />
              ))}
            </TitleGrid>
          ) : data.items.length ? (
            <TitleGrid>
              {data.items.map(({ title }) => (
                <div key={title.id} className="group/item relative">
                  <TitleCard title={title} showKind />
                  {own ? (
                    <Tooltip content={t('collections.removeFrom')}>
                      <Button
                        variant="secondary"
                        size="icon-sm"
                        aria-label={`${t('collections.removeFrom')}: ${titleName(title.names, locale)}`}
                        onClick={() =>
                          item.mutate(
                            { id: data.id, titleId: title.id, inside: false },
                            {
                              onSuccess: () =>
                                toast(t('collections.removed', { name: data.name }), {
                                  description: titleName(title.names, locale),
                                }),
                              onError: (error) => toast.error(message(error)),
                            },
                          )
                        }
                        className="absolute top-1.5 left-1.5 size-7 rounded-full bg-black/55 text-white ring-0 backdrop-blur-md transition-opacity hover:bg-black/75 md:opacity-0 md:group-focus-within/item:opacity-100 md:group-hover/item:opacity-100 pointer-coarse:size-8 pointer-coarse:opacity-100"
                      >
                        <X />
                      </Button>
                    </Tooltip>
                  ) : null}
                </div>
              ))}
            </TitleGrid>
          ) : (
            <EmptyState
              title={t('collections.emptyCollection')}
              text={own ? t('collections.emptyCollectionText') : undefined}
              action={
                own ? (
                  <Button asChild variant="secondary">
                    <Link to="/discover">
                      <Compass />
                      {t('nav.discover')}
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          )}
        </div>
      </PageBody>
      {data && own ? (
        <>
          <CollectionFormDialog open={editing} onOpenChange={setEditing} collection={data} />
          <ConfirmDialog
            open={deleting}
            onOpenChange={setDeleting}
            title={t('collections.deleteTitle')}
            description={t('collections.deleteText', { name: data.name })}
            confirmLabel={t('common.delete')}
            destructive
            onConfirm={() =>
              remove.mutateAsync(data.id).then(
                () => {
                  setDeleting(false)
                  toast(t('collections.deleted'))
                  navigate('/collections', { replace: true })
                },
                (error) => toast.error(message(error)),
              )
            }
          />
        </>
      ) : null}
    </>
  )
}
