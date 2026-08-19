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

test('12.4: Admin gestiona expedientes y equipo docente con una interfaz usable en móvil', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(page)

  const nav = page.getByRole('navigation', { name: 'Menú de Administrador' })

  await nav.getByRole('link', { name: 'Alumnos' }).click()
  await expect(page).toHaveURL(/\/admin\/alumnos$/)
  await expect(page.getByRole('heading', { name: 'Alumnos y espacio privado' })).toBeVisible()

  const studentPage = page.locator('.cms-page').filter({ has: page.locator('.students-admin-layout') })
  await expect(studentPage.locator('.student-metrics article')).toHaveCount(4)
  await expect(studentPage.locator('.students-table')).toBeVisible()
  await expect(studentPage.locator('.student-detail-panel')).toContainText('FICHA DEL ALUMNO')
  await expect(studentPage.locator('.student-detail-panel')).toContainText('ESPACIO PRIVADO')

  const search = studentPage.locator('.student-search input')
  await search.fill('E2E Student')
  await expect(studentPage.locator('.students-table-row').filter({ hasText: 'E2E Student' })).toBeVisible()
  await search.fill('')

  await studentPage.getByRole('button', { name: '+ Nuevo alumno' }).click()
  const studentCreate = studentPage.locator('.admin-inline-create')
  await expect(studentCreate.getByRole('heading', { name: 'Nuevo alumno' })).toBeVisible()
  await expect(studentCreate.locator('input')).toHaveCount(5)
  await studentPage.getByRole('button', { name: 'Cerrar alta' }).click()
  await expect(studentCreate).toHaveCount(0)

  const studentDetail = studentPage.locator('.student-detail-panel')
  await studentDetail.getByRole('button', { name: 'Editar ficha' }).click()
  await expect(studentDetail.locator('.student-edit-form')).toBeVisible()
  await studentDetail.getByRole('button', { name: 'Cancelar' }).click()
  await expect(studentDetail.locator('.student-edit-form')).toHaveCount(0)

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoPageOverflow(page)
  const detailColumns = await studentPage.locator('.student-detail-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(detailColumns.trim().split(/\s+/)).toHaveLength(1)

  await page.setViewportSize({ width: 1440, height: 1000 })
  await nav.getByRole('link', { name: 'Profesores', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/profesores$/)
  await expect(page.getByRole('heading', { name: 'Equipo docente' })).toBeVisible()

  const teacherPage = page.locator('.cms-page').filter({ has: page.locator('.teacher-admin-grid') })
  await expect(teacherPage.locator(':scope > .metric-grid article')).toHaveCount(4)
  const teacherCard = teacherPage.locator('.teacher-admin-card').filter({ hasText: 'E2E Teacher' })
  await expect(teacherCard).toBeVisible()
  await expect(teacherCard).toContainText('Alumnos')
  await expect(teacherCard).toContainText('Clases')
  await expect(teacherCard.getByRole('button', { name: 'Eliminar' })).toBeVisible()

  await teacherCard.getByRole('button', { name: 'Editar ficha' }).click()
  await expect(teacherCard.locator('.teacher-edit-form')).toBeVisible()
  await teacherCard.getByRole('button', { name: 'Cancelar' }).click()
  await expect(teacherCard.locator('.teacher-edit-form')).toHaveCount(0)

  await teacherPage.getByRole('button', { name: '+ Nuevo profesor' }).click()
  const teacherCreate = teacherPage.locator('.admin-inline-create')
  await expect(teacherCreate.getByRole('heading', { name: 'Nuevo profesor' })).toBeVisible()
  await expect(teacherCreate.locator('input')).toHaveCount(6)
  await teacherPage.getByRole('button', { name: 'Cerrar alta' }).click()
  await expect(teacherCreate).toHaveCount(0)

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoPageOverflow(page)
  const teacherColumns = await teacherPage.locator('.teacher-admin-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(teacherColumns.trim().split(/\s+/)).toHaveLength(1)
})