import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import type { TitleRecord } from '@shared/types.ts'
import { Poster } from '@/components/Poster'
import { GRID_CLASS } from '@/components/TitleCard'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { titleName } from '@/lib/titles'

function SortableCard({ title }: { title: TitleRecord }) {
  const { locale, t } = useI18n()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: title.id,
  })
  const name = titleName(title.names, locale)
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('relative min-w-0', isDragging && 'z-10 opacity-80')}
    >
      {/* The whole card is the handle: a press drags (a pointer after 6 px, a finger after a
          short hold), and the keyboard picks it up with Space, as on the status board. */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`${name}. ${t('collections.dragHandle')}`}
        className={cn(
          'block w-full cursor-grab touch-none rounded-md text-left outline-offset-4 active:cursor-grabbing',
          isDragging && 'cursor-grabbing',
        )}
      >
        <span className="relative block">
          <Poster
            src={title.poster}
            alt=""
            kind={title.kind}
            className={cn('shadow-poster', isDragging && 'ring-2 ring-fg')}
          />
          <span className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md">
            <GripVertical className="size-4" />
          </span>
        </span>
        <span className="mt-2 block truncate px-0.5 text-sm leading-[18px] font-medium">
          {name}
        </span>
      </button>
    </div>
  )
}

/**
 * The owner's way to put a collection in order: the same poster grid, every card draggable by
 * pointer, finger or keyboard. Each drop reports the whole new order.
 */
export function SortableGrid({
  titles,
  onReorder,
}: {
  titles: TitleRecord[]
  onReorder(titleIds: string[]): void
}) {
  const { t, locale } = useI18n()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const ids = titles.map((title) => title.id)
  const nameOf = (id: UniqueIdentifier) => {
    const title = titles.find((item) => item.id === id)
    return title ? titleName(title.names, locale) : ''
  }
  const place = (id: UniqueIdentifier) => ({
    position: ids.indexOf(String(id)) + 1,
    total: ids.length,
  })
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: { draggable: t('library.dragInstructions') },
        announcements: {
          onDragStart: ({ active }) => t('library.dragStart', { title: nameOf(active.id) }),
          onDragOver: ({ active, over }) =>
            over && over.id !== active.id
              ? t('collections.dragOver', { title: nameOf(active.id), ...place(over.id) })
              : undefined,
          onDragEnd: ({ active, over }) =>
            over
              ? t('collections.dragEnd', { title: nameOf(active.id), ...place(over.id) })
              : t('library.dragCancel', { title: nameOf(active.id) }),
          onDragCancel: ({ active }) => t('library.dragCancel', { title: nameOf(active.id) }),
        },
      }}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className={GRID_CLASS} data-testid="collection-sortable">
          {titles.map((title) => (
            <SortableCard key={title.id} title={title} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
