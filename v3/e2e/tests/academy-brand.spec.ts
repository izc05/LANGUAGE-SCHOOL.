import { expect, test, type Page } from '@playwright/test'

const academyName = 'E2E Language Academy'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

async function login(page: Page, email: string, password: string, expected: RegExp) {
  await page.goto('/acceso')
  await expect(page.locator('.auth-brand-panel .brand strong')).toHaveText(academyName)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(expected)
}

async function expectNoTechnicalBackendCopy(page: Page) {
  const body = page.locator('body')
  await expect(body).not.toContainText('PocketBase')
  await expect(body).not.toContainText('ClientResponseError')
  await expect(body).not.toContainText('Bearer ')
  await expect(body).not.toContainText('pb_data')
}

test('la identidad configurada se comparte entre web, acceso y portal', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.site-header .brand strong')).toHaveText(academyName)

  await login(page, requiredEnv('E2E_STUDENT_EMAIL'), requiredEnv('E2E_STUDENT_PASSWORD'), /\/alumno$/)
  await expect(page.locator('.dashboard-brand strong')).toHaveText(academyName)
  await expect(page.locator('.sidebar-footer')).toContainText('Sesión segura · acceso privado')
  await expectNoTechnicalBackendCopy(page)
})

test('el login conectado no expone tecnología interna al alumno', async ({ page }) => {
  await page.goto('/acceso')
  await expect(page.getByText('Acceso seguro a tu espacio privado.')).toBeVisible()
  await expectNoTechnicalBackendCopy(page)
})

test('los portales de Alumno y Profesor mantienen lenguaje de academia', async ({ page }) => {
  await login(page, requiredEnv('E2E_STUDENT_EMAIL'), requiredEnv('E2E_STUDENT_PASSWORD'), /\/alumno$/)
  for (const path of ['/alumno', '/alumno/clases', '/alumno/material', '/alumno/tareas', '/alumno/archivos', '/alumno/avisos', '/alumno/perfil']) {
    await page.goto(path)
    await expectNoTechnicalBackendCopy(page)
  }

  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await login(page, requiredEnv('E2E_TEACHER_EMAIL'), requiredEnv('E2E_TEACHER_PASSWORD'), /\/profesor$/)
  for (const path of ['/profesor', '/profesor/alumnos', '/profesor/clases', '/profesor/material', '/profesor/tareas', '/profesor/correcciones', '/profesor/perfil']) {
    await page.goto(path)
    await expectNoTechnicalBackendCopy(page)
  }
})
