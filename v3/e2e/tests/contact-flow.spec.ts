import { expect, test } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

test('visitante envía solicitud protegida y ADMIN completa su seguimiento', async ({ page }) => {
  const adminEmail = requiredEnv('E2E_ADMIN_EMAIL')
  const adminPassword = requiredEnv('E2E_ADMIN_PASSWORD')
  const visitorName = 'E2E Contact Flow'

  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `window.turnstile={render:function(_container,options){setTimeout(function(){options.callback('XXXX.DUMMY.TOKEN.XXXX')},0);return 'e2e-contact-widget'},remove:function(){}};`,
    })
  })

  await page.goto('/contacto?interes=Seguimiento%20E2E')
  await page.getByLabel('Nombre').fill(visitorName)
  await page.getByLabel('Email').fill('contact-flow@example.com')
  await page.getByLabel('Teléfono').fill('611111111')
  await page.getByLabel('Mensaje').fill('Solicitud destinada a probar el circuito completo de seguimiento.')
  const submitButton = page.getByRole('button', { name: 'Enviar solicitud' })
  await expect(submitButton).toBeEnabled()
  await submitButton.click()
  await expect(page.getByText('Solicitud enviada. Nos pondremos en contacto contigo.')).toBeVisible()

  await page.goto('/acceso')
  await page.getByLabel('Email').fill(adminEmail)
  await page.getByLabel('Contraseña').fill(adminPassword)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByText('Solicitudes nuevas')).toBeVisible()

  const nav = page.getByRole('navigation', { name: 'Menú de Administrador' })
  await nav.getByRole('link', { name: 'Contactos' }).click()
  await expect(page).toHaveURL(/\/admin\/contactos$/)
  await expect(page.getByRole('heading', { name: 'Solicitudes de información' })).toBeVisible()

  let card = page.locator('article.contact-request-card').filter({ hasText: visitorName })
  await expect(card).toBeVisible()
  await expect(card.getByText('Nueva', { exact: true })).toBeVisible()

  await card.getByRole('button', { name: 'Marcar contactada' }).click()
  await expect(card.getByText('Contactada', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: /Contactadas/ }).click()
  card = page.locator('article.contact-request-card').filter({ hasText: visitorName })
  await expect(card).toBeVisible()

  await card.getByRole('button', { name: 'Cerrar solicitud' }).click()
  await page.getByRole('button', { name: /Cerradas/ }).click()
  card = page.locator('article.contact-request-card').filter({ hasText: visitorName })
  await expect(card).toBeVisible()
  await expect(card.getByText('Cerrada', { exact: true })).toBeVisible()
})
