// Design tour: logs in as the demo user and screenshots every main page.
// Usage (from the repo root, after `npm run build` and `npm run seed:demo` with DATA_DIR=/tmp/demo-data):
//   PORT=4199 CATALOG_MODE=live DATA_DIR=/tmp/demo-data node server/main.ts &
//   CHROME_PATH=$(which chromium) OUT=/tmp/tour node docs/design/tour.mjs
// Env: PAGES (comma list, ME = own profile), VARIANTS (d-dark,d-light,m-dark), WAIT (ms), FULL=1.
import { chromium, devices } from '@playwright/test'
const B = 'http://127.0.0.1:4199'
const out = process.env.OUT || '/tmp/tour'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH })
const pages = (
  process.env.PAGES ||
  '/,/discover,/library,/library?view=board,/title/series-tt0944947,/title/steam-1145360,/shuffle,/stats,/stats/year,/settings/profile,ME'
).split(',')
const variants = (process.env.VARIANTS || 'd-dark,d-light,m-dark').split(',')
for (const v of variants) {
  const mobile = v.startsWith('m')
  const ctx = await browser.newContext({
    ...(mobile ? devices['Pixel 7'] : { viewport: { width: 1440, height: 900 } }),
    locale: 'ru-RU',
    colorScheme: v.endsWith('dark') ? 'dark' : 'light',
    reducedMotion: 'reduce',
  })
  const page = await ctx.newPage()
  await page.goto(B + '/login')
  await page.locator('input[type=email]').fill('demo@mediashell.local')
  await page.locator('input[type=password]').fill('password123')
  await page.locator('form button[type=submit]').click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 })
  await page.evaluate(
    (t) => localStorage.setItem('mediashelf:theme', t),
    v.endsWith('dark') ? 'dark' : 'light',
  )
  const me = await page.evaluate(
    async () => (await (await fetch('/api/auth/session')).json()).user.id,
  )
  for (const p of pages) {
    const path = p === 'ME' ? '/users/' + me : p
    await page.goto(B + path)
    await page.waitForTimeout(Number(process.env.WAIT || 5000))
    const name =
      p === 'ME' ? 'profile' : p.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'
    await page.screenshot({ path: `${out}/${v}-${name}.png`, fullPage: process.env.FULL === '1' })
  }
  await ctx.close()
}
await browser.close()
