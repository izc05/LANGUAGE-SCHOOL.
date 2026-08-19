import { expect, test, type Page } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

async function login(page: Page) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(requiredEnv('E2E_TEACHER_EMAIL'))
  await page.getByLabel('Contraseña').fill(requiredEnv('E2E_TEACHER_PASSWORD'))
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/profesor$/)
}

test('11.5: profesor publica material en su ámbito, ve el destino y puede eliminarlo', async ({ page }) => {
  await login(page)
  await page.goto('/profesor/material')

  await expect(page.getByRole('heading', { name: 'Material', level: 2 })).toBeVisible()
  await expect(page.getByText('Ámbito protegido')).toBeVisible()

  const destination = page.getByLabel('Destino')
  await expect(destination).toBeEnabled()
  const destinationLabel = (await destination.locator('option').first().textContent())?.trim() || ''
  expect(destinationLabel).toMatch(/^(Grupo|Alumno) · /)

  const title = `E2E Material 11.5 ${Date.now()}`
  const description = 'Recurso de prueba publicado desde el flujo real del profesor.'

  await page.getByLabel('Título').fill(title)
  await page.getByLabel('Descripción').fill(description)
  await page.locator('.teacher-material-dropzone input[type="file"]').setInputFiles({
    name: 'material-fase11e.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% Language School E2E material\n'),
  })
  await page.getByRole('button', { name: 'Publicar material' }).click()

  await expect(page.getByRole('status')).toContainText('Material publicado correctamente.')
  const record = page.locator('.teacher-material-record').filter({ hasText: title })
  await expect(record).toBeVisible()
  await expect(record).toContainText(destinationLabel)
  await expect(record).toContainText(description)
  await expect(record.getByRole('button', { name: 'Abrir' })).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)

  page.once('dialog', (dialog) => dialog.accept())
  await record.getByRole('button', { name: 'Eliminar' }).click()
  await expect(page.getByRole('status')).toContainText('Material eliminado.')
  await expect(page.locator('.teacher-material-record').filter({ hasText: title })).toHaveCount(0)
})
