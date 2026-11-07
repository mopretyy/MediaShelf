import { createContext, useContext, useEffect, useState, type RefObject } from 'react'

interface ShellContextValue {
  scrollRef: RefObject<HTMLDivElement | null>
  openPalette(mode?: 'search' | 'add'): void
  /** Opens the list of keyboard shortcuts («?»). */
  openShortcuts(): void
  /** Turns the shell's keyboard shortcuts off until the returned function is called. */
  suspendHotkeys(): () => void
}

export const ShellContext = createContext<ShellContextValue | null>(null)

export function useShell() {
  const value = useContext(ShellContext)
  if (!value) throw new Error('useShell must be used inside the app shell')
  return value
}

/**
 * For full-screen layers drawn over the shell (the year story): while one is mounted, Ctrl+K and
 * '/' can't open the command palette underneath it.
 */
export function useSuspendShellHotkeys() {
  const { suspendHotkeys } = useShell()
  useEffect(() => suspendHotkeys(), [suspendHotkeys])
}

/** True once the content panel (desktop) or the window (mobile) has scrolled. */
export function useScrolled(threshold = 4) {
  const { scrollRef } = useShell()
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const element = scrollRef.current
    const read = () => {
      const panelScroll =
        element && element.scrollHeight > element.clientHeight ? element.scrollTop : 0
      setScrolled(Math.max(panelScroll, window.scrollY) > threshold)
    }
    read()
    element?.addEventListener('scroll', read, { passive: true })
    window.addEventListener('scroll', read, { passive: true })
    return () => {
      element?.removeEventListener('scroll', read)
      window.removeEventListener('scroll', read)
    }
  }, [scrollRef, threshold])
  return scrolled
}
