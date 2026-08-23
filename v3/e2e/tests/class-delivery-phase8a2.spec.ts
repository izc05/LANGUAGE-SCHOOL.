import { expect, test, type Page } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

const credentials = {
  admin: { email: requiredEnv('E2E_ADMIN_EMAIL'), password: requiredEnv('E2E_ADMIN_PASSWORD') },
  teacher: { email: requiredEnv('E2E_TEACHER_EMAIL'), password: requiredEnv('E2E_TEACHER_PASSWORD') },
  student: { email: requiredEnv('E2E_STUDENT_EMAIL'), password: requiredEnv('E2E_STUDENT_PASSWORD') },
}

const legacyZoomJoinUrl = 'https://example.com/e2e-language-class'
const googleMeetJoinUrl = 'https://meet.google.com/abc-defg-hij'

async function login(page: Page, email: string, password: string, expectedPath: RegExp) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(expectedPath)
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/acceso$/)
}

async function openAdminClassroom(page: Page) {
  const adminNav = page.getByRole('navigation', { name: 'Menú de Administrador' })
  await adminNav.getByRole('link', { name: 'Aula online' }).click()
  await expect(page).toHaveURL(/\/admin\/aula-online$/)
  await expect(page.getByRole('heading', { name: 'Modalidad de las clases' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'E2E Speaking class' })).toBeVisible()
}

test('8A.2: Administración configura modalidad, Google Meet y el alumno recibe el acceso correcto', async ({ page }) => {
  await login(page, credentials.admin.email, credentials.admin.password, /\/admin$/)
  await openAdminClassroom(page)
  await expect(page.getByLabel('Lugar / aula')).toHaveValue('Aula E2E')

  await page.getByRole('radio', { name: /^Online/ }).check()
  await page.getByRole('button', { name: 'Guardar modalidad' }).click()
  await expect(page.getByText('Modalidad de la clase actualizada.')).toBeVisible()

  await page.getByRole('radio', { name: /^Híbrida/ }).check()
  await page.getByLabel('Lugar / aula').fill('Aula E2E')
  await page.getByLabel('Enlace de videoclase').fill(googleMeetJoinUrl)
  await page.getByRole('button', { name: 'Guardar modalidad' }).click()
  await expect(page.getByText('Modalidad de la clase actualizada.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Google Meet preparado' })).toBeVisible()
  await logout(page)

  await login(page, credentials.student.email, credentials.student.password, /\/alumno$/)
  const nextClass = page.locator('.campus-next-class')
  await expect(nextClass.getByText('E2E Speaking class')).toBeVisible()
  await expect(nextClass.getByText('Híbrida')).toBeVisible()
  await expect(nextClass.getByText('Aula E2E')).toBeVisible()
  const dashboardClassroomLink = nextClass.getByRole('link', { name: /Entrar al aula online/ })
  await expect(dashboardClassroomLink).toHaveAttribute('href', /\/alumno\/aula\//)
  await dashboardClassroomLink.click()
  await expect(page).toHaveURL(/\/alumno\/aula\//)
  await expect(page.getByText('GOOGLE MEET')).toBeVisible()
  await expect(page.getByRole('link', { name: /Entrar en Google Meet/ })).toHaveAttribute('href', googleMeetJoinUrl)
  await expect(page.getByText('Language School no necesita almacenar tu contraseña ni credenciales privadas de Google.')).toBeVisible()

  await page.getByRole('link', { name: /Volver a Mis clases/ }).click()
  await expect(page).toHaveURL(/\/alumno\/clases$/)
  const upcoming = page.locator('.student-class-list-delivery').first()
  await expect(upcoming.getByText('Híbrida')).toBeVisible()
  await expect(upcoming.getByText(/Aula E2E/)).toBeVisible()
  await expect(upcoming.getByRole('link', { name: /Entrar al aula online/ })).toHaveAttribute('href', /\/alumno\/aula\//)
  await logout(page)

  // Restore the seeded Zoom fallback so the later Zoom SDK tests keep their original fixture.
  await login(page, credentials.admin.email, credentials.admin.password, /\/admin$/)
  await openAdminClassroom(page)
  await page.getByLabel('Enlace de videoclase').fill(legacyZoomJoinUrl)
  await page.getByRole('button', { name: 'Guardar modalidad' }).click()
  await expect(page.getByText('Modalidad de la clase actualizada.')).toBeVisible()
  await logout(page)

  await login(page, credentials.teacher.email, credentials.teacher.password, /\/profesor$/)
  await page.getByRole('navigation', { name: 'Menú de Profesor' }).getByRole('link', { name: 'Clases' }).click()
  await expect(page.getByText('Modalidad', { exact: true })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Presencial' })).toBeAttached()
  await expect(page.getByRole('option', { name: 'Online' })).toBeAttached()
  await expect(page.getByRole('option', { name: 'Híbrida' })).toBeAttached()
  await logout(page)
})