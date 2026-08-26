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
  outsider: { email: requiredEnv('E2E_OUTSIDER_EMAIL'), password: requiredEnv('E2E_OUTSIDER_PASSWORD') },
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
    let body: unknown = null
    try { body = await response.json() } catch { body = null }
    return { status: response.status, body }
  }, { path, method })
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Expected a three-part JWT')
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>
}

test('8D.1: Meeting SDK autoriza solo al alumno matriculado con firma temporal role 0', async ({ page, request }) => {
  const anonymous = await request.post('http://127.0.0.1:8090/api/language-school/zoom/classes/fake/sdk-auth')
  expect(anonymous.status()).toBe(401)

  await login(page, credentials.admin.email, credentials.admin.password, /\/admin$/)
  const classFilter = encodeURIComponent('topic = "E2E Speaking class"')
  const classList = await backendRequest(page, `/api/collections/classes/records?page=1&perPage=5&filter=${classFilter}`)
  expect(classList.status).toBe(200)
  const classId = (classList.body as { items?: Array<{ id?: string }> })?.items?.[0]?.id
  expect(classId).toBeTruthy()

  const adminAttempt = await backendRequest(page, `/api/language-school/zoom/classes/${encodeURIComponent(String(classId))}/sdk-auth`, 'POST')
  expect(adminAttempt.status).toBe(403)
  await logout(page)

  await login(page, credentials.teacher.email, credentials.teacher.password, /\/profesor$/)
  const teacherAttempt = await backendRequest(page, `/api/language-school/zoom/classes/${encodeURIComponent(String(classId))}/sdk-auth`, 'POST')
  expect(teacherAttempt.status).toBe(403)
  await logout(page)

  await login(page, credentials.outsider.email, credentials.outsider.password, /\/alumno$/)
  const outsiderAttempt = await backendRequest(page, `/api/language-school/zoom/classes/${encodeURIComponent(String(classId))}/sdk-auth`, 'POST')
  expect(outsiderAttempt.status).toBe(403)
  expect(JSON.stringify(outsiderAttempt.body)).not.toContain('e2e-meeting-sdk-secret')
  await page.goto(`/alumno/aula/${encodeURIComponent(String(classId))}`)
  await expect(page.getByText('No hemos podido cargar esta clase o ya no pertenece a tu calendario activo.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'E2E Speaking class' })).toHaveCount(0)
  await page.goto('/alumno')
  await logout(page)

  await login(page, credentials.student.email, credentials.student.password, /\/alumno$/)
  const authorized = await backendRequest(page, `/api/language-school/zoom/classes/${encodeURIComponent(String(classId))}/sdk-auth`, 'POST')
  expect(authorized.status, JSON.stringify(authorized.body)).toBe(200)
  expect(authorized.body).toMatchObject({
    provider: 'zoom',
    authorized: true,
    meetingNumber: '98765432100',
    password: 'e2e-room-pass',
    userName: 'E2E Student',
    role: 0,
  })

  const response = authorized.body as { signature?: string; expiresAt?: number }
  expect(typeof response.signature).toBe('string')
  expect(response.signature).toBeTruthy()
  expect(JSON.stringify(authorized.body)).not.toContain('e2e-meeting-sdk-secret')

  const payload = decodeJwtPayload(String(response.signature))
  expect(payload.appKey).toBe('e2e-meeting-sdk-client')
  expect(payload.sdkKey).toBe('e2e-meeting-sdk-client')
  expect(payload.mn).toBe('98765432100')
  expect(payload.role).toBe(0)
  expect(typeof payload.iat).toBe('number')
  expect(typeof payload.exp).toBe('number')
  expect(typeof payload.tokenExp).toBe('number')

  const issuedAt = Number(payload.iat)
  const expiresAt = Number(payload.exp)
  const tokenExp = Number(payload.tokenExp)
  expect(expiresAt - issuedAt).toBeGreaterThanOrEqual(1800)
  expect(expiresAt - issuedAt).toBeLessThanOrEqual(172800)
  expect(Math.abs(tokenExp - expiresAt)).toBeLessThanOrEqual(2)
  expect(Number(response.expiresAt)).toBeGreaterThan(Math.floor(Date.now() / 1000))
})

test('8D.2: alumno entra desde Campus al aula y el SDK se carga solo al solicitar acceso', async ({ page }) => {
  await page.route('https://source.zoom.us/**', async (route) => {
    const url = route.request().url()
    const isStylesheet = url.endsWith('.css')
    const isMeetingClient = url.includes('zoom-meeting-6.2.0.min.js')
    await route.fulfill({
      status: 200,
      contentType: isStylesheet ? 'text/css' : 'application/javascript',
      body: isStylesheet
        ? '/* Zoom Client View E2E stylesheet stub */'
        : isMeetingClient
          ? `window.ZoomMtg={setZoomJSLib:function(){},preLoadWasm:function(){},prepareWebSDK:function(){},i18n:{load:function(){return Promise.resolve()}},init:function(options){window.__languageSchoolZoomInit=options;options.success()},join:function(options){window.__languageSchoolZoomJoin=options;options.success()}};`
          : '',
    })
  })

  await login(page, credentials.student.email, credentials.student.password, /\/alumno$/)
  const classFilter = encodeURIComponent('topic = "E2E Speaking class"')
  const classList = await backendRequest(page, `/api/collections/classes/records?page=1&perPage=5&filter=${classFilter}`)
  expect(classList.status).toBe(200)
  const classId = (classList.body as { items?: Array<{ id?: string }> })?.items?.[0]?.id
  expect(classId).toBeTruthy()

  await page.goto(`/alumno/aula/${encodeURIComponent(String(classId))}`)
  await expect(page).toHaveURL(new RegExp(`/alumno/aula/${String(classId)}$`))
  await expect(page.getByText('AULA ONLINE')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'E2E Speaking class', level: 1 })).toBeVisible()
  await expect(page.locator('script[data-language-school-zoom-src]')).toHaveCount(0)
  await expect(page.locator('link[data-language-school-zoom-style]')).toHaveCount(0)

  const joinButton = page.getByRole('button', { name: 'Entrar al aula Zoom' })
  await expect(joinButton).toBeEnabled()
  await joinButton.click()
  await expect(page.getByRole('button', { name: 'Aula iniciada' })).toBeVisible()
  await expect(page.locator('script[data-language-school-zoom-src]')).toHaveCount(6)
  await expect(page.locator('link[data-language-school-zoom-style]')).toHaveCount(2)

  const joined = await page.evaluate(() => {
    const join = (window as typeof window & { __languageSchoolZoomJoin?: { meetingNumber?: string; userName?: string; passWord?: string; signature?: string } }).__languageSchoolZoomJoin
    return join || null
  })
  expect(joined).toMatchObject({
    meetingNumber: '98765432100',
    userName: 'E2E Student',
    passWord: 'e2e-room-pass',
  })
  expect(typeof joined?.signature).toBe('string')
  expect(joined?.signature).not.toContain('e2e-meeting-sdk-secret')
})
