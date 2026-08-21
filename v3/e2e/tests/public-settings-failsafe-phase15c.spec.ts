import { expect, test } from '@playwright/test'

const INTRO_SESSION_KEY = 'language-school:intro-completed'
const DEMO_ADDRESS = 'Calle Luis Carvajal, 23, Jódar, Jaén'

test('15C: connected no publica datos demo si falta site_settings', async ({ page }) => {
  await page.addInitScript((key) => {
    window.sessionStorage.setItem(key, 'true')
  }, INTRO_SESSION_KEY)

  await page.route('**/api/collections/site_settings/records?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        page: 1,
        perPage: 1,
        totalItems: 0,
        totalPages: 0,
        items: [],
      }),
    })
  })

  await page.goto('/contacto')
  await expect(page).toHaveURL(/\/contacto$/)
  await expect(page.getByRole('main')).toBeVisible()

  await expect(page.getByText(DEMO_ADDRESS, { exact: true })).toHaveCount(0)
  await expect(page.locator('a[href*="wa.me"]')).toHaveCount(0)

  const bodyText = await page.locator('body').innerText()
  expect(bodyText).not.toContain(DEMO_ADDRESS)
})
