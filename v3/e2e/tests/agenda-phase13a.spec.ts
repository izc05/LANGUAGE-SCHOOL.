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

async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

async function expectCalendar(page: Page) {
  await expect(page.locator('.monthly-class-calendar')).toBeVisible()
  await expect(page.locator('.calendar-day')).toHaveCount(42)
  await expect(page.getByRole('button', { name: 'Mes anterior' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mes siguiente' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hoy', exact: true })).toBeVisible()
}

test('13A: Profesor consulta un mes completo y su agenda sigue legible en desktop y móvil', async ({ page }) => {
  await login(page, requiredEnv('E2E_TEACHER_EMAIL'), requiredEnv('E2E_TEACHER_PASSWORD'), /\/profesor$/)

  for (const viewport of [{ width: 1440, height: 1000 }, { width: 820, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/profesor/agenda')
    await expect(page.getByRole('heading', { name: 'Agenda', exact: true })).toBeVisible()
    await expectCalendar(page)
    await expect(page.getByRole('navigation', { name: 'Menú de Profesor' }).getByRole('link', { name: 'Agenda' })).toHaveClass(/active/)
    await expectNoOverflow(page)
  }

  await page.goto('/admin/agenda')
  await expect(page).toHaveURL(/\/profesor$/)
})

test('13A: Admin consulta calendario global y puede filtrar sin alterar las clases', async ({ page }) => {
  await login(page, requiredEnv('E2E_ADMIN_EMAIL'), requiredEnv('E2E_ADMIN_PASSWORD'), /\/admin$/)

  for (const viewport of [{ width: 1440, height: 1000 }, { width: 820, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/admin/agenda')
    await expect(page.getByRole('heading', { name: 'Agenda mensual' })).toBeVisible()
    await expectCalendar(page)
    await expect(page.getByLabel('Filtros de agenda')).toBeVisible()
    await expect(page.getByLabel('Profesor')).toBeVisible()
    await expect(page.getByLabel('Grupo')).toBeVisible()
    await expect(page.getByLabel('Estado')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Menú de Administrador' }).getByRole('link', { name: 'Agenda' })).toHaveAttribute('aria-current', 'page')
    await expectNoOverflow(page)
  }
})
