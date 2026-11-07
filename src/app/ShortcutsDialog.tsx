import { CornerDownLeft } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/misc'
import { useI18n } from '@/i18n'
import { isMac } from '@/lib/hooks'
import { NAV_ITEMS } from './Sidebar'

interface Row {
  label: ReactNode
  /** Keys pressed together, or, with `then`, one after another. */
  keys: ReactNode[]
  then?: boolean
}

function Keys({ keys, then }: Pick<Row, 'keys' | 'then'>) {
  const { t } = useI18n()
  return (
    <span className="flex shrink-0 items-center gap-1 text-xs text-fg-3">
      {keys.map((key, index) => (
        <Fragment key={index}>
          {then && index ? <span className="px-0.5">{t('shortcuts.then')}</span> : null}
          <Kbd className="h-6 min-w-6 px-1.5 text-xs text-fg-2">{key}</Kbd>
        </Fragment>
      ))}
    </span>
  )
}

function Group({ title, rows }: { title: ReactNode; rows: Row[] }) {
  return (
    <section className="min-w-0">
      <h3 className="mb-1.5 text-xs font-medium text-fg-3">{title}</h3>
      <ul className="divide-y divide-line-subtle">
        {rows.map((row, index) => (
          <li key={index} className="flex min-h-10 items-center justify-between gap-4 py-1.5">
            <span className="min-w-0 text-base text-fg">{row.label}</span>
            <Keys keys={row.keys} then={row.then} />
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Every shortcut in one place, opened with «?», from the command palette or the account menu.
 * Lists only what really works; letters are the Latin ones printed on the keys, so the chords
 * work with ЙЦУКЕН too (see `latinLetter`).
 */
export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange(open: boolean): void
}) {
  const { t } = useI18n()
  const mod = isMac ? '⌘' : 'Ctrl'
  const space = t('shortcuts.space')
  const general: Row[] = [
    { label: t('shortcuts.search'), keys: [mod, 'K'] },
    { label: t('shortcuts.quickSearch'), keys: ['/'] },
    { label: t('shortcuts.help'), keys: ['?'] },
    { label: t('shortcuts.close'), keys: ['Esc'] },
  ]
  const goTo: Row[] = NAV_ITEMS.map((item) => ({
    label: t(item.label),
    keys: ['G', item.chord.toUpperCase()],
    then: true,
  }))
  const inSearch: Row[] = [
    { label: t('shortcuts.move'), keys: ['↑', '↓'] },
    { label: t('shortcuts.run'), keys: [<CornerDownLeft key="enter" className="size-3.5" />] },
  ]
  const pages: { title: string; rows: Row[] }[] = [
    { title: t('nav.shuffle'), rows: [{ label: t('shortcuts.roll'), keys: [space] }] },
    { title: t('shortcuts.yearStory'), rows: [{ label: t('shortcuts.flip'), keys: ['←', '→'] }] },
    {
      title: t('shortcuts.board'),
      rows: [
        { label: t('shortcuts.pickUp'), keys: [space] },
        { label: t('shortcuts.drag'), keys: ['←', '↑', '↓', '→'] },
      ],
    },
  ]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={t('shortcuts.title')}
        description={t('shortcuts.description')}
        size="lg"
      >
        <div data-testid="shortcuts" className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
          <div className="grid content-start gap-6">
            <Group title={t('shortcuts.general')} rows={general} />
            <Group title={t('shortcuts.goTo')} rows={goTo} />
          </div>
          <div className="grid content-start gap-6">
            <Group title={t('shortcuts.inSearch')} rows={inSearch} />
            {pages.map((page) => (
              <Group key={page.title} title={page.title} rows={page.rows} />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
