import { useEffect, useMemo, useRef, useState } from 'react'
import type { TitleRecord } from '@shared/types.ts'
import { Shelf, TitleCard, TitleCardSkeleton } from '@/components/TitleCard'
import { SectionHeader } from '@/components/ui/misc'
import { useI18n } from '@/i18n'
import { useCatalogPool } from '@/lib/catalog-pool'
import { similarTitles } from '@/lib/similar'

/** Becomes true once the element comes within `margin` of the viewport, and stays true. */
function useNear<T extends Element>(margin = '400px') {
  const ref = useRef<T>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!element || near) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setNear(true)
      },
      { rootMargin: margin },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [near, margin])
  return [ref, near] as const
}

/**
 * «Похожее»: titles of the same kind sharing the genres of this one, from what is popular and the
 * best of all time. The charts load only once the shelf is about to come into view.
 */
export function SimilarSection({ title }: { title: TitleRecord }) {
  const { t } = useI18n()
  const [ref, near] = useNear<HTMLDivElement>()
  const { pool, loading } = useCatalogPool(near)
  const similar = useMemo(() => similarTitles(title, pool), [title, pool])
  const waiting = !near || loading
  return (
    <div ref={ref}>
      {waiting || similar.length >= 3 ? (
        <section className="mt-12" aria-labelledby="similar-heading" data-testid="similar">
          <SectionHeader id="similar-heading" title={t('title.similar')} />
          <Shelf label={t('title.similar')}>
            {waiting
              ? Array.from({ length: 6 }, (_, index) => <TitleCardSkeleton key={index} />)
              : similar.map((item) => <TitleCard key={item.id} title={item} />)}
          </Shelf>
        </section>
      ) : null}
    </div>
  )
}
