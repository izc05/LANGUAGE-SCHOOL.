import { expect, test, type Page } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

async function loginStudentReduced(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(requiredEnv('E2E_STUDENT_EMAIL'))
  await page.getByLabel('Contraseña').fill(requiredEnv('E2E_STUDENT_PASSWORD'))
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/alumno$/)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
}

async function enterClassroomWithPortal(page: Page, link: import('@playwright/test').Locator, origin: RegExp) {
  const href = await link.getAttribute('href')
  expect(href).toMatch(/^\/alumno\/aula\//)
  if (!href) throw new Error('Student classroom link is missing its href')

  await link.click()
  await expect(page.locator('.cloud-portal-transition')).toBeVisible({ timeout: 5000 })
  await expect(page).toHaveURL(origin)
  await expect(page.locator('.cloud-portal-transition')).toHaveCount(1)

  await expect(page).toHaveURL(new RegExp(`${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), { timeout: 5000 })
  await expect(page.locator('.cloud-portal-transition')).toHaveCount(0, { timeout: 5000 })
  await expect(page.getByRole('heading', { level: 1, name: 'E2E Speaking class' })).toBeVisible()
}

test('17E: el acceso al aula desde Inicio usa el portal durante el whiteout', async ({ page }) => {
  await loginStudentReduced(page)
  const dashboardEntry = page.locator('.campus-online-entry')
  await expect(dashboardEntry).toBeVisible()
  await enterClassroomWithPortal(page, dashboardEntry, /\/alumno$/)
})

test('17E: el acceso al aula desde Mis clases usa el mismo portal', async ({ page }) => {
  await loginStudentReduced(page)
  await page.goto('/alumno/clases')
  await expect(page.getByRole('heading', { name: 'Mis clases' })).toBeVisible()

  const classesEntry = page.getByRole('link', { name: /Entrar al aula online/ }).first()
  await expect(classesEntry).toBeVisible()
  await enterClassroomWithPortal(page, classesEntry, /\/alumno\/clases$/)
})

test('17E: navegación interna ordinaria del Campus no dispara nubes', async ({ page }) => {
  await loginStudentReduced(page)
  await page.emulateMedia({ reducedMotion: 'no-preference' })

  await page.getByRole('navigation', { name: 'Menú de Alumno' }).getByRole('link', { name: 'Mis clases' }).click()
  await expect(page).toHaveURL(/\/alumno\/clases$/)
  await expect(page.locator('.cloud-portal-transition')).toHaveCount(0)
})
