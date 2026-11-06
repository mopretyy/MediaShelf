import type { Kind, Status } from '@shared/types.ts'
import { KindIcon, StatusIcon } from '@/components/StatusIcon'
import { useI18n, type MessageKey } from '@/i18n'

/** Poster stand-ins: colour lives in artwork only, never in chrome. */
const POSTERS: {
  kind: Kind
  status: Status
  art: string
  tilt: number
  x: number
  y: number
  delay: number
}[] = [
  {
    kind: 'movie',
    status: 'completed',
    art: 'linear-gradient(160deg,#f6d365 0%,#fda085 45%,#3b1d4a 100%)',
    tilt: -9,
    x: -190,
    y: 30,
    delay: 0,
  },
  {
    kind: 'game',
    status: 'in_progress',
    art: 'linear-gradient(200deg,#43e97b 0%,#0f766e 50%,#04121a 100%)',
    tilt: 6,
    x: 100,
    y: -10,
    delay: -2,
  },
  {
    kind: 'anime',
    status: 'planned',
    art: 'linear-gradient(170deg,#ff9a9e 0%,#c471f5 55%,#1b1036 100%)',
    tilt: -3,
    x: -80,
    y: -60,
    delay: -4,
  },
  {
    kind: 'series',
    status: 'paused',
    art: 'linear-gradient(190deg,#6dd5fa 0%,#2c3e93 55%,#070b1f 100%)',
    tilt: 11,
    x: 20,
    y: 90,
    delay: -1,
  },
]

export function AuthShowcase() {
  const { t } = useI18n()
  return (
    <aside className="dark relative hidden overflow-hidden rounded-2xl bg-[#0b0b0b] text-fg ring-1 ring-white/10 ring-inset lg:flex lg:flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(rgba(255,255,255,.14)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
      />
      <div aria-hidden className="relative flex flex-1 items-center justify-center">
        {POSTERS.map((p, i) => (
          <div
            key={i}
            className="auth-float absolute"
            style={{
              ['--x' as string]: `${p.x}px`,
              ['--y' as string]: `${p.y}px`,
              ['--r' as string]: `${p.tilt}deg`,
              animationDelay: `${p.delay}s`,
              zIndex: i === 2 ? 3 : i,
            }}
          >
            <div
              className="relative h-[228px] w-[152px] overflow-hidden rounded-lg shadow-[0_30px_60px_-20px_rgba(0,0,0,.8)] ring-1 ring-white/15 ring-inset"
              style={{ background: p.art }}
            >
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute top-2 left-2 grid size-7 place-items-center rounded-md bg-black/35 text-white backdrop-blur-sm">
                <KindIcon kind={p.kind} className="size-3.5" />
              </div>
              <div className="absolute right-2.5 bottom-2.5 left-2.5 flex items-center gap-1.5 text-[11px] font-medium text-white/90">
                <StatusIcon status={p.status} className="size-3.5" />
                <span className="h-1.5 flex-1 rounded-full bg-white/25" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="relative p-10 pt-0">
        <h2 className="display max-w-[420px] text-[28px] leading-[1.15]">
          {t('auth.showcaseTitle')}
        </h2>
        <p className="mt-3 max-w-[400px] text-md text-fg-2">{t('auth.showcaseText')}</p>
        <ul className="mt-6 flex flex-wrap gap-2">
          {(['game', 'movie', 'series', 'anime'] as Kind[]).map((kind) => (
            <li
              key={kind}
              className="flex items-center gap-1.5 rounded-md bg-white/[0.06] px-2.5 py-1 text-sm text-fg-2 ring-1 ring-white/10 ring-inset"
            >
              <KindIcon kind={kind} className="size-3.5" />
              {t(`kinds.${kind}` as MessageKey)}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
