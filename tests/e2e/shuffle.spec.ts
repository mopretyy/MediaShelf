import { expect, test } from '@playwright/test'
import { api, register } from './helpers.ts'

test('shuffle with nothing to pick explains why and rolls the popular titles instead', async ({
  page,
}) => {
  await register(page)
  await page.goto('/shuffle?source=library')
  await expect(
    page.getByRole('heading', { name: 'В библиотеке пока нечего выбирать' }),
  ).toBeVisible()
  // No selection frame, no disabled button, no «Пробел — бросить ещё раз» over an empty pool.
  await expect(page.getByTestId('shuffle-roll')).toHaveCount(0)
  await expect(page.getByText(/^В жребии/)).toHaveCount(0)

  await page.getByRole('button', { name: 'Бросить по популярному' }).click()
  const source = page.getByRole('radiogroup', { name: 'Откуда выбирать' })
  await expect(source.getByRole('radio', { name: 'Популярное' })).toBeChecked()
  await expect(page.getByRole('button', { name: 'В планы' })).toBeVisible()
  await expect(page.getByText(/^В жребии/)).toHaveText(/Пробел бросить ещё раз$/)
})

test('shuffle says «бросить» before the first spin and can clear its filters', async ({ page }) => {
  await register(page)
  for (const titleId of ['movie-tt1375666', 'series-tt0944947'])
    expect((await api(page, 'POST', '/library', { titleId, status: 'planned' })).status).toBe(201)
  await page.goto('/shuffle?source=library')
  const pool = page.getByText(/^В жребии/)
  await expect(pool).toHaveText('В жребии 2 тайтла · Пробел бросить')

  // Plans exist, the chips just leave them out: the fix is one click away.
  await page.getByRole('button', { name: 'В планах', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Под фильтры ничего не подходит' })).toBeVisible()
  await expect(page.getByTestId('shuffle-roll')).toHaveCount(0)
  await page.getByRole('button', { name: 'Сбросить фильтры' }).click()
  await expect(pool).toHaveText('В жребии 2 тайтла · Пробел бросить')
  for (const status of ['В планах', 'Отложено', 'В процессе'])
    await expect(page.getByRole('button', { name: status, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

  await page.getByTestId('shuffle-roll').click()
  await expect(page.getByTestId('shuffle-roll')).toContainText('Ещё раз')
  await expect(pool).toHaveText('В жребии 2 тайтла · Пробел бросить ещё раз')
})

test('shuffle waits for the session and library instead of flashing «nothing to pick»', async ({
  page,
}) => {
  await register(page)
  for (const titleId of ['movie-tt1375666', 'movie-tt0816692'])
    expect((await api(page, 'POST', '/library', { titleId, status: 'planned' })).status).toBe(201)
  const source = page.getByRole('radiogroup', { name: 'Откуда выбирать' })
  /** Holds the responses for `paths` until the returned function is called. */
  const hold = async (...paths: string[]) => {
    let release = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    for (const path of paths)
      await page.route(`**/api${path}`, async (route) => {
        await held
        await route.fallback()
      })
    return async () => {
      release()
      for (const path of paths) await page.unroute(`**/api${path}`)
    }
  }
  const expectWaiting = async () => {
    await expect(page.getByTestId('shuffle-roll')).toBeDisabled()
    await page.waitForTimeout(500)
    for (const message of ['В библиотеке пока нечего выбирать', /Войдите/, /^В жребии/])
      await expect(page.getByText(message)).toHaveCount(0)
  }

  // No source chosen yet: the default (your plans) is only known once the library is in.
  let release = await hold('/library')
  await page.goto('/shuffle')
  await expectWaiting()
  await release()
  await expect(page.getByText(/^В жребии/)).toHaveText(/^В жребии 2 тайтла/)
  await expect(source.getByRole('radio', { name: 'Моя библиотека' })).toBeChecked()

  // A fresh load knows nobody until the session answers: not a guest, not an empty library.
  release = await hold('/auth/session', '/library')
  await page.goto('/shuffle?source=library')
  await expectWaiting()
  await release()
  await expect(page.getByText(/^В жребии/)).toHaveText(/^В жребии 2 тайтла/)
})

test('sound and vibration are off until turned on; then the reel clicks and the result buzzes', async ({
  page,
}) => {
  // Count what the page asks of the audio and vibration APIs instead of making noise.
  await page.addInitScript(() => {
    const w = window as unknown as { __sound: { blips: number; vibrations: number } }
    w.__sound = { blips: 0, vibrations: 0 }
    const param = () => ({
      setValueAtTime() {},
      exponentialRampToValueAtTime() {},
    })
    class FakeContext {
      destination = {}
      // Audio time runs like the real one, so the 28 ms spacing between clicks applies.
      get currentTime() {
        return performance.now() / 1000
      }
      resume() {
        return Promise.resolve()
      }
      createOscillator() {
        w.__sound.blips++
        return {
          type: 'sine',
          frequency: param(),
          connect: (next: unknown) => next,
          start() {},
          stop() {},
        }
      }
      createGain() {
        return { gain: param(), connect: (next: unknown) => next }
      }
    }
    Object.defineProperty(window, 'AudioContext', { value: FakeContext, configurable: true })
    Object.defineProperty(navigator, 'vibrate', {
      value: () => {
        w.__sound.vibrations++
        return true
      },
      configurable: true,
    })
  })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await register(page)
  await page.goto('/shuffle?source=catalog')
  const roll = page.getByTestId('shuffle-roll')
  const counts = () =>
    page.evaluate(() => (window as unknown as { __sound: object }).__sound) as Promise<{
      blips: number
      vibrations: number
    }>

  const toggle = page.getByRole('switch', { name: 'Звук и вибрация' })
  await expect(toggle).not.toBeChecked()
  await roll.click()
  await expect(page.getByRole('button', { name: 'В планы' })).toBeVisible({ timeout: 10_000 })
  expect(await counts()).toEqual({ blips: 0, vibrations: 0 })

  await toggle.click()
  await expect(toggle).toBeChecked()
  expect(await page.evaluate(() => localStorage.getItem('mediashelf:shuffle-sound'))).toBe('1')
  await roll.click()
  await expect(page.getByRole('button', { name: 'В планы' })).toBeVisible({ timeout: 10_000 })
  const after = await counts()
  // Several clicks while it spins, then the two-note chime, and one buzz.
  expect(after.blips).toBeGreaterThan(4)
  expect(after.vibrations).toBe(1)

  // Kept on this device.
  await page.reload()
  await expect(page.getByRole('switch', { name: 'Звук и вибрация' })).toBeChecked()
})

test('shuffle picks from a collection, opened from the collection itself', async ({ page }) => {
  await register(page)
  const { body } = await api<{ collection: { id: string } }>(page, 'POST', '/collections', {
    name: 'На выходные',
  })
  for (const titleId of ['movie-tt1375666', 'movie-tt0816692'])
    await api(page, 'POST', `/collections/${body.collection.id}/items`, { titleId })
  await page.goto(`/collections/${body.collection.id}`)
  await page.getByRole('main').getByRole('link', { name: 'Жребий' }).click()
  await expect(page).toHaveURL(/source=collection/)
  const source = page.getByRole('radiogroup', { name: 'Откуда выбирать' })
  await expect(source.getByRole('radio', { name: 'Подборка' })).toBeChecked()
  await expect(page.getByRole('combobox', { name: 'Подборка' })).toHaveText(/На выходные/)
  await expect(page.getByText(/^В жребии/)).toHaveText(/^В жребии 2 тайтла/)
  await page.getByTestId('shuffle-roll').click()
  await expect(page.getByRole('heading', { level: 2, name: /Начало|Интерстеллар/ })).toBeVisible()
})
