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

  await page.getByRole('button', { name: 'Configurar', exact: true }).click()
  await page.getByRole('checkbox', { name: /^Preferencias/ }).check()
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

test('contacto muestra información básica de privacidad junto al formulario', async ({ page }) => {
  await page.goto('/contacto')
  const notice = page.locator('.contact-privacy-layer')
  await expect(notice).toBeVisible()
  await expect(notice).toContainText('Responsable:')
  await expect(notice).toContainText('Finalidad:')
  await expect(notice).toContainText('Base:')
  await expect(notice.getByRole('link', { name: /Política de privacidad completa/ })).toHaveAttribute('href', '/privacidad')
})

test('las rutas legales públicas contienen información estructurada y conservan el shell', async ({ page }) => {
  await page.goto('/cookies')
  await expect(page.locator('.legal-page')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Categorías disponibles' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Google Maps y terceros' })).toBeVisible()
  await expect(page.locator('.site-header')).toBeVisible()
  await expect(page.locator('.site-footer')).toBeVisible()

  await page.goto('/privacidad')
  await expect(page.getByRole('heading', { name: 'Responsable del tratamiento' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Finalidades y bases jurídicas' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Derechos' })).toBeVisible()

  await page.goto('/aviso-legal')
  await expect(page.getByRole('heading', { name: 'Identificación del titular' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Condiciones de uso' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Legislación aplicable' })).toBeVisible()
})
