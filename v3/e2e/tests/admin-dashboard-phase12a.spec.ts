import { expect, test } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

const admin = {
  email: requiredEnv('E2E_ADMIN_EMAIL'),
  password: requiredEnv('E2E_ADMIN_PASSWORD'),
}

test('12.1: Dashboard Admin prioriza operación académica y conserva accesos clave', async ({ page }) => {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(admin.email)
  await page.getByLabel('Contraseña').fill(admin.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin$/)

  await expect(page.getByRole('heading', { name: 'Todo lo importante de la academia, en un solo lugar.' })).toBeVisible()

  const summary = page.getByRole('region', { name: 'Resumen de la academia' })
  await expect(summary).toContainText('Solicitudes nuevas')
  await expect(summary).toContainText('Alumnos activos')
  await expect(summary).toContainText('Profesores activos')
  await expect(summary.getByRole('link', { name: 'Gestionar alumnos →' })).toHaveAttribute('href', '/admin/alumnos')
  await expect(summary.getByRole('link', { name: 'Gestionar equipo →' })).toHaveAttribute('href', '/admin/profesores')

  const daily = page.locator('.admin-dashboard-priorities')
  await expect(daily.getByRole('heading', { name: 'Qué necesita atención' })).toBeVisible()
  await expect(daily.getByRole('link', { name: 'Abrir bandeja →' })).toHaveAttribute('href', '/admin/contactos')
  await expect(daily.getByRole('link', { name: 'Gestionar clases →' })).toHaveAttribute('href', '/admin/clases')
  await expect(daily.getByRole('link', { name: 'Ver alumnos →' })).toHaveAttribute('href', '/admin/alumnos')

  const content = page.locator('.admin-dashboard-content-tools')
  await expect(content.getByRole('link', { name: 'Abrir editor →' })).toHaveAttribute('href', '/admin/web')
  await expect(content.getByRole('link', { name: 'Ver artículos →' })).toHaveAttribute('href', '/admin/blog')
  await expect(content.getByRole('link', { name: 'Gestionar →' })).toHaveAttribute('href', '/admin/multimedia')

  await page.setViewportSize({ width: 390, height: 844 })
  const dashboardFits = await page.locator('.admin-dashboard-phase12a').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)
  expect(dashboardFits).toBe(true)
})