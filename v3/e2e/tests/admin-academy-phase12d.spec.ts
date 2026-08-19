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

const admin = {
  email: requiredEnv('E2E_ADMIN_EMAIL'),
  password: requiredEnv('E2E_ADMIN_PASSWORD'),
}

async function login(page: import('@playwright/test').Page) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(admin.email)
  await page.getByLabel('Contraseña').fill(admin.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

test('12.4: Alumnos y Profesores conservan gestión académica con responsive real', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(page)

  const nav = page.getByRole('navigation', { name: 'Menú de Administrador' })

  await nav.getByRole('link', { name: 'Alumnos' }).click()
  await expect(page).toHaveURL(/\/admin\/alumnos$/)
  await expect(page.getByRole('heading', { name: 'Alumnos y espacio privado' })).toBeVisible()
  await expect(page.locator('.student-metrics article')).toHaveCount(4)
  await expect(page.getByLabel('Buscar alumno')).toBeVisible()
  await expect(page.locator('.filter-pills button')).toHaveText(['Todos', 'Activo', 'Pausado'])

  const studentLayout = page.locator('.students-admin-layout')
  const desktopStudentColumns = await studentLayout.evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(desktopStudentColumns.trim().split(/\s+/).length).toBeGreaterThan(1)

  const studentRows = page.locator('button.students-table-row')
  await expect(studentRows.first()).toBeVisible()
  await expect(page.locator('.student-detail-panel')).toBeVisible()

  await page.getByRole('button', { name: '+ Nuevo alumno' }).click()
  const studentCreate = page.locator('.cms-page:has(.students-admin-layout) .admin-inline-create')
  await expect(studentCreate.getByRole('heading', { name: 'Nuevo alumno' })).toBeVisible()
  await expect(studentCreate.locator('input')).toHaveCount(5)
  await page.getByRole('button', { name: 'Cerrar alta' }).click()
  await expect(studentCreate).toHaveCount(0)

  await page.setViewportSize({ width: 390, height: 844 })
  const mobileStudentRow = studentRows.first()
  const studentCardMetrics = await mobileStudentRow.evaluate((element) => {
    const box = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return {
      width: box.width,
      minWidth: style.minWidth,
      columns: style.gridTemplateColumns.trim().split(/\s+/).length,
    }
  })
  expect(studentCardMetrics.width).toBeLessThanOrEqual(390)
  expect(studentCardMetrics.minWidth).not.toBe('830px')
  expect(studentCardMetrics.columns).toBe(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  const studentTransition = await mobileStudentRow.evaluate((element) => getComputedStyle(element).transitionDuration)
  expect(studentTransition.split(',').every((value) => durationInMs(value) <= 0.01)).toBe(true)

  await page.setViewportSize({ width: 1440, height: 1000 })
  await nav.getByRole('link', { name: 'Profesores', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/profesores$/)
  await expect(page.getByRole('heading', { name: 'Equipo docente' })).toBeVisible()
  await expect(page.locator('.cms-page:has(.teacher-admin-grid) > .metric-grid article')).toHaveCount(4)

  const teacherCards = page.locator('.teacher-admin-card')
  await expect(teacherCards.first()).toBeVisible()
  await expect(teacherCards.first().getByRole('button', { name: 'Editar ficha' })).toBeVisible()
  await expect(teacherCards.first().getByRole('button', { name: /Desactivar|Activar/ })).toBeVisible()
  await expect(teacherCards.first().getByRole('button', { name: 'Eliminar' })).toBeVisible()

  await page.getByRole('button', { name: '+ Nuevo profesor' }).click()
  const teacherCreate = page.locator('.cms-page:has(.teacher-admin-grid) .admin-inline-create')
  await expect(teacherCreate.getByRole('heading', { name: 'Nuevo profesor' })).toBeVisible()
  await expect(teacherCreate.locator('input')).toHaveCount(6)
  await page.getByRole('button', { name: 'Cerrar alta' }).click()
  await expect(teacherCreate).toHaveCount(0)

  await page.setViewportSize({ width: 390, height: 844 })
  const teacherGridColumns = await page.locator('.teacher-admin-grid').evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length,
  )
  expect(teacherGridColumns).toBe(1)

  const teacherAction = teacherCards.first().getByRole('button', { name: 'Editar ficha' })
  const actionHeight = await teacherAction.evaluate((element) => element.getBoundingClientRect().height)
  expect(actionHeight).toBeGreaterThanOrEqual(44)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  const teacherTransition = await teacherAction.evaluate((element) => getComputedStyle(element).transitionDuration)
  expect(teacherTransition.split(',').every((value) => durationInMs(value) <= 0.01)).toBe(true)
})
