import { Check, Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { CollectionSummary } from '@shared/types.ts'
import { useErrorMessage } from '@/components/library-actions'
import { Button, Spinner } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Field, Input, Textarea } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import {
  useCollectionItem,
  useCollections,
  useCreateCollection,
  useUpdateCollection,
} from '@/lib/collections'

/** Name and description of a new collection, or of one being edited. */
export function CollectionFormDialog({
  open,
  onOpenChange,
  collection,
  onSaved,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  /** Edit this one; create a new one without it. */
  collection?: CollectionSummary
  onSaved?(collection: CollectionSummary): void
}) {
  const { t } = useI18n()
  const message = useErrorMessage()
  const create = useCreateCollection()
  const update = useUpdateCollection()
  const [name, setName] = useState(collection?.name ?? '')
  const [description, setDescription] = useState(collection?.description ?? '')
  // Fresh fields each time the dialog opens.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setName(collection?.name ?? '')
      setDescription(collection?.description ?? '')
    }
  }
  const busy = create.isPending || update.isPending
  const submit = () => {
    const input = { name: name.trim(), description: description.trim() }
    if (!input.name) return
    const done = {
      onSuccess: (saved: CollectionSummary) => {
        onOpenChange(false)
        onSaved?.(saved)
      },
      onError: (error: unknown) => toast.error(message(error)),
    }
    if (collection) update.mutate({ id: collection.id, ...input }, done)
    else create.mutate(input, done)
  }
  return (
    <Dialog open={open} onOpenChange={(value) => !busy && onOpenChange(value)}>
      <DialogContent title={collection ? t('collections.edit') : t('collections.create')}>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <Field label={t('collections.name')}>
            {(props) => (
              <Input
                {...props}
                autoFocus
                maxLength={80}
                value={name}
                placeholder={t('collections.namePlaceholder')}
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </Field>
          <Field label={`${t('collections.description')} (${t('common.optional')})`}>
            {(props) => (
              <Textarea
                {...props}
                maxLength={500}
                rows={3}
                className="min-h-20"
                value={description}
                placeholder={t('collections.descriptionPlaceholder')}
                onChange={(event) => setDescription(event.target.value)}
              />
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={busy} disabled={!name.trim()}>
              {collection ? t('common.save') : t('collections.create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * «В подборку» on a title: every collection with a check where the title already is, one tap to
 * put it in or take it out, and a new collection made here with the title already inside.
 */
export function CollectionPicker({
  open,
  onOpenChange,
  titleId,
  titleName,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  titleId: string
  titleName: string
}) {
  const { t } = useI18n()
  const message = useErrorMessage()
  const collections = useCollections(open ? titleId : undefined)
  const item = useCollectionItem()
  const [creating, setCreating] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const toggle = (collection: CollectionSummary, inside: boolean) => {
    setPending(collection.id)
    item.mutate(
      { id: collection.id, titleId, inside },
      {
        onSuccess: () =>
          toast(
            t(inside ? 'collections.added' : 'collections.removed', { name: collection.name }),
            { description: titleName },
          ),
        onError: (error) => toast.error(message(error)),
        onSettled: () => setPending(null),
      },
    )
  }
  const list = collections.data ?? []
  return (
    <>
      <Dialog open={open && !creating} onOpenChange={onOpenChange}>
        <DialogContent title={t('collections.pickerTitle')} description={titleName}>
          <div data-testid="collection-picker" className="grid gap-3">
            {collections.isLoading ? (
              <div className="flex justify-center py-6 text-fg-3">
                <Spinner />
              </div>
            ) : list.length ? (
              <ul className="-mx-2 grid max-h-[50dvh] gap-0.5 overflow-y-auto">
                {list.map((collection) => {
                  const inside = Boolean(collection.contains)
                  return (
                    <li key={collection.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={inside}
                        disabled={pending === collection.id}
                        onClick={() => toggle(collection, !inside)}
                        className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left transition-colors hover:bg-hover disabled:opacity-60"
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'grid size-5 shrink-0 place-items-center rounded-md ring-1 ring-inset',
                            inside ? 'bg-fg text-panel ring-fg' : 'ring-line-strong',
                          )}
                        >
                          {inside ? <Check className="size-3.5" strokeWidth={3} /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-base font-medium">
                            {collection.name}
                          </span>
                          <span className="block text-xs text-fg-3">
                            {t('count.titles', { count: collection.count })}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="py-4 text-center text-sm text-fg-3">{t('collections.pickerEmpty')}</p>
            )}
            <div className="flex justify-between gap-2 border-t border-line pt-3">
              <Button variant="secondary" onClick={() => setCreating(true)}>
                <Plus />
                {t('collections.create')}
              </Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {t('common.done')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <CollectionFormDialog
        open={open && creating}
        onOpenChange={(value) => {
          if (!value) setCreating(false)
        }}
        onSaved={(collection) => {
          setCreating(false)
          toggle(collection, true)
        }}
      />
    </>
  )
}
