import { expect, test, type Page } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

const adminEmail = requiredEnv('E2E_ADMIN_EMAIL')
const adminPassword = requiredEnv('E2E_ADMIN_PASSWORD')
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')

async function loginAdmin(page: Page) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(adminEmail)
  await page.getByLabel('Contraseña').fill(adminPassword)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

async function publishImages(page: Page) {
  await page.getByRole('button', { name: 'Publicar cambios de imágenes' }).click()
  await expect(page.getByRole('status')).toContainText('Portada e imágenes publicadas correctamente.')
}

async function expectNoHorizontalPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

test('CMS de imágenes permite subir, recuperar fallo, persistir, reutilizar y quitar', async ({ page }) => {
  await loginAdmin(page)
  await page.goto('/admin/web')
  await expect(page.getByRole('heading', { name: 'Editar web pública' })).toBeVisible()

  let card = page.locator('[data-image-slot="kidsMediaId"]')
  await expect(card).toBeVisible()

  await page.route('**/api/collections/*/records', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'forced upload failure' }) })
      return
    }
    await route.continue()
  })

  await card.getByLabel('Subir/Cambiar imagen: Kids').setInputFiles({
    name: 'e2e-kids-failure.png',
    mimeType: 'image/png',
    buffer: tinyPng,
  })
  await expect(card.getByRole('alert')).toContainText('No se ha podido subir la imagen')
  await expect(card.getByLabel('Subir/Cambiar imagen: Kids')).toBeEnabled()
  await page.unroute('**/api/collections/*/records')

  await card.getByLabel('Subir/Cambiar imagen: Kids').setInputFiles({
    name: 'e2e-kids-cms.png',
    mimeType: 'image/png',
    buffer: tinyPng,
  })
  await expect(card.getByRole('status')).toContainText('Imagen subida a Multimedia y seleccionada')
  await expect(card).toHaveAttribute('data-selected', 'true')
  await expect(card.locator('.cms-image-picker-preview')).toHaveAttribute('style', /background-image/)

  await publishImages(page)
  await page.reload()
  card = page.locator('[data-image-slot="kidsMediaId"]')
  await expect(card).toHaveAttribute('data-selected', 'true')
  await expect(card.getByRole('button', { name: 'Quitar imagen' })).toBeVisible()

  await card.getByRole('button', { name: 'Quitar imagen' }).click()
  await expect(card).toHaveAttribute('data-selected', 'false')
  await expect(card.getByText('Visual premium automático')).toBeVisible()

  await card.getByRole('button', { name: 'Elegir de Multimedia' }).click()
  await card.getByLabel('Elegir imagen existente para Kids').selectOption({ label: 'e2e-kids-cms.png' })
  await expect(card).toHaveAttribute('data-selected', 'true')
  await expect(card.getByRole('status')).toContainText('Imagen de Multimedia seleccionada')

  await publishImages(page)
  await page.reload()
  card = page.locator('[data-image-slot="kidsMediaId"]')
  await expect(card).toHaveAttribute('data-selected', 'true')

  await card.getByRole('button', { name: 'Quitar imagen' }).click()
  await publishImages(page)
  await page.reload()
  card = page.locator('[data-image-slot="kidsMediaId"]')
  await expect(card).toHaveAttribute('data-selected', 'false')
  await expect(card.getByText('Visual premium automático')).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(card.getByLabel('Subir/Cambiar imagen: Kids')).toBeEnabled()
  await expect(card.getByRole('button', { name: 'Elegir de Multimedia' })).toBeVisible()
  await expectNoHorizontalPageOverflow(page)
})
