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
  await login(page, requiredEnv('E2E_ADMIN_EMAIL'), requiredEnv('E2E_ADMIN_PASSWORD'), /\/admin$/)
  const nav = page.getByRole('navigation', { name: 'Menú de Administrador' })
  await nav.getByRole('link', { name: 'Sistema' }).click()
  await expect(page).toHaveURL(/\/admin\/sistema$/)
  await expect(page.getByRole('heading', { name: 'Estado de la plataforma' })).toBeVisible()
  await expect(page.getByText('Operativo')).toBeVisible()
  await expect(page.getByText('Connected')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('token')
  await expect(page.locator('body')).not.toContainText('password')
})

test('STUDENT no puede acceder al diagnóstico ADMIN', async ({ page }) => {
  await login(page, requiredEnv('E2E_STUDENT_EMAIL'), requiredEnv('E2E_STUDENT_PASSWORD'), /\/alumno$/)
  await page.goto('/admin/sistema')
  await expect(page).toHaveURL(/\/alumno$/)
})
