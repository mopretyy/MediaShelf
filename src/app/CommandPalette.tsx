import { Command } from 'cmdk'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CornerDownLeft,
  Keyboard,
  Languages,
  Layers,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Search,
  Sun,
} from 'lucide-react'
import { Dialog as D } from 'radix-ui'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { LOCALES, type TitleRecord } from '@shared/types.ts'
import { useLibraryActions } from '@/components/library-actions'
import { useCollections } from '@/lib/collections'
import { Poster } from '@/components/Poster'
import { StatusIcon } from '@/components/StatusIcon'
import { Button, Spinner } from '@/components/ui/button'
import { Kbd } from '@/components/ui/misc'
import { useI18n } from '@/i18n'
import {
  foldForSearch,
  LANGUAGE_NAMES,
  LANGUAGE_WORDS,
  languageOptions,
  matchLanguages,
} from '@/i18n/languages'
import { cn } from '@/lib/cn'
import { useDebounced } from '@/lib/hooks'
import { readRecent } from '@/lib/recent'
import { useLibrary, useLibraryMap, useLogout, useSearch, useUser } from '@/lib/queries'
import { titleHref, titleName, yearRange } from '@/lib/titles'
import { PalettePreview, type PreviewCommand } from './PalettePreview'
import { NAV_ITEMS } from './Sidebar'
import { usePreferenceSetters } from './UserMenu'

const itemClass = cn(
  'flex h-11 cursor-default items-center gap-3 rounded-lg px-2.5 text-base text-fg outline-none select-none',
  'data-[selected=true]:bg-hover [&_svg]:size-4 [&_svg]:shrink-0',
)

function normalise(value: string) {
  return value.toLocaleLowerCase().replaceAll('ё', 'е')
}

interface PaletteCommand {
  id: string
  label: string
  icon: ReactNode
  /** Folded words that also find the command when the query starts one of them. */
  keywords?: string[]
  /** Muted text at the end of the row. */
  detail?: ReactNode
  run(): void
}

/** The main list, or the language choice that replaces it until Escape, Backspace or «Назад». */
type Page = 'root' | 'language'

export function CommandPalette({
  open,
  mode,
  onOpenChange,
  returnFocus,
  onShowShortcuts,
}: {
  open: boolean
  mode: 'search' | 'add'
  onOpenChange(open: boolean): void
  /** Puts focus back where it was before opening (the palette has no trigger of its own). */
  returnFocus?(): void
  /** Opens the keyboard shortcut list. */
  onShowShortcuts?(): void
}) {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const user = useUser()
  const [value, setValue] = useState('')
  const [page, setPage] = useState<Page>('root')
  // The row to highlight when the main list comes back from a sub-list.
  const [returnTo, setReturnTo] = useState<string>()
  // However the palette closes (Escape, a pick, Ctrl+K again, a click outside), it reopens empty.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (!open) setValue('')
    // Back to the main list on open rather than on close, so nothing jumps while it fades out.
    else {
      setPage('root')
      setReturnTo(undefined)
    }
  }
  const root = page === 'root'
  const debounced = useDebounced(value, 220)
  const search = useSearch(open && root ? debounced : '', 'all')
  const { data: entries } = useLibrary()
  const library = useLibraryMap()
  const actions = useLibraryActions()
  const setters = usePreferenceSetters()
  const logout = useLogout()

  const close = () => onOpenChange(false)

  const query = normalise(value.trim())
  const owner = user?.id ?? null
  // Opened lately: offered first when the palette is empty, so the way back is one keystroke.
  const recent = useMemo(
    () => (open && root && mode === 'search' && !query ? readRecent(owner) : []),
    [open, root, mode, query, owner],
  )
  const libraryMatches = useMemo(() => {
    if (!entries || !root) return []
    if (!query)
      return mode === 'search'
        ? entries.filter((entry) => !recent.some((item) => item.id === entry.titleId)).slice(0, 5)
        : []
    return entries
      .filter((entry) =>
        Object.values(entry.title.names).some((name) => name && normalise(name).includes(query)),
      )
      .slice(0, 6)
  }, [entries, root, query, mode, recent])

  // Your collections by name: a way to them from anywhere, and they rank before the catalog.
  const collections = useCollections()
  // Fresh on every opening: one made in another tab or on another device shows up here too.
  const refetchCollections = collections.refetch
  useEffect(() => {
    if (open && user) void refetchCollections()
  }, [open, user, refetchCollections])
  const collectionMatches = useMemo(
    () =>
      root && mode === 'search' && query
        ? (collections.data ?? [])
            .filter((collection) => normalise(collection.name).includes(query))
            .slice(0, 4)
        : [],
    [collections.data, root, mode, query],
  )

  // Catalog rows must belong to what is typed now. During the debounce, and while the new query
  // loads with the previous results kept as placeholder data, they belong to an older query:
  // showing them would let Enter (cmdk selects the first row) add or open the wrong title.
  const searchable = root && query.length >= 2
  const fresh = normalise(debounced.trim()) === query && !search.isPlaceholderData
  const catalogItems = (searchable && fresh ? (search.data?.items ?? []) : []).filter(
    (item) => !libraryMatches.some((entry) => entry.titleId === item.id),
  )
  const loading = search.isPending || search.isFetching
  const searching = searchable && (!fresh || (loading && !catalogItems.length))
  const catalogFailed = searchable && fresh && search.isError && !catalogItems.length

  const pick = (title: TitleRecord) => {
    const saved = library.get(title.id)
    if (mode === 'add' && !saved) {
      actions.add(title, 'planned')
      close()
      return
    }
    close()
    navigate(titleHref(title.id))
  }

  const run = (fn: () => void) => () => {
    close()
    fn()
  }

  // Every language is listed in itself; its name in the current language helps with the rest.
  const languages = useMemo(() => languageOptions(locale), [locale])
  // «Язык…» also answers to the word for «language» and to any language's name, in every
  // language, so a person stuck in an interface they can't read still finds the way out.
  const languageKeywords = useMemo(
    () => [
      ...LOCALES.map((code) => foldForSearch(LANGUAGE_WORDS[code])),
      ...languages.flatMap((item) => item.words),
    ],
    [languages],
  )
  const languageMatches = matchLanguages(languages, value)

  const openLanguages = () => {
    // A language typed by name stays as the filter: «deutsch», Enter, Enter.
    if (!languageMatches.length) setValue('')
    setPage('language')
  }
  const back = () => {
    setPage('root')
    setValue('')
    setReturnTo('action-language')
  }

  const list = useRef<HTMLDivElement>(null)
  // cmdk highlights `returnTo` on the main list, but doesn't scroll to it: «Язык…» sits low.
  useLayoutEffect(() => {
    if (page !== 'root' || !returnTo) return
    list.current
      ?.querySelector(`[cmdk-item][data-value="${returnTo}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [page, returnTo])

  const commands: PaletteCommand[] = [
    ...NAV_ITEMS.map((item) => ({
      id: item.to,
      label: t(item.label),
      icon: <item.icon />,
      detail: (
        <>
          <Kbd>G</Kbd>
          <Kbd>{item.chord.toUpperCase()}</Kbd>
        </>
      ),
      run: run(() => navigate(item.to)),
    })),
  ]
  const actionItems: PaletteCommand[] = [
    {
      id: 'theme-light',
      label: t('palette.themeLight'),
      icon: <Sun />,
      run: run(() => setters.setTheme('light')),
    },
    {
      id: 'theme-dark',
      label: t('palette.themeDark'),
      icon: <Moon />,
      run: run(() => setters.setTheme('dark')),
    },
    {
      id: 'theme-system',
      label: t('palette.themeSystem'),
      icon: <Monitor />,
      run: run(() => setters.setTheme('system')),
    },
    {
      id: 'language',
      label: t('palette.language'),
      icon: <Languages />,
      keywords: languageKeywords,
      detail: (
        <>
          {LANGUAGE_NAMES[locale]}
          <ChevronRight />
        </>
      ),
      run: openLanguages,
    },
    ...(user
      ? [
          {
            id: 'new-collection',
            label: t('collections.create'),
            icon: <Layers />,
            run: run(() => navigate('/collections?new=1')),
          },
        ]
      : []),
    ...(onShowShortcuts
      ? [
          {
            id: 'shortcuts',
            label: t('shortcuts.title'),
            icon: <Keyboard />,
            detail: <Kbd>?</Kbd>,
            run: run(onShowShortcuts),
          },
        ]
      : []),
    ...(user
      ? [
          {
            id: 'logout',
            label: t('nav.signOut'),
            icon: <LogOut />,
            run: run(() => {
              navigate('/')
              logout.mutate(undefined, { onSettled: () => toast(t('auth.signedOut')) })
            }),
          },
        ]
      : []),
  ]
  const folded = foldForSearch(value.trim())
  const matches = (item: PaletteCommand) =>
    !query ||
    normalise(item.label).includes(query) ||
    Boolean(item.keywords?.some((word) => word.startsWith(folded)))
  const listLabel = root ? t('nav.search') : t('settings.language')

  // What the preview column can describe: every title row on screen, and the other rows by value.
  const shownCatalog = catalogItems.slice(0, 10)
  const previewTitles = new Map<string, TitleRecord>()
  for (const title of [...recent, ...libraryMatches.map((entry) => entry.title), ...shownCatalog])
    previewTitles.set(title.id, title)
  const previewCommands: PreviewCommand[] = root
    ? [
        ...commands.map((item) => ({ ...item, value: `nav-${item.id}` })),
        ...collectionMatches.map((collection) => ({
          value: `collection-${collection.id}`,
          label: collection.name,
          icon: <Layers />,
          detail: t('count.titles', { count: collection.count }),
        })),
        ...actionItems.map((item) => ({ ...item, value: `action-${item.id}` })),
      ]
    : languageMatches.map((item) => ({
        value: `language-${item.code}`,
        label: item.name,
        lang: item.code,
        icon: <Languages />,
        detail: item.hint,
      }))

  const row = (title: TitleRecord) => {
    const saved = library.get(title.id)
    const year = yearRange(title)
    return (
      <Command.Item
        key={title.id}
        value={title.id}
        onSelect={() => pick(title)}
        className={itemClass}
      >
        <Poster
          src={title.poster}
          alt=""
          kind={title.kind}
          sizes="sm"
          className="w-7"
          rounded="rounded-xs"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{titleName(title.names, locale)}</span>
          <span className="block truncate text-xs text-fg-3">
            {t(`kind.${title.kind}`)}
            {year ? ` · ${year}` : ''}
          </span>
        </span>
        {saved ? (
          <StatusIcon status={saved.status} className="text-fg-2" />
        ) : mode === 'add' ? (
          <Plus className="text-fg-3" />
        ) : null}
      </Command.Item>
    )
  }

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="anim-fade fixed inset-0 z-50 bg-scrim" />
        <D.Content
          className="anim-pop fixed top-[10vh] left-1/2 z-50 w-[calc(100vw-24px)] max-w-[640px] -translate-x-1/2 overflow-hidden rounded-xl liquid-float outline-none max-sm:top-3 md:max-w-[880px]"
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            if (!returnFocus) return
            event.preventDefault()
            returnFocus()
          }}
          onEscapeKeyDown={(event) => {
            // In the language list Escape steps back; only the main list closes on it.
            if (root) return
            event.preventDefault()
            back()
          }}
        >
          <D.Title className="sr-only">{t('nav.search')}</D.Title>
          {/* No vim bindings: Ctrl+K closes the palette, and cmdk would first move the selection
              with it (up, wrapping to the last row), so a quick reopen could land on «Выйти».
              Keyed by page: cmdk only takes the row to start on when it mounts, so the language
              list opens on the current language and the way back lands on «Язык…». */}
          <Command
            key={page}
            defaultValue={root ? returnTo : `language-${locale}`}
            shouldFilter={false}
            loop
            vimBindings={false}
            label={listLabel}
            onKeyDown={(event) => {
              // Backspace in the empty field steps back too; holding it only clears the text.
              if (root || value || event.key !== 'Backspace' || event.repeat) return
              event.preventDefault()
              back()
            }}
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              {root ? (
                <Search className="size-4 shrink-0 text-fg-3" />
              ) : (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t('common.back')}
                  onClick={back}
                  // Enter presses the button; cmdk would cancel that and pick a language instead.
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.stopPropagation()
                  }}
                  // Sits where the search icon was; a finger gets an invisible 44 px target.
                  className="-mx-1.5 pointer-coarse:before:absolute pointer-coarse:before:-inset-2 pointer-coarse:before:content-['']"
                >
                  <ChevronLeft />
                </Button>
              )}
              <Command.Input
                autoFocus
                value={value}
                onValueChange={setValue}
                placeholder={
                  !root
                    ? t('palette.languagePlaceholder')
                    : mode === 'add'
                      ? t('palette.addPlaceholder')
                      : t('palette.placeholder')
                }
                className="h-14 min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-fg-3"
              />
              {searchable && (searching || search.isFetching) ? (
                <Spinner className="text-fg-3" />
              ) : (
                <Kbd>Esc</Kbd>
              )}
            </div>
            <div className="md:grid md:grid-cols-[minmax(0,1fr)_300px]">
              <Command.List
                ref={list}
                // cmdk would name the listbox «Suggestions», in English.
                label={listLabel}
                className="max-h-[min(60vh,480px)] overflow-y-auto overscroll-contain p-2 md:h-[min(60vh,480px)] [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-3"
              >
                {!root ? (
                  languageMatches.length ? (
                    <Command.Group heading={t('settings.language')}>
                      {languageMatches.map((item) => (
                        <Command.Item
                          key={item.code}
                          value={`language-${item.code}`}
                          // aria-selected follows the keyboard; aria-checked marks the one in use.
                          aria-checked={item.code === locale}
                          onSelect={run(() => setters.setLocale(item.code))}
                          className={cn(itemClass, 'h-9')}
                        >
                          <span lang={item.code}>{item.name}</span>
                          {item.hint ? (
                            <span className="min-w-0 truncate text-sm text-fg-3">{item.hint}</span>
                          ) : null}
                          {item.code === locale ? <Check className="ml-auto" /> : null}
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ) : (
                    <p className="px-2.5 py-6 text-center text-sm text-fg-3">
                      {t('palette.empty')}
                    </p>
                  )
                ) : null}
                {recent.length ? (
                  <Command.Group heading={t('palette.recent')}>{recent.map(row)}</Command.Group>
                ) : null}
                {libraryMatches.length ? (
                  <Command.Group heading={t('palette.library')}>
                    {libraryMatches.map((entry) => row(entry.title))}
                  </Command.Group>
                ) : null}
                {collectionMatches.length ? (
                  <Command.Group heading={t('collections.title')}>
                    {collectionMatches.map((collection) => (
                      <Command.Item
                        key={collection.id}
                        value={`collection-${collection.id}`}
                        onSelect={run(() => navigate(`/collections/${collection.id}`))}
                        className={itemClass}
                      >
                        <span className="text-fg-2">
                          <Layers />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{collection.name}</span>
                        <span className="shrink-0 text-sm text-fg-3">
                          {t('count.titles', { count: collection.count })}
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                ) : null}
                {catalogItems.length ? (
                  <Command.Group heading={t('palette.catalog')}>
                    {shownCatalog.map(row)}
                  </Command.Group>
                ) : null}
                {searching ? (
                  <div className="flex h-11 items-center gap-3 px-2.5 text-sm text-fg-3">
                    <Spinner />
                    {t('palette.searching')}
                  </div>
                ) : null}
                {mode === 'add' && query.length < 2 ? (
                  <p className="px-2.5 py-6 text-center text-sm text-fg-3">
                    {t('palette.typeToSearch')}
                  </p>
                ) : null}
                {mode === 'search' && root ? (
                  <>
                    {commands.some((item) => matches(item)) ? (
                      <Command.Group heading={t('palette.navigation')}>
                        {commands
                          .filter((item) => matches(item))
                          .map((item) => (
                            <Command.Item
                              key={item.id}
                              value={`nav-${item.id}`}
                              onSelect={item.run}
                              className={cn(itemClass, 'h-9')}
                            >
                              <span className="text-fg-2">{item.icon}</span>
                              {item.label}
                              {item.detail ? (
                                <span className="ml-auto flex items-center gap-1 pl-2 max-md:hidden">
                                  {item.detail}
                                </span>
                              ) : null}
                            </Command.Item>
                          ))}
                      </Command.Group>
                    ) : null}
                    {actionItems.some((item) => matches(item)) ? (
                      <Command.Group heading={t('palette.actions')}>
                        {actionItems
                          .filter((item) => matches(item))
                          .map((item) => (
                            <Command.Item
                              key={item.id}
                              value={`action-${item.id}`}
                              onSelect={item.run}
                              className={cn(itemClass, 'h-9')}
                            >
                              <span className="text-fg-2">{item.icon}</span>
                              {item.label}
                              {item.detail ? (
                                <span className="ml-auto flex min-w-0 items-center gap-1 pl-2 text-sm text-fg-3 [&_svg]:-mr-1">
                                  {item.detail}
                                </span>
                              ) : null}
                            </Command.Item>
                          ))}
                      </Command.Group>
                    ) : null}
                  </>
                ) : null}
                {searchable &&
                !searching &&
                !catalogItems.length &&
                !libraryMatches.length &&
                !collectionMatches.length &&
                !(
                  mode === 'search' && [...commands, ...actionItems].some((item) => matches(item))
                ) ? (
                  <p className="px-2.5 py-6 text-center text-sm text-fg-3">
                    {catalogFailed ? t('discover.unavailable') : t('palette.empty')}
                  </p>
                ) : null}
              </Command.List>
              <PalettePreview titles={previewTitles} commands={previewCommands} library={library} />
            </div>
            <div className="flex items-center gap-4 border-t border-line px-4 py-2.5 text-xs text-fg-3 max-sm:hidden">
              <span className="flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                {t('palette.hintNavigate')}
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>
                  <CornerDownLeft className="size-3" />
                </Kbd>
                {mode === 'add'
                  ? t('common.add')
                  : root
                    ? t('palette.hintOpen')
                    : t('palette.hintApply')}
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>Esc</Kbd>
                {root ? t('palette.hintClose') : t('palette.hintBack')}
              </span>
            </div>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
