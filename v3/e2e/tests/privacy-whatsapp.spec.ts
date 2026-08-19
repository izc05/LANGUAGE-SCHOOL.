import { expect, test } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

async function loginAdmin(page: import('@playwright/test').Page) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(requiredEnv('E2E_ADMIN_EMAIL'))
  await page.getByLabel('Contraseña').fill(requiredEnv('E2E_ADMIN_PASSWORD'))
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

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

test('15A: WhatsApp usa número normalizado, mensaje administrable y botón móvil accesible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/programas')

  const whatsapp = page.locator('.public-whatsapp-button')
  await expect(whatsapp).toBeVisible()
  await expect(whatsapp).toHaveAttribute('href', /https:\/\/wa\.me\/34618218187\?text=Hola%20desde%20E2E/)
  await expect(whatsapp).toHaveAttribute('aria-label', /Escribir a .+ por WhatsApp/)
  await expect(whatsapp).toHaveAttribute('rel', /noopener noreferrer/)

  const box = await whatsapp.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.width).toBeGreaterThanOrEqual(52)
  expect(box!.height).toBeGreaterThanOrEqual(52)

  await whatsapp.focus()
  const outline = await whatsapp.evaluate((element) => getComputedStyle(element).outlineStyle)
  expect(outline).not.toBe('none')

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('15A: Admin valida, previsualiza y normaliza WhatsApp antes de publicarlo', async ({ page }) => {
  await loginAdmin(page)
  await page.goto('/admin/configuracion')

  const whatsappInput = page.getByPlaceholder('618 218 187 o +34 618 218 187')
  const messageInput = page.getByLabel('Mensaje inicial de WhatsApp')
  const enabledToggle = page.getByRole('checkbox', { name: /Botón flotante de WhatsApp/ })

  await whatsappInput.fill('618 218 187')
  await messageInput.fill('Hola desde E2E')

  const testLink = page.getByRole('link', { name: /Probar WhatsApp/ })
  await expect(testLink).toBeVisible()
  await expect(testLink).toHaveAttribute('href', 'https://wa.me/34618218187?text=Hola%20desde%20E2E')
  await expect(page.locator('.settings-whatsapp-preview')).toContainText('+34618218187')

  await enabledToggle.uncheck()
  await expect(page.locator('.settings-whatsapp-preview')).toContainText('Botón de WhatsApp desactivado')
  await enabledToggle.check()

  await whatsappInput.fill('12345')
  await page.getByRole('button', { name: 'Guardar configuración' }).click()
  await expect(page.getByRole('alert')).toContainText('Introduce un número de WhatsApp válido')

  await whatsappInput.fill('618 218 187')
  await messageInput.fill('Hola desde E2E')
  await page.getByRole('button', { name: 'Guardar configuración' }).click()
  await expect(page.getByRole('status')).toContainText('Configuración general guardada correctamente.')
  await expect(whatsappInput).toHaveValue('34618218187')
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

test('ADMIN configura identidad legal y se publica sin tocar código', async ({ page }) => {
  await loginAdmin(page)

  await page.goto('/admin/configuracion')
  await page.getByLabel('Titular / responsable legal').fill('E2E Academia Responsable')
  await page.getByLabel('NIF / CIF').fill('12345678Z')
  await page.getByLabel('Datos registrales, si procede').fill('Registro E2E · hoja 123')
  await page.getByRole('button', { name: 'Guardar configuración' }).click()
  await expect(page.getByRole('status')).toContainText('Configuración general guardada correctamente.')

  await page.goto('/aviso-legal')
  await expect(page.getByText('E2E Academia Responsable')).toBeVisible()
  await expect(page.getByText('12345678Z')).toBeVisible()
  await expect(page.getByText('Registro E2E · hoja 123')).toBeVisible()
  await expect(page.locator('.legal-completion-note')).toHaveCount(0)
})
