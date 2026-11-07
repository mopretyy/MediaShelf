import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { Outlet, useLocation, useNavigate, useNavigationType } from 'react-router'
import { useI18n } from '@/i18n'
import { useHotkey } from '@/lib/hooks'
import { CHORD_TIMEOUT, isHelpKey, isPlainKey, isTypingTarget, latinLetter } from '@/lib/hotkeys'
import { useSteamAutoSync } from '@/lib/steam-sync'
import { CommandPalette } from './CommandPalette'
import { ShellContext } from './shell-context'
import { ShortcutsDialog } from './ShortcutsDialog'
import { MobileTabBar, Sidebar, NAV_ITEMS } from './Sidebar'

const COLLAPSE_KEY = 'mediashelf:sidebar-collapsed'

function useScrollMemory(ref: React.RefObject<HTMLDivElement | null>) {
  const location = useLocation()
  const type = useNavigationType()
  const positions = useRef(new Map<string, number>())
  const current = useRef(location.key)
  const path = useRef(location.pathname)

  useEffect(() => {
    const element = ref.current
    const save = () => {
      const top =
        element && element.scrollHeight > element.clientHeight ? element.scrollTop : window.scrollY
      positions.current.set(current.current, top)
    }
    element?.addEventListener('scroll', save, { passive: true })
    window.addEventListener('scroll', save, { passive: true })
    return () => {
      element?.removeEventListener('scroll', save)
      window.removeEventListener('scroll', save)
    }
  }, [ref])

  useLayoutEffect(() => {
    current.current = location.key
    const samePage = path.current === location.pathname
    path.current = location.pathname
    const top = type === 'POP' ? (positions.current.get(location.key) ?? 0) : 0
    // Search-param changes on the same page (filters) keep the position; a replace that lands
    // on another page (the back arrow's way out of a shared link) starts at the top.
    if (type === 'REPLACE' && samePage) return
    ref.current?.scrollTo({ top })
    window.scrollTo({ top })
  }, [location.key, location.pathname, type, ref])
}

/**
 * Flags the scroller while it moves. Content under a resting pointer then ignores hover
 * (see `[data-scrolling]` in index.css), so cards stop flickering through hover states
 * as they slide beneath the cursor during a fast scroll.
 */
function useScrollingFlag(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const element = ref.current
    if (!element) return
    let timer = 0
    const onScroll = () => {
      element.dataset.scrolling = ''
      window.clearTimeout(timer)
      timer = window.setTimeout(() => delete element.dataset.scrolling, 140)
    }
    element.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      element.removeEventListener('scroll', onScroll)
      window.clearTimeout(timer)
    }
  }, [ref])
}

/** Appears after a long scroll and takes the page back to the top. */
function BackToTop({ scrollRef }: { scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const element = scrollRef.current
    const update = () => {
      const top =
        element && element.scrollHeight > element.clientHeight ? element.scrollTop : window.scrollY
      setVisible(top > 900)
    }
    element?.addEventListener('scroll', update, { passive: true })
    window.addEventListener('scroll', update, { passive: true })
    return () => {
      element?.removeEventListener('scroll', update)
      window.removeEventListener('scroll', update)
    }
  }, [scrollRef])
  const reduce =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const behavior = reduce ? 'auto' : 'smooth'
  return (
    <button
      type="button"
      aria-label={t('common.toTop')}
      title={t('common.toTop')}
      tabIndex={visible ? 0 : -1}
      onClick={() => {
        scrollRef.current?.scrollTo({ top: 0, behavior })
        window.scrollTo({ top: 0, behavior })
      }}
      className={`liquid-float fixed right-4 bottom-[calc(var(--tabbar-h)+1rem)] z-40 grid size-10 place-items-center rounded-full text-fg transition-[opacity,transform] duration-200 md:right-8 md:bottom-6 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
      }`}
    >
      <ArrowUp className="size-4" />
    </button>
  )
}

/** Layers whose own keys must not double as shell shortcuts (menu typeahead, select lists). */
const OWN_KEYS = '[role="menu"], [role="menubar"], [role="listbox"], [role="slider"], [role="grid"]'

/**
 * «?» opens the shortcut list, and «G, then H / D / L / R / S» goes to Home, Discover, Library,
 * Shuffle or Stats, the way Linear and GitHub do it. Letters are read from the physical key when
 * the layout is not Latin, so the chords work with ЙЦУКЕН. Quiet in text fields and menus.
 */
function useShellKeys(enabled: boolean, openShortcuts: () => void) {
  const navigate = useNavigate()
  const pending = useRef(0)
  useEffect(() => {
    if (!enabled) return
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return
      const target = event.target
      if (
        isTypingTarget(target) ||
        (target instanceof Element && target.closest(OWN_KEYS)) ||
        !isPlainKey(event)
      ) {
        pending.current = 0
        return
      }
      if (isHelpKey(event)) {
        event.preventDefault()
        pending.current = 0
        openShortcuts()
        return
      }
      const letter = latinLetter(event)
      const waiting = pending.current && Date.now() - pending.current < CHORD_TIMEOUT
      pending.current = 0
      if (waiting) {
        const item = NAV_ITEMS.find((nav) => nav.chord === letter)
        if (item) {
          event.preventDefault()
          navigate(item.to)
        }
        return
      }
      if (letter === 'g' && !event.shiftKey) pending.current = Date.now()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, navigate, openShortcuts])
}

export function AppShell() {
  const { t } = useI18n()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [palette, setPalette] = useState<{ open: boolean; mode: 'search' | 'add' }>({
    open: false,
    mode: 'search',
  })
  useScrollMemory(scrollRef)
  useScrollingFlag(scrollRef)
  useSteamAutoSync()

  const toggle = useCallback(() => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, value ? '0' : '1')
      } catch {
        /* ignore */
      }
      return !value
    })
  }, [])

  // Where focus was when the palette opened, so closing it can put the user back there.
  const opener = useRef<HTMLElement | null>(null)
  const rememberOpener = () => {
    const active = document.activeElement
    opener.current = active instanceof HTMLElement && active !== document.body ? active : null
  }
  const openPalette = useCallback((mode: 'search' | 'add' = 'search') => {
    rememberOpener()
    setPalette({ open: true, mode })
  }, [])
  // Full-screen layers (the year story) switch the shortcuts off while they are up: the palette
  // would open underneath them, invisible, and swallow every click and key.
  const [hotkeyLocks, setHotkeyLocks] = useState(0)
  const suspendHotkeys = useCallback(() => {
    setHotkeyLocks((count) => count + 1)
    let released = false
    return () => {
      if (released) return
      released = true
      setHotkeyLocks((count) => count - 1)
    }
  }, [])
  const hotkeys = hotkeyLocks === 0
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const openShortcuts = useCallback(() => setShortcutsOpen(true), [])
  useShellKeys(hotkeys, openShortcuts)
  useHotkey(
    'k',
    (event) => {
      event.preventDefault()
      // Holding the keys must not flicker the palette open and shut.
      if (event.repeat) return
      // Closing keeps the mode, so an Add palette doesn't turn into Search while it fades out.
      setPalette((state) => {
        if (state.open) return { ...state, open: false }
        rememberOpener()
        return { open: true, mode: 'search' }
      })
    },
    { mod: true, code: 'KeyK', allowInInputs: true, enabled: hotkeys },
  )
  useHotkey(
    '/',
    (event) => {
      event.preventDefault()
      openPalette('search')
    },
    { code: 'Slash', enabled: hotkeys },
  )

  const context = useMemo(
    () => ({ scrollRef, openPalette, openShortcuts, suspendHotkeys }),
    [openPalette, openShortcuts, suspendHotkeys],
  )

  return (
    <ShellContext.Provider value={context}>
      <a
        href="#main"
        // Focus only: a #main history entry would carry no router state, and the back arrow
        // would take it for the first page of the app.
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('main')?.focus()
        }}
        className="sr-only z-50 rounded-md bg-fg px-3 py-2 text-panel focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('nav.skipToContent')}
      </a>
      <div className="flex min-h-dvh">
        <Sidebar collapsed={collapsed} onToggle={toggle} />
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 outline-none md:py-2 md:pr-2">
          <div
            ref={scrollRef}
            className="relative min-h-dvh bg-panel md:h-[calc(100dvh-16px)] md:min-h-0 md:overflow-y-auto md:rounded-xl md:shadow-[0_0_0_1px_var(--line)] md:[scrollbar-gutter:stable]"
          >
            <Outlet />
          </div>
        </main>
      </div>
      <BackToTop scrollRef={scrollRef} />
      <MobileTabBar />
      <CommandPalette
        open={palette.open}
        mode={palette.mode}
        onOpenChange={(open) => setPalette((state) => ({ ...state, open }))}
        returnFocus={() => {
          const target = opener.current
          if (target?.isConnected) target.focus()
          else document.getElementById('main')?.focus()
        }}
        onShowShortcuts={openShortcuts}
      />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </ShellContext.Provider>
  )
}
