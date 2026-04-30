import { test, expect } from '@playwright/test'

test.describe('Calendar interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#calendar')
  })

  test('clicking empty time slot opens quick-create popover', async ({ page }) => {
    await page.locator('[data-time="15:00"]').click()
    await expect(page.locator('#popover')).toHaveClass(/visible/)
    await expect(page.locator('#event-title-input')).toBeVisible()
  })

  test('filling title and pressing Enter creates an event chip on the grid', async ({ page }) => {
    await page.locator('[data-time="15:00"]').click()
    await page.locator('#event-title-input').fill('Team sync')
    await page.locator('#event-title-input').press('Enter')
    const chip = page.locator('[data-time="15:00"] .event-chip')
    await expect(chip).toBeVisible()
    await expect(chip).toContainText('Team sync')
  })

  test('clicking an event chip opens detail popover with title and time', async ({ page }) => {
    // Create an event first
    await page.locator('[data-time="15:00"]').click()
    await page.locator('#event-title-input').fill('Design review')
    await page.locator('#event-title-input').press('Enter')

    // Click the chip
    await page.locator('.event-chip').click()
    await expect(page.locator('#popover')).toHaveClass(/visible/)
    await expect(page.locator('#detail-title')).toContainText('Design review')
    await expect(page.locator('#detail-time')).toContainText('15:00')
  })

  test('clicking Edit in the detail popover opens the edit modal', async ({ page }) => {
    // Create an event
    await page.locator('[data-time="15:00"]').click()
    await page.locator('#event-title-input').fill('Sprint planning')
    await page.locator('#event-title-input').press('Enter')

    // Open detail popover
    await page.locator('.event-chip').click()
    await page.getByRole('button', { name: 'Edit' }).click()

    // Modal should open with title and time fields
    await expect(page.locator('#modal-overlay')).toHaveClass(/visible/)
    await expect(page.locator('#modal-title')).toHaveValue('Sprint planning')
    await expect(page.locator('#modal-time')).toHaveValue('15:00')
  })
})
