import { expect, test, type Page } from '@playwright/test'

const INTRO_SESSION_KEY = 'language-school:intro-completed'
const DEMO_ADDRESS = 'Calle Luis Carvajal, 23, Jódar, Jaén'
const DEMO_INSTAGRAM = 'languageschool_rocioruiz'

async function skipIntro(page: Page) {
  await page.addInitScript((key) => {
    window.sessionStorage.setItem(key, 'true')
  }, INTRO_SESSION_KEY)
}

async function expectNoDemoIdentity(page: Page) {
  await expect(page.getByText(DEMO_ADDRESS, { exact: true })).toHaveCount(0)
  await expect(page.locator(`a[href*="${DEMO_INSTAGRAM}"]`)).toHaveCount(0)
  await expect(page.locator('a[href*="wa.me"]')).toHaveCount(0)
  const bodyText = await page.locator('body').innerText()
  expect(bodyText).not.toContain(DEMO_ADDRESS)
}

async function failSiteSettings(page: Page, delayMs = 0) {
  await page.route('**/api/collections/site_settings/records?*', async (route) => {
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs))
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'temporary unavailable' }) })
  })
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
  await expect(page.getByRole('heading', { name: 'Ubicación pendiente de publicar.' })).toBeVisible()
  await expect(page.locator('iframe[title^="Mapa de Language School"]')).toHaveCount(0)
})

test('15C: connected mantiene identidad neutra mientras site_settings falla', async ({ page }) => {
  await skipIntro(page)
  await failSiteSettings(page, 700)

  await page.goto('/contacto')
  await expect(page.getByRole('main')).toBeVisible()

  // Antes de que termine la petición fallida, el shell conectado ya debe ser neutro.
  await expectNoDemoIdentity(page)
  await page.waitForTimeout(900)
  // Tras el fallo tampoco puede reaparecer ninguna identidad de demostración.
  await expectNoDemoIdentity(page)
  await expect(page.getByRole('heading', { name: 'Ubicación pendiente de publicar.' })).toBeVisible()
})

test('15C: privacidad y aviso legal no heredan identidad demo si site_settings falla', async ({ page }) => {
  await skipIntro(page)
  await failSiteSettings(page)

  for (const path of ['/privacidad', '/aviso-legal']) {
    await page.goto(path)
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByText('Dato pendiente antes de producción.')).toBeVisible()
    await expectNoDemoIdentity(page)
  }
})
