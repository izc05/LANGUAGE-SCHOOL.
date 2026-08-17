import { expect, test } from '@playwright/test'

test('rechazar cookies opcionales mantiene Google Maps sin cargar', async ({ page }) => {
  await page.goto('/contacto')

  await expect(page.locator('.cookie-consent-card')).toBeVisible()
  await expect(page.locator('.contact-v2-map-card iframe')).toHaveCount(0)
  await expect(page.locator('.external-consent-placeholder')).toBeVisible()

  await page.getByRole('button', { name: 'Rechazar opcionales' }).click()
  await expect(page.locator('.cookie-consent-card')).toHaveCount(0)
  await expect(page.locator('.contact-v2-map-card iframe')).toHaveCount(0)
  await expect(page.locator('.external-consent-placeholder')).toBeVisible()
})

test('aceptar Preferencias permite cargar el mapa externo', async ({ page }) => {
  await page.goto('/contacto')

  await page.getByRole('button', { name: 'Configurar' }).click()
  await page.getByLabel('Preferencias').check()
  await page.getByRole('button', { name: 'Guardar selección' }).click()

  await expect(page.locator('.cookie-consent-card')).toHaveCount(0)
  await expect(page.locator('.contact-v2-map-card iframe')).toHaveCount(1)
  await expect(page.locator('.external-consent-placeholder')).toHaveCount(0)
})

test('el footer permite reabrir la configuración de cookies', async ({ page }) => {
  await page.goto('/programas')
  await page.getByRole('button', { name: 'Rechazar opcionales' }).click()

  await page.locator('.footer-cookie-settings').click()
  await expect(page.locator('.cookie-consent-card')).toBeVisible()
  await expect(page.getByText('Configura tus preferencias.')).toBeVisible()
})

test('WhatsApp usa número español internacional y mensaje administrable', async ({ page }) => {
  await page.goto('/programas')

  const whatsapp = page.locator('.public-whatsapp-button')
  await expect(whatsapp).toBeVisible()
  await expect(whatsapp).toHaveAttribute('href', /https:\/\/wa\.me\/34618218187\?text=Hola%20desde%20E2E/)
})

test('las rutas legales públicas existen y conservan el shell', async ({ page }) => {
  for (const path of ['/cookies', '/privacidad', '/aviso-legal']) {
    await page.goto(path)
    await expect(page.locator('.legal-page')).toBeVisible()
    await expect(page.locator('.site-header')).toBeVisible()
    await expect(page.locator('.site-footer')).toBeVisible()
  }
})
