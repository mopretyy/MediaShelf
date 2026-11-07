import { Compass, Dices, Image as ImageIcon, Pencil, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { PageBody, PageHeader } from '@/app/PageHeader'
import { CollectionFormDialog } from '@/components/CollectionDialogs'
import { useErrorMessage } from '@/components/library-actions'
import { Backdrop } from '@/components/Poster'
import { TitleCard, TitleCardSkeleton, TitleGrid } from '@/components/TitleCard'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { EmptyState, Skeleton } from '@/components/ui/misc'
import { Tooltip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import {
  useCollection,
  useCollectionItem,
  useDeleteCollection,
  useUpdateCollection,
} from '@/lib/collections'
import { cn } from '@/lib/cn'
import { useDocumentTitle } from '@/lib/hooks'
import { useUser } from '@/lib/queries'
import { titleName } from '@/lib/titles'

/** The small round buttons over a poster: dark glass, white glyph. */
const OVERLAY_BUTTON =
  'size-7 rounded-full bg-black/55 text-white ring-0 backdrop-blur-md hover:bg-black/75 pointer-coarse:size-8'

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
  const update = useUpdateCollection()
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
        {/* The collection's frame heads the page, like the heroes of Home and the title page:
            the owner's pick, else the latest title with one. Always the dark palette over it. */}
        {data ? (
          <section
            data-testid="collection-hero"
            className="dark relative isolate mt-2 overflow-hidden rounded-2xl bg-black text-fg md:mt-6"
          >
            {data.cover?.backdrop ? (
              <Backdrop
                src={data.cover.backdrop}
                className="absolute inset-0 -z-20 size-full animate-hero-zoom object-[center_25%]"
              />
            ) : data.cover?.poster ? (
              <img
                src={data.cover.poster}
                alt=""
                aria-hidden="true"
                decoding="async"
                referrerPolicy="no-referrer"
                className="absolute inset-0 -z-20 size-full scale-125 object-cover opacity-70 blur-3xl"
              />
            ) : null}
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/55 to-black/10" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/70 to-transparent" />
            <div className="flex min-h-[240px] flex-col justify-end gap-4 p-5 sm:min-h-[300px] sm:p-8">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white/65">
                  <Link
                    to={own ? '/collections' : `/users/${data.ownerId}`}
                    className="rounded-sm hover:text-white"
                  >
                    {own ? t('collections.title') : t('collections.by', { name: data.ownerName })}
                  </Link>
                </p>
                <h1 className="display mt-1 text-4xl break-words text-white sm:text-5xl">
                  {data.name}
                </h1>
                <p className="mt-2 max-w-2xl text-md text-white/75">
                  {t('count.titles', { count: data.count })}
                  {data.description ? ` · ${data.description}` : ''}
                </p>
              </div>
              {own ? (
                <div className="flex flex-wrap gap-2">
                  {data.count ? (
                    <Button
                      asChild
                      variant="primary"
                      className="bg-white text-black hover:bg-white/90"
                    >
                      <Link to={`/shuffle?source=collection&collection=${data.id}`}>
                        <Dices />
                        {t('nav.shuffle')}
                      </Link>
                    </Button>
                  ) : null}
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
          </section>
        ) : (
          <Skeleton className="mt-2 h-[240px] w-full rounded-2xl sm:h-[300px] md:mt-6" />
        )}

        <div className="mt-8">
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
                    <div className="absolute top-1.5 left-1.5 flex gap-1 transition-opacity md:opacity-0 md:group-focus-within/item:opacity-100 md:group-hover/item:opacity-100 pointer-coarse:opacity-100">
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
                          className={OVERLAY_BUTTON}
                        >
                          <X />
                        </Button>
                      </Tooltip>
                      {title.backdrop || title.poster ? (
                        <Tooltip
                          content={
                            data.coverTitleId === title.id
                              ? t('collections.isCover')
                              : t('collections.makeCover')
                          }
                        >
                          <Button
                            variant="secondary"
                            size="icon-sm"
                            aria-label={`${t('collections.makeCover')}: ${titleName(title.names, locale)}`}
                            aria-pressed={data.coverTitleId === title.id}
                            onClick={() =>
                              update.mutate(
                                {
                                  id: data.id,
                                  coverTitleId: data.coverTitleId === title.id ? null : title.id,
                                },
                                {
                                  onSuccess: () => toast(t('collections.coverChanged')),
                                  onError: (error) => toast.error(message(error)),
                                },
                              )
                            }
                            className={cn(
                              OVERLAY_BUTTON,
                              data.coverTitleId === title.id &&
                                'bg-white text-black hover:bg-white/90',
                            )}
                          >
                            <ImageIcon />
                          </Button>
                        </Tooltip>
                      ) : null}
                    </div>
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
