import { Check, Trophy } from 'lucide-react'
import type { TitleRecord } from '@shared/types.ts'
import { useI18n } from '@/i18n'
import { useAchievements, useMyAchievements } from '@/lib/queries'

/** Steam achievements: your own progress when Steam is linked, plus global unlock rates. */
export function AchievementsSection({ title }: { title: TitleRecord }) {
  const { t } = useI18n()
  const appid = title.externalIds?.steam ?? null
  const isGame = title.kind === 'game'
  const stats = useAchievements(isGame ? appid : null)
  const mine = useMyAchievements(isGame ? appid : null)
  if (!isGame || !appid) return null
  if (stats.isPending || stats.isError || !stats.data?.length) return null
  const unlocked = mine.data ? new Set(mine.data) : null
  const total = stats.data.length
  const done = unlocked ? stats.data.filter((a) => unlocked.has(a.name)).length : 0
  // Unlocked first, then the most common ones still missing: the next easy targets.
  const ordered = unlocked
    ? [...stats.data].sort((a, b) => Number(unlocked.has(b.name)) - Number(unlocked.has(a.name)))
    : stats.data
  const top = ordered.slice(0, 12)
  return (
    <section aria-label={t('achievements.title')} className="mt-10">
      <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold tracking-[-0.015em]">
        <Trophy className="size-5 text-fg-3" aria-hidden="true" />
        {t('achievements.title')}
        {unlocked && (
          <span className="tabular ml-1 text-base font-normal text-fg-2">
            {t('achievements.mine', { done, total })}
          </span>
        )}
      </h2>
      {unlocked && (
        <div
          className="mb-4 h-1.5 max-w-md overflow-hidden rounded-full bg-active"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
        >
          <span
            className="block h-full rounded-full bg-fg"
            style={{ width: `${total ? (done / total) * 100 : 0}%` }}
          />
        </div>
      )}
      <ul className="grid gap-2 sm:grid-cols-2">
        {top.map((item) => {
          const got = unlocked?.has(item.name) ?? false
          const locked = unlocked !== null && !got
          return (
            <li
              key={item.name}
              className={`flex items-center gap-3 rounded-xl bg-raised px-3.5 py-2.5 ring-1 ring-line ring-inset ${locked ? 'opacity-55' : ''}`}
            >
              {item.icon ? (
                <img
                  src={item.icon}
                  alt=""
                  loading="lazy"
                  className="size-9 shrink-0 rounded-md object-cover"
                />
              ) : (
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-active">
                  <Trophy className="size-4 text-fg-3" aria-hidden="true" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {got && (
                    <Check
                      className="size-3.5 shrink-0 text-fg"
                      aria-label={t('achievements.unlocked')}
                    />
                  )}
                  <span className="truncate">{item.displayName}</span>
                </span>
                <span className="mt-1 block h-1 overflow-hidden rounded-full bg-active">
                  <span
                    className="block h-full rounded-full bg-fg"
                    style={{ width: `${Math.min(100, Math.max(0, item.percent))}%` }}
                  />
                </span>
              </span>
              <span className="tabular shrink-0 text-sm text-fg-2">
                {t('achievements.percent', { percent: item.percent })}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-xs text-fg-3">{t('achievements.hint')}</p>
    </section>
  )
}
