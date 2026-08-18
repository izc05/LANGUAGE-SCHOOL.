import { expect, test, type Page } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

async function login(page: Page, email: string, password: string, expected: RegExp) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(expected)
}

test('ADMIN puede consultar el estado seguro de la plataforma', async ({ page }) => {
  const adminPassword = requiredEnv('E2E_ADMIN_PASSWORD')
  await login(page, requiredEnv('E2E_ADMIN_EMAIL'), adminPassword, /\/admin$/)
  const nav = page.getByRole('navigation', { name: 'Menú de Administrador' })
  await nav.getByRole('link', { name: 'Sistema' }).click()
  await expect(page).toHaveURL(/\/admin\/sistema$/)
  await expect(page.getByRole('heading', { name: 'Estado de la plataforma' })).toBeVisible()
  await expect(page.getByText('Operativo')).toBeVisible()
  await expect(page.locator('.system-status-checklist').getByText('Connected', { exact: true })).toBeVisible()
  await expect(page.getByTestId('system-zoom-status')).toContainText('ZOOM')
  await expect(page.getByTestId('system-placement-status')).toContainText('TEST DE NIVEL')
  await expect(page.getByTestId('system-placement-status')).toContainText('Publicado')
  await expect(page.locator('body')).not.toContainText(adminPassword)
  await expect(page.locator('body')).not.toContainText('Bearer ')
  await expect(page.locator('body')).not.toContainText('E2eSuperuserPass123!')
})

test('STUDENT no puede acceder al diagnóstico ADMIN', async ({ page }) => {
  await login(page, requiredEnv('E2E_STUDENT_EMAIL'), requiredEnv('E2E_STUDENT_PASSWORD'), /\/alumno$/)
  await page.goto('/admin/sistema')
  await expect(page).toHaveURL(/\/alumno$/)
})
