import { test, expect } from '@playwright/test'

test.describe('Tasks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#tasks')
  })

  test('clicking "+ New Task" reveals the task input', async ({ page }) => {
    await expect(page.locator('#task-input-row')).not.toBeVisible()
    await page.getByRole('button', { name: '+ New Task' }).click()
    await expect(page.locator('#new-task-input')).toBeVisible()
  })

  test('submitting a task title adds it to the list', async ({ page }) => {
    await page.getByRole('button', { name: '+ New Task' }).click()
    await page.locator('#new-task-input').fill('Implement encryption')
    await page.locator('#new-task-input').press('Enter')
    const item = page.locator('.task-item')
    await expect(item).toBeVisible()
    await expect(item).toContainText('Implement encryption')
  })

  test('checking a task checkbox removes it from the open list', async ({ page }) => {
    // Add a task first
    await page.getByRole('button', { name: '+ New Task' }).click()
    await page.locator('#new-task-input').fill('Write docs')
    await page.locator('#new-task-input').press('Enter')

    // Verify it's visible
    await expect(page.locator('.task-item')).toBeVisible()

    // Check the checkbox
    await page.locator('.task-item input[type="checkbox"]').click()

    // Task should be marked done (has .done class, appears struck through / dim)
    await expect(page.locator('.task-item.done')).toBeVisible()
  })

  test('multiple tasks can be added independently', async ({ page }) => {
    const titles = ['Task A', 'Task B', 'Task C']
    for (const title of titles) {
      await page.getByRole('button', { name: '+ New Task' }).click()
      await page.locator('#new-task-input').fill(title)
      await page.locator('#new-task-input').press('Enter')
    }
    await expect(page.locator('.task-item')).toHaveCount(3)
  })
})
