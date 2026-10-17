import { Dices, RefreshCw, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import type { User } from '@shared/types.ts'
import { AvatarArt, CUSTOM_AVATAR_ID, avatarFor } from '@/components/avatar'
import { GeneratedAvatar } from '@/components/avatar-art'
import { isAvatarSeed, randomSeed } from '@/components/avatar-gen'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { customAvatar, fileToAvatar, saveCustomAvatar } from '@/lib/device'
import { useUpdateProfile } from '@/lib/queries'

/** Three rows of seven on wider screens; phones show four rows of five. */
const OPTIONS = 21

const tile =
  'relative aspect-square overflow-hidden rounded-full ring-1 ring-line transition-transform duration-200 ease-[cubic-bezier(.23,1,.32,1)] hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100'
const selected = 'ring-2 ring-fg ring-offset-2 ring-offset-panel'

/** The face in use (when it is a stored one) first, then new faces. */
function freshOptions(current: string) {
  const seeds = Array.from({ length: OPTIONS }, () => randomSeed())
  if (isAvatarSeed(current)) seeds[0] = current
  return seeds
}

/**
 * Avatar studio: a large preview and a grid of generated faces. Every face is one of a kind;
 * "More options" deals a new grid, "Random" picks one straight away.
 */
export function AvatarPicker({ user }: { user: User }) {
  const { t } = useI18n()
  const update = useUpdateProfile()
  const file = useRef<HTMLInputElement>(null)
  const current = avatarFor(user)
  const hasUpload = Boolean(customAvatar(user.id))
  const [options, setOptions] = useState(() => freshOptions(current))
  const shown = options.slice(0, hasUpload ? OPTIONS - 1 : OPTIONS)

  const choose = (avatar: string) =>
    update.mutate({ preferences: { avatar } }, { onError: () => toast.error(t('errors.generic')) })

  const randomize = () => {
    const seed = randomSeed()
    setOptions((list) => [seed, ...list.slice(1)])
    choose(seed)
  }

  const upload = async (chosen: File | undefined) => {
    if (!chosen) return
    try {
      saveCustomAvatar(user.id, await fileToAvatar(chosen))
      choose(CUSTOM_AVATAR_ID)
    } catch {
      toast.error(t('errors.generic'))
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-4 sm:gap-5">
        <span className="size-24 shrink-0 overflow-hidden rounded-full ring-1 ring-line sm:size-28">
          <AvatarArt id={current} userId={user.id} />
        </span>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setOptions(freshOptions(current))}>
            <RefreshCw />
            {t('profileLook.more')}
          </Button>
          <Button variant="secondary" size="sm" onClick={randomize}>
            <Dices />
            {t('profileLook.random')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => file.current?.click()}>
            <Upload />
            {t('profileLook.upload')}
          </Button>
          <input
            ref={file}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(event) => {
              void upload(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </div>
      </div>

      <section aria-label={t('profileLook.characters')}>
        <div
          role="radiogroup"
          aria-label={t('profileLook.characters')}
          className="grid grid-cols-5 gap-3 sm:grid-cols-7"
        >
          {hasUpload ? (
            <button
              type="button"
              role="radio"
              aria-checked={current === CUSTOM_AVATAR_ID}
              aria-label={t('profileLook.upload')}
              title={t('profileLook.upload')}
              onClick={() => choose(CUSTOM_AVATAR_ID)}
              className={cn(tile, current === CUSTOM_AVATAR_ID && selected)}
            >
              <AvatarArt id={CUSTOM_AVATAR_ID} userId={user.id} />
            </button>
          ) : null}
          {shown.map((seed, index) => (
            <button
              key={seed}
              type="button"
              role="radio"
              aria-checked={current === seed}
              aria-label={t('profileLook.option', { n: index + 1 })}
              onClick={() => choose(seed)}
              className={cn(
                tile,
                current === seed && selected,
                index === shown.length - 1 &&
                  (shown.length + Number(hasUpload)) % 5 === 1 &&
                  'max-sm:hidden',
              )}
            >
              <GeneratedAvatar seed={seed} />
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
