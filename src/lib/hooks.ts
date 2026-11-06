import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { isTypingTarget, matchesHotkey } from './hotkeys'

export function useDebounced<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setMatches(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [query])
  return matches
}

export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · MediaShell` : 'MediaShell'
  }, [title])
}

/**
 * Global shortcut. `key` is compared case-insensitively; `mod` means Ctrl or ⌘. `code` names the
 * physical key as a fallback, so the shortcut survives a non-Latin layout (see `matchesHotkey`).
 */
export function useHotkey(
  key: string,
  handler: (event: KeyboardEvent) => void,
  options: { mod?: boolean; code?: string; allowInInputs?: boolean; enabled?: boolean } = {},
) {
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })
  const { mod = false, code, allowInInputs = false, enabled = true } = options
  useEffect(() => {
    if (!enabled) return
    const onKey = (event: KeyboardEvent) => {
      if (!matchesHotkey(event, { key, code, mod })) return
      if (!allowInInputs && isTypingTarget(event.target)) return
      ref.current(event)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [key, code, mod, allowInInputs, enabled])
}

const NO_RESETS: readonly string[] = []

/**
 * A search field bound to a URL search param. The field keeps its own text: router updates land
 * in a transition, so an input fed back from the URL lags the DOM, drops keystrokes and throws
 * the caret to the end. `query` is the trimmed text once typing pauses for `delay` ms; filter on
 * it. It goes to the URL with replace, so typing adds no history entries, and clears the
 * `resets` params (filters that only made sense for the previous query; pass a constant).
 * Back/Forward, links and other controls that change the param update the field at once.
 */
export function useSearchParamText(param: string, delay: number, resets = NO_RESETS) {
  const [params, setParams] = useSearchParams()
  const fromUrl = params.get(param) ?? ''
  const [text, setText] = useState(fromUrl)
  const [query, setQuery] = useState(() => fromUrl.trim())

  // Our own writes come back equal to `query`; anything else came from outside.
  const [seen, setSeen] = useState(fromUrl)
  if (fromUrl !== seen) {
    setSeen(fromUrl)
    if (fromUrl.trim() !== query) {
      setText(fromUrl)
      setQuery(fromUrl.trim())
    }
  }

  useEffect(() => {
    const next = text.trim()
    if (next === query) return
    const timer = setTimeout(() => setQuery(next), delay)
    return () => clearTimeout(timer)
  }, [text, query, delay])

  useEffect(() => {
    if (query === fromUrl.trim()) return
    const next = new URLSearchParams(params)
    if (query) next.set(param, query)
    else next.delete(param)
    for (const key of resets) next.delete(key)
    setParams(next, { replace: true })
  }, [query, fromUrl, params, setParams, param, resets])

  /** Empties the field and applies that at once, without waiting for the pause. */
  const clear = useCallback(() => {
    setText('')
    setQuery('')
  }, [])

  return { text, setText, query, clear }
}

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
