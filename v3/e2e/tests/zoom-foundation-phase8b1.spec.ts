import { expect, test, type Page } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

const credentials = {
  admin: { email: requiredEnv('E2E_ADMIN_EMAIL'), password: requiredEnv('E2E_ADMIN_PASSWORD') },
  teacher: { email: requiredEnv('E2E_TEACHER_EMAIL'), password: requiredEnv('E2E_TEACHER_PASSWORD') },
}

async function login(page: Page, email: string, password: string, expectedPath: RegExp) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(expectedPath)
}

async function backendZoomStatus(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const stored = JSON.parse(localStorage.getItem('pocketbase_auth') || '{}') as { token?: string }
    const response = await fetch('http://127.0.0.1:8090/api/language-school/zoom/status', {
      headers: stored.token ? { Authorization: stored.token } : {},
    })
    return response.status
  })
}

test('8B.1: estado Zoom es server-side y solo Administración puede consultarlo', async ({ page, request }) => {
  const anonymous = await request.get('http://127.0.0.1:8090/api/language-school/zoom/status')
  expect(anonymous.status()).toBe(401)

  await login(page, credentials.teacher.email, credentials.teacher.password, /\/profesor$/)
  expect(await backendZoomStatus(page)).toBe(403)

  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/acceso$/)

  await login(page, credentials.admin.email, credentials.admin.password, /\/admin$/)
  const nav = page.getByRole('navigation', { name: 'Menú de Administrador' })
  await nav.getByRole('link', { name: 'Zoom', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/zoom$/)
  await expect(page.getByRole('heading', { name: 'Integración con Zoom' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Credenciales de Zoom pendientes.' })).toBeVisible()
  await expect(page.getByText('ZOOM API', { exact: true })).toBeVisible()
  await expect(page.getByText('MEETING SDK', { exact: true })).toBeVisible()
  await expect(page.getByText('Client Secret', { exact: false })).toHaveCount(0)
})
