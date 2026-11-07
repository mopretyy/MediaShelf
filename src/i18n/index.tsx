import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Locale } from '@shared/types.ts'
import { LOCALES } from '@shared/types.ts'
import { en } from './en.ts'
import { ru, type DeepPartial, type Messages } from './ru.ts'

type Plural = { one: string; few: string; many: string; other: string }
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : T[K] extends Plural
      ? `${P}${K}`
      : Leaves<T[K], `${P}${K}.`>
}[keyof T & string]

export type MessageKey = Leaves<Messages>
export type Vars = Record<string, string | number>

// Russian (the source of the keys) and English (every other locale's fallback) come with the
// app; the other five load on demand, so each visitor downloads one more dictionary at most.
const dictionaries: Partial<Record<Locale, DeepPartial<Messages>>> = { ru, en }
const loaders: Partial<Record<Locale, () => Promise<DeepPartial<Messages>>>> = {
  uk: () => import('./uk.ts').then((module) => module.uk),
  de: () => import('./de.ts').then((module) => module.de),
  es: () => import('./es.ts').then((module) => module.es),
  fr: () => import('./fr.ts').then((module) => module.fr),
  ro: () => import('./ro.ts').then((module) => module.ro),
}
const STORAGE_KEY = 'mediashelf:locale'

export const isLocaleLoaded = (locale: Locale) => Boolean(dictionaries[locale])

/**
 * Fetches a locale's dictionary once. A failed fetch (offline) resolves anyway: the interface
 * then shows English, the fallback of every locale, rather than nothing.
 */
export async function loadLocale(locale: Locale): Promise<void> {
  if (dictionaries[locale]) return
  const loader = loaders[locale]
  if (!loader) return
  try {
    dictionaries[locale] = await loader()
  } catch {
    /* English fallback, see translate() */
  }
}

function lookup(messages: DeepPartial<Messages> | undefined, key: string): unknown {
  let node: unknown = messages
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object') return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return node
}

export function translate(locale: Locale, key: MessageKey | string, vars?: Vars): string {
  const fallback = locale === 'en' ? dictionaries.ru : dictionaries.en
  const raw = lookup(dictionaries[locale], key) ?? lookup(fallback, key)
  if (raw === undefined) return key
  let value: string
  if (typeof raw === 'object' && raw !== null) {
    const plural = raw as Partial<Plural>
    const count = Number(vars?.count ?? 0)
    const form = new Intl.PluralRules(locale).select(count) as keyof Plural
    value = plural[form] ?? plural.other ?? ''
  } else {
    value = raw as string
  }
  if (!vars) return value
  return value.replace(/\{(\w+)\}/g, (match, name: string) =>
    vars[name] === undefined ? match : String(vars[name]),
  )
}

export function initialLocale(): Locale {
  if (typeof document !== 'undefined') {
    const lang = document.documentElement.lang as Locale
    if ((LOCALES as readonly string[]).includes(lang)) return lang
  }
  return 'ru'
}

export interface Formatters {
  number(value: number, options?: Intl.NumberFormatOptions): string
  compact(value: number): string
  percent(value: number): string
  rating(value: number, max: 10 | 100): string
  date(value: string | number | Date, style?: 'short' | 'medium' | 'long'): string
  monthShort(value: string | Date): string
  relative(value: string | number | Date): string
  currency(minor: number, currency: string): string
  duration(minutes: number): string
  hours(hours: number): string
  list(values: string[]): string
}

const LOCALE_TAGS: Record<Locale, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  uk: 'uk-UA',
  de: 'de-DE',
  es: 'es-ES',
  fr: 'fr-FR',
  ro: 'ro-RO',
}

export function createFormatters(locale: Locale): Formatters {
  const tag = LOCALE_TAGS[locale]
  const numbers = new Intl.NumberFormat(tag)
  const compact = new Intl.NumberFormat(tag, { notation: 'compact', maximumFractionDigits: 1 })
  const relative = new Intl.RelativeTimeFormat(tag, { numeric: 'auto' })
  const lists = new Intl.ListFormat(tag, { style: 'long', type: 'conjunction' })
  const dateFormats = {
    short: new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short' }),
    medium: new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short', year: 'numeric' }),
    long: new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'long', year: 'numeric' }),
  }
  const month = new Intl.DateTimeFormat(tag, { month: 'short' })
  const toDate = (value: string | number | Date) =>
    value instanceof Date
      ? value
      : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(`${value}T12:00:00`)
        : new Date(value)
  return {
    number: (value, options) =>
      options ? new Intl.NumberFormat(tag, options).format(value) : numbers.format(value),
    compact: (value) => compact.format(value),
    percent: (value) =>
      new Intl.NumberFormat(tag, { style: 'percent', maximumFractionDigits: 0 }).format(
        value / 100,
      ),
    rating: (value, max) =>
      max === 100
        ? new Intl.NumberFormat(tag, { style: 'percent', maximumFractionDigits: 0 }).format(
            value / 100,
          )
        : new Intl.NumberFormat(tag, { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(
            value,
          ),
    date: (value, style = 'medium') => {
      const date = toDate(value)
      return Number.isNaN(date.getTime()) ? '' : dateFormats[style].format(date)
    },
    monthShort: (value) => month.format(toDate(value)).replace('.', ''),
    relative: (value) => {
      const diff = (toDate(value).getTime() - Date.now()) / 1000
      const abs = Math.abs(diff)
      if (abs < 45) return relative.format(0, 'second')
      if (abs < 3600) return relative.format(Math.round(diff / 60), 'minute')
      if (abs < 86_400) return relative.format(Math.round(diff / 3600), 'hour')
      if (abs < 86_400 * 7) return relative.format(Math.round(diff / 86_400), 'day')
      if (abs < 86_400 * 30) return relative.format(Math.round(diff / (86_400 * 7)), 'week')
      if (abs < 86_400 * 365) return relative.format(Math.round(diff / (86_400 * 30)), 'month')
      return relative.format(Math.round(diff / (86_400 * 365)), 'year')
    },
    currency: (minor, currency) => {
      try {
        return new Intl.NumberFormat(tag, {
          style: 'currency',
          currency,
          maximumFractionDigits: 2,
        }).format(minor / 100)
      } catch {
        return `${(minor / 100).toFixed(2)} ${currency}`
      }
    },
    duration: (minutes) => {
      const h = Math.floor(minutes / 60)
      const m = Math.round(minutes % 60)
      const unit = (value: number, name: 'hour' | 'minute') =>
        new Intl.NumberFormat(tag, { style: 'unit', unit: name, unitDisplay: 'short' }).format(
          value,
        )
      if (!h) return unit(m, 'minute')
      return m ? `${unit(h, 'hour')} ${unit(m, 'minute')}` : unit(h, 'hour')
    },
    hours: (hours) =>
      new Intl.NumberFormat(tag, {
        style: 'unit',
        unit: 'hour',
        unitDisplay: 'short',
        maximumFractionDigits: 1,
      }).format(hours),
    list: (values) => lists.format(values),
  }
}

interface I18nContextValue {
  locale: Locale
  setLocale(locale: Locale): void
  t(key: MessageKey, vars?: Vars): string
  fmt: Formatters
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)
  // The last language asked for: a slow dictionary must not win over a later choice.
  const wanted = useRef(locale)

  const setLocale = useCallback((next: Locale) => {
    wanted.current = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
    // The interface switches once the words are there, never to a page of keys.
    void loadLocale(next).then(() => {
      if (wanted.current === next) setLocaleState(next)
    })
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
      fmt: createFormatters(locale),
    }),
    [locale, setLocale],
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used inside I18nProvider')
  return value
}
