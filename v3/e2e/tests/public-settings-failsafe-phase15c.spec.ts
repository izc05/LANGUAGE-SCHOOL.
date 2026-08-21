import { expect, test } from '@playwright/test'

const INTRO_SESSION_KEY = 'language-school:intro-completed'
const DEMO_ADDRESS = 'Calle Luis Carvajal, 23, Jódar, Jaén'
const DEMO_INSTAGRAM = 'languageschool_rocioruiz'

async function skipIntro(page: import('@playwright/test').Page) {
  await page.addInitScript((key) => {
    window.sessionStorage.setItem(key, 'true')
  }, INTRO_SESSION_KEY)
}

async function expectNoDemoIdentity(page: import('@playwright/test').Page) {
  await expect(page.getByText(DEMO_ADDRESS, { exact: true })).toHaveCount(0)
  await expect(page.locator(`a[href*="${DEMO_INSTAGRAM}"]`)).toHaveCount(0)
  await expect(page.locator('a[href*="wa.me"]')).toHaveCount(0)
  const bodyText = await page.locator('body').innerText()
  expect(bodyText).not.toContain(DEMO_ADDRESS)
}

test('15C: connected no publica datos demo si falta site_settings', async ({ page }) => {
  await skipIntro(page)
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
  await expectNoDemoIdentity(page)
})

test('15C: connected mantiene identidad neutra mientras site_settings falla', async ({ page }) => {
  await skipIntro(page)
  await page.route('**/api/collections/site_settings/records?*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700))
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'temporary unavailable' }) })
  })

  await page.goto('/contacto')
  await expect(page.getByRole('main')).toBeVisible()

  // Antes de que termine la petición fallida, el shell conectado ya debe ser neutro.
  await expectNoDemoIdentity(page)
  await page.waitForTimeout(900)
  // Tras el fallo tampoco puede reaparecer ninguna identidad de demostración.
  await expectNoDemoIdentity(page)
})
