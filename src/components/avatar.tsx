import type { User } from '@shared/types.ts'
import { cn } from '@/lib/cn'
import { customAvatar } from '@/lib/device'
import { GeneratedAvatar } from './avatar-art'

/** An uploaded picture lives on this device; 'custom' without one falls back to a face. */
export const CUSTOM_AVATAR_ID = 'custom'

type AvatarSource = Pick<User, 'id' | 'preferences'>

/**
 * 'custom' when this device has the upload, otherwise the seed of the generated face: the
 * stored word (ids from the older sets are seeds too) or, when there is none, the user id.
 */
export function avatarFor(user: AvatarSource): string {
  const chosen = user.preferences.avatar
  if (chosen === CUSTOM_AVATAR_ID) return customAvatar(user.id) ? CUSTOM_AVATAR_ID : user.id
  return chosen || user.id
}

/** The picture itself (a generated face or the uploaded image), filling its box. */
export function AvatarArt({
  id,
  userId,
  className,
}: {
  id: string
  userId?: string
  className?: string
}) {
  if (id === CUSTOM_AVATAR_ID && userId) {
    const src = customAvatar(userId)
    if (src)
      return (
        <img
          src={src}
          alt=""
          draggable={false}
          className={cn('block size-full object-cover', className)}
        />
      )
  }
  return (
    <GeneratedAvatar seed={id === CUSTOM_AVATAR_ID ? (userId ?? id) : id} className={className} />
  )
}

/** Round avatar with a hairline drawn over the picture, so every face keeps its edge. */
export function UserAvatar({ user, className }: { user: AvatarSource; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative grid size-7 shrink-0 place-items-center overflow-hidden rounded-full bg-active',
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:ring-1 after:ring-line after:ring-inset',
        className,
      )}
    >
      <AvatarArt id={avatarFor(user)} userId={user.id} />
    </span>
  )
}
