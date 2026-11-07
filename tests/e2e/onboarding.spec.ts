import { expect, test, type Page } from '@playwright/test'
import { register, signUp } from './helpers.ts'

/** Every main-frame URL, client-side navigations included. */
function trackPaths(page: Page) {
  const paths: string[] = []
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) paths.push(new URL(frame.url()).pathname)
  })
  return paths
}

test('a new account lands on onboarding and finishes it on Home', async ({ page }) => {
  const paths = trackPaths(page)
  await signUp(page, 'Вера')
  await expect(page).toHaveURL(/\/welcome$/)
  const avatarStep = page.getByRole('heading', { level: 1, name: 'Выберите аватар' })
  await expect(avatarStep).toBeVisible()
  // It stays there: the old race bounced to Home in the same tick.
  await page.waitForTimeout(500)
  await expect(page).toHaveURL(/\/welcome$/)
  expect(paths).not.toContain('/')

  await page.getByRole('button', { name: 'Далее' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Подключите магазины' })).toBeVisible()
  await page.getByRole('button', { name: 'Назад' }).click()
  await expect(avatarStep).toBeVisible()
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('button', { name: 'Готово' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { level: 1, name: /Вера/ })).toBeVisible()

  // Done once is done on this device.
  await page.goto('/welcome')
  await expect(page).toHaveURL(/\/$/)
  await page.goto('/register')
  await expect(page).toHaveURL(/\/$/)
})

test('skipping onboarding is remembered, and a sign-up with a destination goes there', async ({
  page,
}) => {
  await register(page)
  await page.goto('/welcome')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { level: 1, name: /Дмитрий/ })).toBeVisible()

  await page.getByRole('button', { name: /^Аккаунт/ }).click()
  await page.getByRole('menuitem', { name: 'Выйти' }).click()
  await expect(page.getByRole('link', { name: 'Войти' }).first()).toBeVisible()
  // A guest sent to sign up from a protected page gets that page, not the setup.
  await signUp(page, 'Глеб', '/register?next=%2Flibrary')
  await expect(page).toHaveURL(/\/library$/)
  await expect(page.getByText('Библиотека пуста')).toBeVisible()
})

test('the one-click email link also starts the onboarding', async ({ page }) => {
  const email = `link${Date.now()}@example.com`
  const started = await page.request.post('/api/auth/register/start', {
    data: { name: 'Лидия', email, password: 'correct-horse-42', locale: 'ru' },
  })
  const { devCode } = (await started.json()) as { devCode?: string }
  expect(devCode).toBeTruthy()
  await page.goto(`/verify-email?email=${encodeURIComponent(email)}&code=${devCode}`)
  await expect(page).toHaveURL(/\/welcome$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Выберите аватар' })).toBeVisible()
})

test('an existing account opening the sign-up page on a new device is not sent to onboarding', async ({
  browser,
}) => {
  const first = await browser.newPage()
  const account = await register(first)
  await first.close()

  // Another device: no onboarding mark in its storage, only a session.
  const page = await browser.newPage()
  await page.goto('/login')
  await page.getByLabel('Эл. почта').fill(account.email)
  await page.getByLabel('Пароль', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Войти' }).last().click()
  await expect(page.getByRole('heading', { level: 1, name: /Дмитрий/ })).toBeVisible()
  await page.goto('/register')
  await expect(page).toHaveURL(/\/$/)
  await page.close()
})
