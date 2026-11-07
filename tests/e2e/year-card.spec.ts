import { expect, test } from '@playwright/test'
import { api, register } from './helpers.ts'

test('the year story draws a picture for social media, previewed and downloadable', async ({
  page,
}) => {
  await register(page)
  for (const [titleId, rating] of [
    ['movie-tt1375666', 9],
    ['movie-tt0816692', 10],
    ['steam-1086940', 8],
  ] as const)
    expect(
      (await api(page, 'POST', '/library', { titleId, status: 'completed', rating })).status,
    ).toBe(201)
  await page.goto('/stats/year')
  const story = page.getByRole('dialog', { name: /Итоги \d{4}/ })
  const counter = story.getByText(/^\d+ \/ \d+$/)
  const total = Number((await counter.textContent())!.split('/')[1])
  for (let slide = 1; slide < total; slide++) await page.keyboard.press('ArrowRight')
  await expect(counter).toHaveText(`${total} / ${total}`)

  await story.getByRole('button', { name: 'Картинка для соцсетей' }).click()
  const dialog = page.getByRole('dialog', { name: /одной картинкой/ })
  await expect(dialog).toBeVisible()
  const picture = dialog.getByTestId('year-card').locator('img')
  await expect(picture).toBeVisible({ timeout: 20_000 })
  expect(
    await picture.evaluate((image: HTMLImageElement) => [image.naturalWidth, image.naturalHeight]),
  ).toEqual([1080, 1920])

  // A click in the dialog's left part is not a tap on the story behind it.
  const box = (await dialog.boundingBox())!
  await page.mouse.click(box.x + 12, box.y + box.height / 2)
  await expect(dialog).toBeVisible()
  await expect(counter).toHaveText(`${total} / ${total}`)

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('link', { name: 'Скачать PNG' }).click(),
  ])
  expect(download.suggestedFilename()).toBe(`mediashell-${new Date().getFullYear()}.png`)

  // Escape closes the picture, and only the picture.
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(story).toBeVisible()
})
