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

test('14C: Admin usa directorios filtrables y fichas completas de Alumno y Profesor', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(page)

  const nav = page.getByRole('navigation', { name: 'Menú de Administrador' })

  await nav.getByRole('link', { name: 'Alumnos' }).click()
  await expect(page).toHaveURL(/\/admin\/alumnos$/)
  await expect(page.getByRole('heading', { name: 'Directorio de alumnos' })).toBeVisible()

  const studentPage = page.locator('.admin-student-directory-phase14')
  await expect(studentPage.locator('.phase14-metrics article')).toHaveCount(4)
  await expect(studentPage.locator('.phase14-filter-panel')).toBeVisible()
  await expect(studentPage.getByLabel('Curso')).toBeVisible()
  await expect(studentPage.getByLabel('Grupo / aula')).toBeVisible()
  await expect(studentPage.getByLabel('Nivel')).toBeVisible()
  await expect(studentPage.getByLabel('Profesor')).toBeVisible()
  await expect(studentPage.getByLabel('Modalidad')).toBeVisible()
  await expect(studentPage.getByLabel('Estado')).toBeVisible()

  const search = studentPage.getByLabel('Buscar')
  await search.fill('E2E Student')
  const studentRow = studentPage.locator('.phase14-student-row').filter({ hasText: 'E2E Student' }).first()
  await expect(studentRow).toBeVisible()
  await studentRow.click()
  await expect(page).toHaveURL(/\/admin\/alumnos\/[^/]+$/)

  const studentDetail = page.locator('.phase14-profile-page')
  await expect(studentDetail.getByText('FICHA DEL ALUMNO')).toBeVisible()
  await expect(studentDetail.getByRole('heading', { name: /E2E Student/ })).toBeVisible()
  await expect(studentDetail.getByRole('heading', { name: 'Matrícula y aprendizaje' })).toBeVisible()
  await expect(studentDetail.getByRole('heading', { name: 'Datos personales' })).toBeVisible()
  await expect(studentDetail.getByRole('heading', { name: 'Situación económica' })).toBeVisible()
  await expect(studentDetail.getByRole('heading', { name: 'Notas privadas' })).toBeVisible()
  await studentDetail.getByRole('button', { name: 'Editar ficha' }).click()
  await expect(studentDetail.getByRole('heading', { name: 'Completar ficha del alumno' })).toBeVisible()
  await expect(studentDetail.getByLabel('Fecha de nacimiento')).toBeVisible()
  await expect(studentDetail.getByLabel('Tutor/a')).toBeVisible()
  await expect(studentDetail.getByLabel('Teléfono tutor/a')).toBeVisible()
  await expect(studentDetail.getByLabel('Grupo / aula')).toBeVisible()
  await expect(studentDetail.getByLabel('Notas privadas')).toBeVisible()
  await studentDetail.getByRole('button', { name: 'Cancelar' }).click()

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(studentDetail.locator('.phase14-profile-hero')).toBeVisible()
  await expectNoPageOverflow(page)

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/admin/profesores')
  await expect(page.getByRole('heading', { name: 'Equipo docente' })).toBeVisible()

  const teacherPage = page.locator('.admin-teacher-directory-phase14')
  await expect(teacherPage.locator('.phase14-metrics article')).toHaveCount(4)
  const teacherSearch = teacherPage.getByLabel('Buscar')
  await teacherSearch.fill('E2E Teacher')
  const teacherCard = teacherPage.locator('.phase14-teacher-card').filter({ hasText: 'E2E Teacher' }).first()
  await expect(teacherCard).toBeVisible()
  await expect(teacherCard).toContainText('Alumnos')
  await expect(teacherCard).toContainText('Clases')
  await teacherCard.click()
  await expect(page).toHaveURL(/\/admin\/profesores\/[^/]+$/)

  const teacherDetail = page.locator('.phase14-profile-page')
  await expect(teacherDetail.getByText('FICHA DEL PROFESOR')).toBeVisible()
  await expect(teacherDetail.getByRole('heading', { name: 'Carga académica' })).toBeVisible()
  await expect(teacherDetail.getByRole('heading', { name: 'Datos docentes' })).toBeVisible()
  await expect(teacherDetail.getByRole('heading', { name: 'Grupos asignados' })).toBeVisible()
  await expect(teacherDetail.getByRole('heading', { name: 'Alumnos vinculados' })).toBeVisible()
  await teacherDetail.getByRole('button', { name: 'Editar ficha' }).click()
  await expect(teacherDetail.getByRole('heading', { name: 'Completar ficha del profesor' })).toBeVisible()
  await expect(teacherDetail.getByLabel('Nombre público')).toBeVisible()
  await expect(teacherDetail.getByLabel('Titular público')).toBeVisible()
  await expect(teacherDetail.getByLabel('Especialidades')).toBeVisible()
  await expect(teacherDetail.getByLabel('Biografía')).toBeVisible()
  await expect(teacherDetail.getByLabel('Mostrar perfil en la web pública')).toBeVisible()
  await teacherDetail.getByRole('button', { name: 'Cancelar' }).click()
  await expect(teacherDetail.getByRole('button', { name: 'Eliminar profesor' })).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(teacherDetail.locator('.phase14-profile-hero')).toBeVisible()
  await expectNoPageOverflow(page)
})

test('14C: las altas ampliadas mantienen datos personales y docentes sin comprimir la ficha', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(page)

  await page.goto('/admin/alumnos')
  const studentPage = page.locator('.admin-student-directory-phase14')
  await studentPage.getByRole('button', { name: '+ Nuevo alumno' }).click()
  const studentCreate = studentPage.locator('.phase14-create-card')
  await expect(studentCreate.getByRole('heading', { name: 'Nuevo alumno' })).toBeVisible()
  await expect(studentCreate.getByLabel('Fecha de nacimiento')).toBeVisible()
  await expect(studentCreate.getByLabel('Nombre tutor/a')).toBeVisible()
  await expect(studentCreate.getByLabel('Teléfono tutor/a')).toBeVisible()
  await studentPage.getByRole('button', { name: 'Cerrar alta' }).click()

  await page.goto('/admin/profesores')
  const teacherPage = page.locator('.admin-teacher-directory-phase14')
  await teacherPage.getByRole('button', { name: '+ Nuevo profesor' }).click()
  const teacherCreate = teacherPage.locator('.phase14-create-card')
  await expect(teacherCreate.getByRole('heading', { name: 'Nuevo profesor' })).toBeVisible()
  await expect(teacherCreate.getByLabel('Especialidades')).toBeVisible()
  await expect(teacherCreate.getByLabel('Bio docente')).toBeVisible()
  await teacherPage.getByRole('button', { name: 'Cerrar alta' }).click()

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoPageOverflow(page)
})
