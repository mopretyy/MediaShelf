import { expect, type Page } from '@playwright/test'

let counter = 0

/** Creates an account through the form and leaves the page on the onboarding it lands on. */
export async function signUp(page: Page, name = 'Дмитрий', path = '/register') {
  const email = `user${Date.now()}${counter++}@example.com`
  await page.goto(path)
  await page.getByLabel('Имя').fill(name)
  await page.getByLabel('Эл. почта').fill(email)
  await page.getByLabel('Пароль', { exact: true }).fill('correct-horse-42')
  // Registration is two steps since email verification: without SMTP the server returns the
  // code as devCode, which is exactly what a user sees on screen in a local install.
  const started = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/auth/register/start') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  const { devCode } = (await (await started).json()) as { devCode?: string }
  if (!devCode) throw new Error('register: the server did not return a dev code (SMTP configured?)')
  await expect(page.getByRole('heading', { level: 1, name: 'Проверьте почту' })).toBeVisible()
  await page.locator('input[autocomplete="one-time-code"]').fill(devCode)
  return { email, password: 'correct-horse-42' }
}

/** A new account on Home, past the onboarding: skipped the way a hurried user would. */
export async function register(page: Page, name = 'Дмитрий') {
  const account = await signUp(page, name)
  await expect(page).toHaveURL(/\/welcome$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Выберите аватар' })).toBeVisible()
  await page.getByRole('button', { name: 'Пропустить' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { level: 1, name: new RegExp(name) })).toBeVisible()
  return account
}

export async function openTitle(page: Page, id: string) {
  await page.goto(`/title/${id}`)
  await expect(page.locator('main h1').last()).toBeVisible()
}

export async function api<T = Record<string, never>>(
  page: Page,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: T }> {
  return page.evaluate(
    async ([method, path, body]) => {
      const response = await fetch(`/api${path}`, {
        method: method as string,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? (method === 'GET' ? undefined : '{}') : JSON.stringify(body),
      })
      return { status: response.status, body: await response.json().catch(() => null) }
    },
    [method, path, body] as const,
  )
}

/**
 * No element may push the page wider than the viewport. Compared with the configured width, not
 * with innerWidth: with mobile emulation the layout viewport grows to fit wide content, so
 * innerWidth grows with the overflow and would hide it.
 */
export async function expectNoHorizontalOverflow(page: Page) {
  const width = page.viewportSize()?.width
  if (!width) throw new Error('expectNoHorizontalOverflow: the page has no fixed viewport')
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth, `page is ${scrollWidth - width}px wider than ${width}px`).toBeLessThanOrEqual(
    width + 1,
  )
}
