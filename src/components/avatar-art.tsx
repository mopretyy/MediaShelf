import { useMemo } from 'react'
import { cn } from '@/lib/cn'
import { avatarDataUri } from './avatar-gen'

/** A generated cartoon face filling its box. Vector, so one picture serves every size. */
export function GeneratedAvatar({ seed, className }: { seed: string; className?: string }) {
  const src = useMemo(() => avatarDataUri(seed), [seed])
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      decoding="async"
      className={cn('block size-full object-cover', className)}
    />
  )
}
