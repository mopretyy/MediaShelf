import { Compass, House } from 'lucide-react'
import { Link } from 'react-router'
import { PageBody, PageHeader } from '@/app/PageHeader'
import { PosterFan } from '@/components/PosterFan'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { useDocumentTitle } from '@/lib/hooks'

/**
 * A wrong address: a hollow «404» like the Discover top-10 numerals, a fan of what is popular
 * behind it (an invitation rather than a dead end) and the two ways on: Home and Discover.
 */
export default function NotFoundPage() {
  const { t } = useI18n()
  useDocumentTitle(t('errors.notFoundTitle'))
  return (
    <>
      <PageHeader title={t('errors.notFoundTitle')} revealTitle />
      <PageBody>
        <section className="flex flex-col items-center px-4 py-16 text-center sm:py-24">
          <div className="relative">
            <PosterFan />
            <p
              aria-hidden="true"
              className="-mt-14 text-[120px] leading-none font-bold tracking-[-0.06em] text-transparent tabular-nums select-none [-webkit-text-stroke:2px_var(--fg-3)] sm:text-[160px]"
            >
              404
            </p>
          </div>
          <h1 className="display mt-4 text-3xl sm:text-4xl">{t('errors.notFoundTitle')}</h1>
          <p className="mt-2 max-w-sm text-base text-fg-2">{t('errors.notFoundText')}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button asChild variant="primary">
              <Link to="/">
                <House />
                {t('errors.goHome')}
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/discover">
                <Compass />
                {t('nav.discover')}
              </Link>
            </Button>
          </div>
        </section>
      </PageBody>
    </>
  )
}
