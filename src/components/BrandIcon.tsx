import { Clapperboard, Gamepad2, Store, Tv } from 'lucide-react'
import {
  siAnilist,
  siEpicgames,
  siGogdotcom,
  siImdb,
  siMetacritic,
  siPlaystation,
  siShikimori,
  siSteam,
  siStremio,
  siWikidata,
  siWikipedia,
} from 'simple-icons'
import type { SourceId, StoreId } from '@shared/types.ts'
import { cn } from '@/lib/cn'

const ICONS: Partial<Record<SourceId | StoreId | 'metacritic', { path: string }>> = {
  steam: siSteam,
  gog: siGogdotcom,
  epic: siEpicgames,
  playstation: siPlaystation,
  imdb: siImdb,
  anilist: siAnilist,
  shikimori: siShikimori,
  wikipedia: siWikipedia,
  wikidata: siWikidata,
  metacritic: siMetacritic,
  cinemeta: siStremio,
}

const FALLBACK = { xbox: Gamepad2, nintendo: Gamepad2, tvmaze: Tv, cinemeta: Clapperboard } as const

/**
 * Monochrome brand mark for stores and data sources. Next to a visible name it is decoration;
 * with a `label` it stands in for the name (an image with a tooltip).
 */
export function BrandIcon({
  id,
  className,
  label,
}: {
  id: SourceId | StoreId | 'metacritic'
  className?: string
  label?: string
}) {
  const icon = ICONS[id]
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }
  const tooltip = label ? <title>{label}</title> : null
  if (icon)
    return (
      <svg viewBox="0 0 24 24" className={cn('size-4 shrink-0 fill-current', className)} {...a11y}>
        {tooltip}
        <path d={icon.path} />
      </svg>
    )
  const Fallback = FALLBACK[id as keyof typeof FALLBACK] ?? Store
  return (
    <Fallback className={cn('size-4 shrink-0', className)} {...a11y}>
      {tooltip}
    </Fallback>
  )
}
