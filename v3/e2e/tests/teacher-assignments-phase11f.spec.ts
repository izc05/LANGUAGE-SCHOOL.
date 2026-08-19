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

function futureLocalDate(): string {
  const date = new Date(Date.now() + 26 * 60 * 60 * 1000)
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return shifted.toISOString().slice(0, 16)
}

async function removeRecord(page: Page, title: string) {
  const record = page.locator('.teacher-assignment-record').filter({ hasText: title })
  await record.getByRole('button', { name: 'Eliminar' }).click()
  await expect(record.getByRole('button', { name: 'Confirmar eliminación' })).toBeVisible()
  await record.getByRole('button', { name: 'Confirmar eliminación' }).click()
  await expect(page.locator('.cms-notice.success-notice').filter({ hasText: 'Tarea eliminada.' })).toBeVisible()
  await expect(page.locator('.teacher-assignment-record').filter({ hasText: title })).toHaveCount(0)
}

test('11.6: profesor prepara borrador, publica, cierra y reabre tareas dentro de su ámbito', async ({ page }) => {
  await login(page)
  await page.goto('/profesor/tareas')

  await expect(page.getByRole('heading', { name: 'Tareas', level: 2 })).toBeVisible()
  await expect(page.getByText('Ámbito protegido')).toBeVisible()

  const destination = page.getByLabel('Destino')
  await expect(destination).toBeEnabled()
  const destinationLabel = (await destination.locator('option').first().textContent())?.trim() || ''
  expect(destinationLabel).toMatch(/^(Grupo|Alumno) · /)

  const draftTitle = `E2E Borrador 11.6 ${Date.now()}`
  await page.getByLabel('Título').fill(draftTitle)
  await page.getByLabel('Instrucciones').fill('Actividad todavía en preparación.')
  await page.getByLabel('Guardar como borrador antes de publicar').check()
  await page.getByRole('button', { name: 'Guardar borrador' }).click()
  await expect(page.getByRole('status')).toContainText('Borrador guardado.')

  const draftRecord = page.locator('.teacher-assignment-record').filter({ hasText: draftTitle })
  await expect(draftRecord).toBeVisible()
  await expect(draftRecord).toContainText('Borrador')
  await expect(draftRecord).toContainText(destinationLabel)
  await expect(draftRecord.getByRole('button', { name: 'Cerrar' })).toHaveCount(0)
  await removeRecord(page, draftTitle)

  await page.getByLabel('Guardar como borrador antes de publicar').uncheck()
  const publishedTitle = `E2E Tarea 11.6 ${Date.now()}`
  await page.getByLabel('Título').fill(publishedTitle)
  await page.getByLabel('Instrucciones').fill('Completa la actividad y entrégala antes de la fecha indicada.')
  await page.getByLabel('Fecha límite').fill(futureLocalDate())
  await page.getByRole('button', { name: 'Publicar tarea' }).click()
  await expect(page.getByRole('status')).toContainText('Tarea publicada correctamente.')

  const publishedRecord = page.locator('.teacher-assignment-record').filter({ hasText: publishedTitle })
  await expect(publishedRecord).toBeVisible()
  await expect(publishedRecord).toContainText('Publicada')
  await expect(publishedRecord).toContainText(destinationLabel)
  await expect(publishedRecord).toContainText('Fecha límite')

  await publishedRecord.getByRole('button', { name: 'Cerrar' }).click()
  await expect(publishedRecord).toContainText('Cerrada')
  await expect(publishedRecord.getByRole('button', { name: 'Reabrir' })).toBeVisible()

  await publishedRecord.getByRole('button', { name: 'Reabrir' }).click()
  await expect(publishedRecord).toContainText('Publicada')
  await expect(publishedRecord.getByRole('button', { name: 'Cerrar' })).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)

  await removeRecord(page, publishedTitle)
})
