import {
  BarChart3,
  CalendarDays,
  Compass,
  Dices,
  House,
  Layers,
  LibraryBig,
  PanelLeft,
  Plus,
  Search,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { Poster } from '@/components/Poster'
import { StatusIcon } from '@/components/StatusIcon'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/misc'
import { Tooltip } from '@/components/ui/tooltip'
import { useI18n, type MessageKey } from '@/i18n'
import { useFreshCount } from '@/lib/airing'
import { cn } from '@/lib/cn'
import { isMac } from '@/lib/hooks'
import { useLibrary, useUser } from '@/lib/queries'
import { entryProgressText, statusLabelKey, titleHref, titleName } from '@/lib/titles'
import { BrandMark } from './Brand'
import { useShell } from './shell-context'
import { UserMenu } from './UserMenu'

export const NAV_ITEMS: {
  to: string
  label: MessageKey
  icon: ComponentType<{ className?: string }>
  end?: boolean
  /** The second key of its «G, then …» chord (the Latin letter on the key). */
  chord: string
  /** Left out of the phone tab bar, which has room for five. */
  desktopOnly?: boolean
}[] = [
  { to: '/', label: 'nav.home', icon: House, end: true, chord: 'h' },
  { to: '/discover', label: 'nav.discover', icon: Compass, chord: 'd' },
  { to: '/library', label: 'nav.library', icon: LibraryBig, chord: 'l' },
  { to: '/collections', label: 'nav.collections', icon: Layers, chord: 'p', desktopOnly: true },
  { to: '/calendar', label: 'nav.calendar', icon: CalendarDays, chord: 'c', desktopOnly: true },
  { to: '/shuffle', label: 'nav.shuffle', icon: Dices, chord: 'r' },
  { to: '/stats', label: 'nav.stats', icon: BarChart3, chord: 's' },
]

function RecentEntries() {
  const { t, locale } = useI18n()
  const { data } = useLibrary()
  const location = useLocation()
  if (!data?.length) return null
  const active = data.filter((entry) => entry.status === 'in_progress')
  const items = (active.length ? active : data).slice(0, 6)
  return (
    <div className="mt-6">
      <p className="mb-1.5 px-2.5 text-xs font-medium text-fg-3">{t('nav.continue')}</p>
      {/* minmax(0, 1fr): long titles must truncate instead of widening the column. */}
      <ul className="grid grid-cols-1 gap-0.5">
        {items.map((entry) => {
          const href = titleHref(entry.titleId)
          const current = location.pathname === href
          const progress = entryProgressText(entry, t)
          return (
            <li key={entry.titleId}>
              <Link
                to={href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-hover',
                  current && 'bg-active',
                )}
              >
                <Poster
                  src={entry.title.poster}
                  alt=""
                  kind={entry.kind}
                  sizes="sm"
                  className="w-7 shrink-0"
                  rounded="rounded-xs"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-fg">
                    {titleName(entry.title.names, locale)}
                  </span>
                  <span className="flex items-center gap-1 truncate text-xs text-fg-3">
                    <StatusIcon status={entry.status} className="size-3" />
                    <span className="truncate">
                      {progress ?? t(statusLabelKey(entry.kind, entry.status))}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle(): void }) {
  const { t } = useI18n()
  const { openPalette } = useShell()
  const user = useUser()
  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col py-3 transition-[width] duration-300 ease-out md:flex',
        collapsed ? 'w-16 items-center px-2' : 'w-[248px] px-3',
      )}
      aria-label={t('nav.menu')}
    >
      <div
        className={cn(
          'flex h-9 items-center',
          collapsed ? 'justify-center' : 'justify-between pl-1.5',
        )}
      >
        {!collapsed ? (
          <Link to="/" className="flex items-center gap-2.5 rounded-md">
            <BrandMark />
            <span className="text-md font-semibold tracking-[-0.01em]">MediaShell</span>
          </Link>
        ) : null}
        <Tooltip content={collapsed ? t('nav.expand') : t('nav.collapse')} side="right">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggle}
            aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
          >
            <PanelLeft />
          </Button>
        </Tooltip>
      </div>

      <div className={cn('mt-4 grid gap-2', collapsed && 'justify-items-center')}>
        {collapsed ? (
          <>
            <Tooltip content={t('nav.search')} side="right">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openPalette('search')}
                aria-label={t('nav.search')}
              >
                <Search />
              </Button>
            </Tooltip>
            <Tooltip content={t('nav.add')} side="right">
              <Button
                variant="primary"
                size="icon"
                onClick={() => openPalette('add')}
                aria-label={t('nav.add')}
              >
                <Plus />
              </Button>
            </Tooltip>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => openPalette('search')}
              className="flex h-9 w-full items-center gap-2 rounded-lg bg-raised px-2.5 text-base text-fg-3 ring-1 ring-line ring-inset transition-colors hover:text-fg-2 hover:ring-line-strong"
            >
              <Search className="size-4" />
              <span className="flex-1 text-left">{t('nav.search')}</span>
              <Kbd>{isMac ? '⌘K' : 'Ctrl K'}</Kbd>
            </button>
            <Button
              variant="primary"
              className="w-full justify-start"
              onClick={() => openPalette('add')}
            >
              <Plus />
              {t('nav.add')}
            </Button>
          </>
        )}
      </div>

      <nav className={cn('mt-5 grid gap-0.5', collapsed && 'justify-items-center')}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const link = (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              aria-label={collapsed ? t(item.label) : undefined}
              className={({ isActive }) =>
                cn(
                  'flex h-9 items-center gap-2.5 rounded-lg text-base transition-colors',
                  collapsed ? 'size-10 justify-center' : 'px-2.5',
                  isActive
                    ? 'bg-active font-medium text-fg'
                    : 'text-fg-2 hover:bg-hover hover:text-fg',
                )
              }
            >
              {collapsed && item.to === '/' ? (
                <span className="relative">
                  <Icon className="size-[18px]" />
                  <FreshBadge variant="dot" />
                </span>
              ) : (
                <Icon className="size-[18px]" />
              )}
              {!collapsed ? t(item.label) : null}
              {!collapsed && item.to === '/' ? <FreshBadge variant="pill" /> : null}
            </NavLink>
          )
          return collapsed ? (
            <Tooltip key={item.to} content={t(item.label)} side="right">
              {link}
            </Tooltip>
          ) : (
            link
          )
        })}
      </nav>

      <div className={cn('min-h-0 flex-1 overflow-y-auto', collapsed && 'hidden')}>
        {user ? <RecentEntries /> : null}
      </div>

      <div
        className={cn(
          'mt-3 border-t border-line pt-3',
          collapsed ? 'w-full flex justify-center' : 'w-full',
        )}
      >
        <UserMenu collapsed={collapsed} />
      </div>
    </aside>
  )
}

/** Count of new episodes on "Home": a quiet pill, a dot when there is no room for digits. */
function FreshBadge({ variant }: { variant: 'pill' | 'dot' }) {
  const { t } = useI18n()
  const count = useFreshCount()
  if (!count) return null
  const label = <span className="sr-only">{`, ${t('airing.badge', { count })}`}</span>
  if (variant === 'dot')
    return (
      <>
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-1 size-2 rounded-full bg-fg ring-2 ring-[var(--bg)]"
        />
        {label}
      </>
    )
  return (
    <>
      <span
        aria-hidden="true"
        className="ml-auto min-w-5 rounded-full bg-fg px-1.5 text-center text-2xs leading-5 font-semibold text-[var(--bg)] tabular-nums"
      >
        {count > 9 ? '9+' : count}
      </span>
      {label}
    </>
  )
}

export function MobileTabBar() {
  const { t } = useI18n()
  return (
    <nav
      aria-label={t('nav.menu')}
      className="glass glass-dense glass-edge fixed inset-x-0 bottom-0 z-40 border-t border-line pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto grid h-14 max-w-lg grid-cols-5">
        {NAV_ITEMS.filter((item) => !item.desktopOnly).map((item) => {
          const Icon = item.icon
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex h-full flex-col items-center justify-center gap-1 text-2xs font-medium transition-colors',
                    isActive ? 'text-fg' : 'text-fg-3',
                  )
                }
              >
                <span className="relative">
                  <Icon className="size-[22px]" />
                  {item.to === '/' ? <FreshBadge variant="dot" /> : null}
                </span>
                {/* No side padding: at 320 px the 11 px «Библиотека» needs the whole 64 px column. */}
                <span className="max-w-full truncate">{t(item.label)}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
