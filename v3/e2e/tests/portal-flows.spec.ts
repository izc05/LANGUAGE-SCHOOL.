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

test('web pública y login cargan en modo conectado', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Language School').first()).toBeVisible()
  await page.goto('/acceso')
  await expect(page.getByText('Acceso protegido mediante PocketBase.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled()
})

test('programas, profesores y tarifas públicas consumen PocketBase real', async ({ page }) => {
  await page.goto('/programas')
  await expect(page.getByRole('heading', { name: 'Encuentra el inglés que encaja contigo.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'E2E English B1' })).toBeVisible()

  await page.goto('/profesores')
  await expect(page.getByRole('heading', { name: 'Aprender mejor empieza por sentirse acompañado.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'E2E Public Teacher' })).toBeVisible()
  await expect(page.getByText('English Teacher · B1 & Speaking')).toBeVisible()
  await expect(page.getByText('e2e-teacher@example.com')).toHaveCount(0)

  await page.goto('/tarifas')
  await expect(page.getByRole('heading', { name: 'Precios claros, sin letra pequeña.' })).toBeVisible()
  await expect(page.getByText('E2E Monthly')).toBeVisible()
  await expect(page.getByText('45 €')).toBeVisible()
})

test('formulario público registra una solicitud', async ({ page }) => {
  await page.goto('/contacto?interes=E2E%20English%20B1')
  await expect(page.getByRole('heading', { name: 'Cuéntanos qué quieres conseguir.' })).toBeVisible()
  await page.getByLabel('Nombre').fill('E2E Visitor')
  await page.getByLabel('Email').fill('visitor-e2e@example.com')
  await page.getByLabel('Teléfono').fill('600000000')
  await expect(page.getByLabel('Me interesa')).toHaveValue('E2E English B1')
  await page.getByLabel('Mensaje').fill('Quiero información sobre el programa de prueba.')
  await page.getByRole('button', { name: 'Enviar solicitud' }).click()
  await expect(page.getByText('Solicitud enviada. Nos pondremos en contacto contigo.')).toBeVisible()
})

test('ruta privada sin sesión redirige al acceso', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/acceso$/)
})

test('ADMIN navega por el CMS completo', async ({ page }) => {
  await login(page, credentials.admin.email, credentials.admin.password, /\/admin$/)
  await expect(page.getByRole('heading', { name: 'Hola, E2E Admin' })).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Menú de Administrador' })

  await nav.getByRole('link', { name: 'Alumnos' }).click()
  await expect(page).toHaveURL(/\/admin\/alumnos$/)

  await nav.getByRole('link', { name: 'Profesores web' }).click()
  await expect(page).toHaveURL(/\/admin\/profesores\/publicos$/)
  await expect(page.getByRole('heading', { name: 'Perfiles públicos del equipo' })).toBeVisible()
  await expect(page.getByDisplayValue('E2E Public Teacher')).toBeVisible()

  await nav.getByRole('link', { name: 'Tarifas' }).click()
  await expect(page).toHaveURL(/\/admin\/tarifas$/)
  await expect(page.getByRole('heading', { name: 'Planes y precios' })).toBeVisible()

  await nav.getByRole('link', { name: 'Configuración' }).click()
  await expect(page).toHaveURL(/\/admin\/configuracion$/)
  await expect(page.getByRole('heading', { name: 'Identidad y contacto' })).toBeVisible()
  await logout(page)
})

test('TEACHER permanece en su ámbito', async ({ page }) => {
  await login(page, credentials.teacher.email, credentials.teacher.password, /\/profesor$/)
  await expect(page.getByRole('heading', { name: 'Hola, E2E Teacher' })).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Menú de Profesor' })
  await nav.getByRole('link', { name: 'Mis alumnos' }).click()
  await expect(page).toHaveURL(/\/profesor\/alumnos$/)
  await nav.getByRole('link', { name: 'Clases' }).click()
  await expect(page).toHaveURL(/\/profesor\/clases$/)
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/profesor$/)
  await logout(page)
})

test('STUDENT navega y no puede entrar en otros portales', async ({ page }) => {
  await login(page, credentials.student.email, credentials.student.password, /\/alumno$/)
  await expect(page.getByRole('heading', { name: 'Hola, E2E Student' })).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Menú de Alumno' })

  await nav.getByRole('link', { name: 'Mis clases' }).click()
  await expect(page).toHaveURL(/\/alumno\/clases$/)
  await nav.getByRole('link', { name: 'Material' }).click()
  await expect(page).toHaveURL(/\/alumno\/material$/)
  await nav.getByRole('link', { name: 'Tareas' }).click()
  await expect(page).toHaveURL(/\/alumno\/tareas$/)
  await nav.getByRole('link', { name: 'Mis archivos' }).click()
  await expect(page).toHaveURL(/\/alumno\/archivos$/)
  await nav.getByRole('link', { name: 'Avisos' }).click()
  await expect(page).toHaveURL(/\/alumno\/avisos$/)

  await page.goto('/admin')
  await expect(page).toHaveURL(/\/alumno$/)
  await page.goto('/profesor')
  await expect(page).toHaveURL(/\/alumno$/)
  await logout(page)
})

test('portada móvil sin scroll horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByText('Language School').first()).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
