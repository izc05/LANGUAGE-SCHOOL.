import { expect, test } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

function durationInMs(value: string): number {
  const normalized = value.trim()
  const amount = Number.parseFloat(normalized)
  return normalized.endsWith('ms') ? amount : amount * 1000
}

const admin = { email: requiredEnv('E2E_ADMIN_EMAIL'), password: requiredEnv('E2E_ADMIN_PASSWORD') }

async function login(page: import('@playwright/test').Page) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(admin.email)
  await page.getByLabel('Contraseña').fill(admin.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

async function expectNoPageOverflow(page: import('@playwright/test').Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
}

test('14C: Alumnos y Profesores conservan gestión académica con directorios responsive', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(page)
  const nav = page.getByRole('navigation', { name: 'Menú de Administrador' })

  await nav.getByRole('link', { name: 'Alumnos' }).click()
  await expect(page).toHaveURL(/\/admin\/alumnos$/)
  await expect(page.getByRole('heading', { name: 'Directorio de alumnos' })).toBeVisible()
  const studentPage = page.locator('.admin-student-directory-phase14')
  await expect(studentPage.locator('.phase14-metrics article')).toHaveCount(4)
  const filters = studentPage.getByLabel('Filtros de alumnos')
  await expect(filters).toBeVisible()
  await expect(filters.getByLabel('Buscar')).toBeVisible()
  await expect(filters.getByLabel('Curso')).toBeVisible()
  await expect(filters.getByLabel('Grupo / aula')).toBeVisible()
  await expect(filters.getByLabel('Nivel')).toBeVisible()
  await expect(filters.getByLabel('Profesor')).toBeVisible()
  await expect(filters.getByLabel('Modalidad')).toBeVisible()
  await expect(filters.getByLabel('Estado')).toBeVisible()

  const studentRows = studentPage.locator('.phase14-student-row:not(.phase14-student-header)')
  await expect(studentRows.first()).toBeVisible()
  await expect(studentRows.first()).toHaveAttribute('href', /\/admin\/alumnos\/[^/]+$/)
  await studentPage.getByRole('button', { name: '+ Nuevo alumno' }).click()
  const studentCreate = studentPage.locator('.student-onboarding-card')
  await expect(studentCreate.getByRole('heading', { name: 'Nuevo alumno' })).toBeVisible()
  await expect(studentCreate.getByLabel('Fecha de nacimiento')).toBeVisible()
  await expect(studentCreate.getByText('Sin contraseña inicial')).toBeVisible()
  await expect(studentCreate.getByLabel('Contraseña inicial')).toHaveCount(0)
  await studentPage.getByRole('button', { name: 'Cerrar alta' }).click()
  await expect(studentCreate).toHaveCount(0)

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoPageOverflow(page)
  const tableOverflow = await studentPage.locator('.phase14-student-table').evaluate((element) => getComputedStyle(element).overflowX)
  expect(['auto', 'scroll']).toContain(tableOverflow)
  expect(await studentRows.first().evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(40)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const studentTransition = await studentRows.first().evaluate((element) => getComputedStyle(element).transitionDuration)
  expect(studentTransition.split(',').every((value) => durationInMs(value) <= 0.01)).toBe(true)

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/admin/profesores')
  await expect(page.getByRole('heading', { name: 'Equipo docente' })).toBeVisible()
  const teacherPage = page.locator('.admin-teacher-directory-phase14')
  await expect(teacherPage.locator('.phase14-metrics article')).toHaveCount(4)
  await expect(teacherPage.getByLabel('Buscar')).toBeVisible()
  await expect(teacherPage.getByLabel('Estado')).toBeVisible()

  const teacherCards = teacherPage.locator('.phase14-teacher-card')
  await expect(teacherCards.first()).toBeVisible()
  await expect(teacherCards.first()).toHaveAttribute('href', /\/admin\/profesores\/[^/]+$/)
  await expect(teacherCards.first()).toContainText('Abrir ficha completa')

  await teacherPage.getByRole('button', { name: '+ Nuevo profesor' }).click()
  const teacherCreate = teacherPage.locator('.phase14-create-card')
  await expect(teacherCreate.getByRole('heading', { name: 'Nuevo profesor' })).toBeVisible()
  await expect(teacherCreate.locator('input')).toHaveCount(5)
  await expect(teacherCreate.getByLabel('Bio docente')).toBeVisible()
  await teacherPage.getByRole('button', { name: 'Cerrar alta' }).click()
  await expect(teacherCreate).toHaveCount(0)

  await page.setViewportSize({ width: 390, height: 844 })
  const teacherGridColumns = await teacherPage.locator('.phase14-teacher-grid').evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length,
  )
  expect(teacherGridColumns).toBe(1)
  expect(await teacherCards.first().evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
  await expectNoPageOverflow(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const teacherTransition = await teacherCards.first().evaluate((element) => getComputedStyle(element).transitionDuration)
  expect(teacherTransition.split(',').every((value) => durationInMs(value) <= 0.01)).toBe(true)
})
