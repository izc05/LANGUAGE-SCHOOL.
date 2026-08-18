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

async function backendRequest(page: Page, path: string, method: 'GET' | 'POST' = 'GET') {
  return page.evaluate(async ({ path, method }) => {
    const stored = JSON.parse(localStorage.getItem('pocketbase_auth') || '{}') as { token?: string }
    const response = await fetch(`http://127.0.0.1:8090${path}`, {
      method,
      headers: stored.token ? { Authorization: stored.token } : {},
    })
    let responseBody: unknown = null
    try { responseBody = await response.json() } catch { responseBody = null }
    return { status: response.status, body: responseBody }
  }, { path, method })
}

test('8B: Zoom permanece server-side y solo Administración puede comprobarlo', async ({ page, request }) => {
  const anonymousStatus = await request.get('http://127.0.0.1:8090/api/language-school/zoom/status')
  expect(anonymousStatus.status()).toBe(401)
  const anonymousCheck = await request.post('http://127.0.0.1:8090/api/language-school/zoom/check')
  expect(anonymousCheck.status()).toBe(401)

  await login(page, credentials.teacher.email, credentials.teacher.password, /\/profesor$/)
  expect((await backendRequest(page, '/api/language-school/zoom/status')).status).toBe(403)
  expect((await backendRequest(page, '/api/language-school/zoom/check', 'POST')).status).toBe(403)
  await logout(page)

  await login(page, credentials.admin.email, credentials.admin.password, /\/admin$/)
  const adminCheck = await backendRequest(page, '/api/language-school/zoom/check', 'POST')
  expect(adminCheck.status).toBe(200)
  expect(adminCheck.body).toMatchObject({ provider: 'zoom', configured: false, connected: false, reason: 'missing_credentials' })

  const nav = page.getByRole('navigation', { name: 'Menú de Administrador' })
  await nav.getByRole('link', { name: 'Zoom', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/zoom$/)
  await expect(page.getByRole('heading', { name: 'Integración con Zoom' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Configuración de Zoom pendiente.' })).toBeVisible()
  await expect(page.getByText('ZOOM API', { exact: true })).toBeVisible()
  await expect(page.getByText('ANFITRIÓN', { exact: true })).toBeVisible()
  await expect(page.getByText('CREAR REUNIONES', { exact: true })).toBeVisible()
  await expect(page.getByText('MEETING SDK', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Añade primero las credenciales' })).toBeDisabled()
  await expect(page.getByText('Client Secret', { exact: false })).toHaveCount(0)
  await expect(page.getByText('access_token', { exact: false })).toHaveCount(0)
})

test('8C.1: la asociación Zoom existe pero queda oculta al alumno', async ({ page }) => {
  await login(page, credentials.student.email, credentials.student.password, /\/alumno$/)
  const studentResult = await backendRequest(page, '/api/collections/zoom_meetings/records?page=1&perPage=5')
  expect(studentResult.status).toBe(200)
  expect(studentResult.body).toMatchObject({ items: [] })
  await logout(page)

  await login(page, credentials.admin.email, credentials.admin.password, /\/admin$/)
  const adminResult = await backendRequest(page, '/api/collections/zoom_meetings/records?page=1&perPage=5')
  expect(adminResult.status).toBe(200)
  expect(adminResult.body).toMatchObject({ totalItems: 1 })
  expect(JSON.stringify(adminResult.body)).toContain('98765432100')
})

test('8C.2: crear Zoom es idempotente, restringido y no expone datos de host', async ({ page, request }) => {
  const anonymousCreate = await request.post('http://127.0.0.1:8090/api/language-school/zoom/classes/fake/meeting')
  expect(anonymousCreate.status()).toBe(401)

  await login(page, credentials.teacher.email, credentials.teacher.password, /\/profesor$/)
  const teacherClasses = await backendRequest(page, '/api/collections/classes/records?page=1&perPage=1')
  const teacherClassId = (teacherClasses.body as { items?: Array<{ id?: string }> })?.items?.[0]?.id
  expect(teacherClassId).toBeTruthy()
  const forbiddenCreate = await backendRequest(page, `/api/language-school/zoom/classes/${encodeURIComponent(String(teacherClassId))}/meeting`, 'POST')
  expect(forbiddenCreate.status).toBe(403)
  await logout(page)

  await login(page, credentials.admin.email, credentials.admin.password, /\/admin$/)
  const meetings = await backendRequest(page, '/api/collections/zoom_meetings/records?page=1&perPage=5')
  expect(meetings.status).toBe(200)
  const meeting = (meetings.body as { items?: Array<{ class?: string; external_meeting_id?: string }> })?.items?.find((item) => item.external_meeting_id === '98765432100')
  const classId = meeting?.class
  expect(classId).toBeTruthy()

  const createResult = await backendRequest(page, `/api/language-school/zoom/classes/${encodeURIComponent(String(classId))}/meeting`, 'POST')
  expect(createResult.status, JSON.stringify(createResult.body)).toBe(200)
  expect(createResult.body).toMatchObject({ provider: 'zoom', existing: true, status: 'READY', externalMeetingId: '98765432100' })
  const safePayload = JSON.stringify(createResult.body)
  expect(safePayload).not.toContain('start_url')
  expect(safePayload).not.toContain('meeting_password')

  const nav = page.getByRole('navigation', { name: 'Menú de Administrador' })
  await nav.getByRole('link', { name: 'Aula online' }).click()
  await expect(page.getByRole('heading', { name: 'Modalidad de las clases' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Reunión Zoom preparada' })).toBeVisible()
  await expect(page.getByText(/ID 98765432100/)).toBeVisible()
})
