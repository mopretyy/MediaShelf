import { Download, ImageDown, Share2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { LibraryEntry } from '@shared/types.ts'
import { genreLabel } from '@shared/genres.ts'
import { Button, Spinner } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useI18n } from '@/i18n'
import { titleName } from '@/lib/titles'
import { renderShareCard, CARD_HEIGHT, CARD_WIDTH, type ShareCardData } from './share-card'
import { yearPosters, type YearStory } from './story'

function useCardData(story: YearStory, entries: LibraryEntry[], name: string): ShareCardData {
  const { t, locale, fmt } = useI18n()
  return useMemo(() => {
    const monthName = (month: string) => {
      const value = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(
        new Date(`${month}-01T00:00:00Z`),
      )
      return value.charAt(0).toLocaleUpperCase(locale) + value.slice(1)
    }
    const facts: ShareCardData['facts'] = []
    if (story.bestMonth)
      facts.push({ label: t('year.bestMonthLabel'), value: monthName(story.bestMonth.month) })
    if (story.averageRating !== null)
      facts.push({
        label: t('profile.avgRating'),
        value: `${fmt.number(story.averageRating, { maximumFractionDigits: 1 })}/10`,
      })
    if (story.genres[0])
      facts.push({ label: t('year.genresLabel'), value: genreLabel(story.genres[0].genre, locale) })
    facts.push({ label: t('year.addedLabel'), value: fmt.number(story.added) })
    const kinds = (
      Object.entries(story.completedByKind) as [keyof typeof story.completedByKind, number][]
    )
      .filter(([, count]) => count > 0)
      .map(([kind, count]) => `${t(`kinds.${kind}`)} ${fmt.number(count)}`)
      .join(' · ')
    const best = story.top[0]
    return {
      year: story.year,
      kicker: name ? `${t('year.introKicker')} · ${name}` : t('year.introKicker'),
      headline: t('year.cardHeadline', { count: story.completed }),
      posters: yearPosters(story.year, entries).map((entry) => entry.title.poster!),
      first: best
        ? {
            label: t('year.cardFirst', { rating: best.rating ?? '' }),
            name: titleName(best.title.names, locale),
          }
        : null,
      facts,
      kinds,
      footer: t('app.name'),
    }
  }, [story, entries, name, t, locale, fmt])
}

/**
 * «Картинка для соцсетей»: the year drawn as a 1080 × 1920 PNG (a phone story) with the best
 * posters fanned out, the year, what was finished and a few facts. Previewed in a dialog, then
 * downloaded or handed to the system share sheet where the browser can share files.
 */
export function ShareImageButton({
  story,
  entries,
  name,
  className,
}: {
  story: YearStory
  entries: LibraryEntry[]
  name: string
  className?: string
}) {
  const { t } = useI18n()
  const data = useCardData(story, entries, name)
  const [open, setOpen] = useState(false)
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null)
  const [failed, setFailed] = useState(false)
  const fileName = `mediashell-${story.year}.png`

  useEffect(() => {
    if (!open) return
    let cancelled = false
    let url: string | null = null
    setFailed(false)
    renderShareCard(data)
      .then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setImage({ blob, url })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
      setImage(null)
    }
  }, [open, data])

  const file = image ? new File([image.blob], fileName, { type: 'image/png' }) : null
  const canShare = Boolean(file && navigator.canShare?.({ files: [file] }))

  const share = async () => {
    if (!file) return
    try {
      await navigator.share({ files: [file], title: t('year.title', { year: story.year }) })
    } catch (error) {
      if ((error as Error).name !== 'AbortError') toast.error(t('errors.generic'))
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        className={className}
        onClick={(event) => {
          event.stopPropagation()
          setOpen(true)
        }}
      >
        <ImageDown />
        {t('year.shareImage')}
      </Button>
      {/* React passes clicks from the dialog's portal up to the story, whose taps turn the
          slides: stop them here, or a click in the dialog's left third would go back a slide. */}
      <span className="contents" onClick={(event) => event.stopPropagation()}>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent
            overLayer
            title={t('year.shareImageTitle', { year: story.year })}
            description={t('year.shareImageText')}
          >
            <div
              data-testid="year-card"
              className="mx-auto grid aspect-[9/16] max-h-[56dvh] place-items-center overflow-hidden rounded-xl bg-black ring-1 ring-line ring-inset"
            >
              {image ? (
                <img
                  src={image.url}
                  width={CARD_WIDTH}
                  height={CARD_HEIGHT}
                  alt={t('year.shareImageTitle', { year: story.year })}
                  className="size-full object-contain"
                />
              ) : failed ? (
                <p className="px-6 text-center text-sm text-white/70">{t('year.shareFailed')}</p>
              ) : (
                <span className="flex items-center gap-2 text-sm text-white/70">
                  <Spinner />
                  {t('year.shareMaking')}
                </span>
              )}
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {canShare ? (
                <Button variant="secondary" onClick={() => void share()}>
                  <Share2 />
                  {t('year.shareSend')}
                </Button>
              ) : null}
              <Button asChild variant="primary" disabled={!image}>
                <a href={image?.url} download={fileName} aria-disabled={!image}>
                  <Download />
                  {t('year.shareDownload')}
                </a>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </span>
    </>
  )
}
