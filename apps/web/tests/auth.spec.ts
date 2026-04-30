import { test, expect } from '@playwright/test'

test.describe('Auth flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#auth')
  })

  test('signup navigates to calendar page', async ({ page }) => {
    await page.getByLabel('Email').fill('user@example.com')
    await page.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Sign up' }).click()
    await expect(page).toHaveURL(/#calendar/)
  })

  test('signin navigates to calendar page', async ({ page }) => {
    await page.getByLabel('Email').fill('user@example.com')
    await page.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/#calendar/)
  })

  test('logout returns to auth page', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/#calendar/)
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/#auth/)
    await expect(page.getByRole('button', { name: 'Sign up' })).toBeVisible()
  })
})
