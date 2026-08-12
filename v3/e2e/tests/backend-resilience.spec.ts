import { expect, test } from '@playwright/test'

test('la web pública mantiene contenido seguro si PocketBase deja de responder', async ({ page }) => {
  await page.route('**/api/**', (route) => route.abort('failed'))

  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('ClientResponseError')
  await expect(page.locator('body')).not.toContainText('ECONNREFUSED')

  await page.goto('/programas')
  await expect(page.getByRole('heading', { name: 'Encuentra el inglés que encaja contigo.' })).toBeVisible()
  await expect(page.getByText('Todavía no hay programas publicados. Escríbenos y te orientamos personalmente.')).toBeVisible()

  await page.goto('/tarifas')
  await expect(page.getByRole('heading', { name: 'Precios claros, sin letra pequeña.' })).toBeVisible()
  await expect(page.getByText('Todavía no hay tarifas publicadas. Contacta con la academia para recibir información actualizada.')).toBeVisible()

  await page.goto('/contacto')
  await expect(page.getByRole('heading', { name: 'Cuéntanos qué quieres conseguir.' })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('PocketBase')
})

test('un fallo al enviar contacto se comunica sin exponer detalles internos', async ({ page }) => {
  await page.route('**/api/**', (route) => route.abort('failed'))
  await page.goto('/contacto')

  await page.getByLabel('Nombre').fill('Visitante sin conexión')
  await page.getByLabel('Email').fill('offline@example.com')
  await page.getByLabel('Mensaje').fill('Quiero información, pero la API está simuladamente caída.')
  await page.getByRole('button', { name: 'Enviar solicitud' }).click()

  await expect(page.getByText('No se ha podido enviar la solicitud. Inténtalo de nuevo más tarde.')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('ClientResponseError')
})
