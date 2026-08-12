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

function collectRuntimeErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = message.text()
      if (!text.includes('favicon.ico')) errors.push(`console: ${text}`)
    }
  })
  return errors
}

async function visitRoutes(page: Page, routes: string[], errors: string[]) {
  for (const route of routes) {
    await page.goto(route)
    await expect(page.locator('#root')).not.toBeEmpty()
    await page.waitForTimeout(120)
  }
  expect(errors, errors.join('\n')).toEqual([])
}

test('todas las rutas públicas cargan sin errores runtime', async ({ page }) => {
  const errors = collectRuntimeErrors(page)
  await visitRoutes(page, [
    '/',
    '/programas',
    '/profesores',
    '/sobre-nosotros',
    '/tarifas',
    '/blog',
    '/contacto',
    '/acceso',
    '/pagina-inexistente-e2e',
  ], errors)
})

test('todas las rutas ADMIN cargan sin errores runtime', async ({ page }) => {
  const errors = collectRuntimeErrors(page)
  await login(page, requiredEnv('E2E_ADMIN_EMAIL'), requiredEnv('E2E_ADMIN_PASSWORD'), /\/admin$/)
  await visitRoutes(page, [
    '/admin',
    '/admin/web',
    '/admin/web/sobre-nosotros',
    '/admin/blog',
    '/admin/multimedia',
    '/admin/contactos',
    '/admin/avisos',
    '/admin/alumnos',
    '/admin/profesores',
    '/admin/profesores/publicos',
    '/admin/cursos',
    '/admin/clases',
    '/admin/tarifas',
    '/admin/configuracion',
  ], errors)
})

test('todas las rutas TEACHER cargan sin errores runtime', async ({ page }) => {
  const errors = collectRuntimeErrors(page)
  await login(page, requiredEnv('E2E_TEACHER_EMAIL'), requiredEnv('E2E_TEACHER_PASSWORD'), /\/profesor$/)
  await visitRoutes(page, [
    '/profesor',
    '/profesor/alumnos',
    '/profesor/clases',
    '/profesor/material',
    '/profesor/tareas',
    '/profesor/correcciones',
    '/profesor/perfil',
  ], errors)
})

test('todas las rutas STUDENT cargan sin errores runtime', async ({ page }) => {
  const errors = collectRuntimeErrors(page)
  await login(page, requiredEnv('E2E_STUDENT_EMAIL'), requiredEnv('E2E_STUDENT_PASSWORD'), /\/alumno$/)
  await visitRoutes(page, [
    '/alumno',
    '/alumno/clases',
    '/alumno/material',
    '/alumno/tareas',
    '/alumno/archivos',
    '/alumno/avisos',
    '/alumno/perfil',
  ], errors)
})
