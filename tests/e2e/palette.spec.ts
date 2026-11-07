import { expect, test } from '@playwright/test'
import { register } from './helpers.ts'

const SEARCH_PLACEHOLDER = 'Поиск по библиотеке и каталогу…'

test('the palette previews the selected row: a title, a page, a language', async ({ page }) => {
  await register(page)
  await page.keyboard.press('Control+k')
  const input = page.getByPlaceholder(SEARCH_PLACEHOLDER)
  const preview = page.getByTestId('palette-preview')
  await expect(input).toBeFocused()

  // A title: its name, kind, year, genres, rating and description, without opening it.
  await input.fill('Interstellar')
  await expect(page.getByRole('option', { name: /Интерстеллар/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(preview).toBeVisible()
  await expect(preview).toContainText('Интерстеллар')
  await expect(preview).toContainText('Interstellar')
  await expect(preview).toContainText('Фильм · 2014')
  await expect(preview).toContainText('IMDb')
  await expect(preview).toContainText('бывший пилот NASA')
  // The column repeats what the option already says: hidden from assistive technology.
  await expect(preview).toHaveAttribute('aria-hidden', 'true')

  // A page of the app: its icon and name.
  await input.fill('Статис')
  await expect(page.getByRole('option', { name: 'Статистика' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(preview).toContainText('Статистика')

  // The language list: each language in itself.
  await input.fill('язык')
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowDown')
  await expect(preview).toContainText('English')
  await expect(preview.locator('[lang="en"]')).toHaveText('English')
})

test('the preview column is only there when the palette has room for it', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 900 })
  await register(page)
  await page.keyboard.press('Control+k')
  await page.getByPlaceholder(SEARCH_PLACEHOLDER).fill('Interstellar')
  await expect(page.getByRole('option', { name: /Интерстеллар/ })).toBeVisible()
  await expect(page.getByTestId('palette-preview')).toBeHidden()
})
