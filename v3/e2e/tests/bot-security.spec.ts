import { expect, test } from '@playwright/test'

const privatePaths = ['/acceso', '/admin', '/alumno', '/profesor']

test('robots.txt permite búsqueda y asistencia, pero bloquea entrenamiento y zonas privadas', async ({ request }) => {
  const response = await request.get('/robots.txt')
  expect(response.ok()).toBeTruthy()

  const robots = await response.text()
  expect(robots).toContain('Content-signal: search=yes, ai-input=yes, ai-train=no, use=reference')
  expect(robots).toContain('User-agent: GPTBot\nDisallow: /')
  expect(robots).toContain('User-agent: OAI-SearchBot')
  expect(robots).toContain('User-agent: ChatGPT-User')

  for (const path of privatePaths) {
    expect(robots).toContain(`Disallow: ${path}`)
  }
})

for (const path of privatePaths) {
  test(`${path} publica noindex y nofollow`, async ({ page }) => {
    await page.goto(path)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow, noarchive, nosnippet')
    await expect(page.locator('meta[name="googlebot"]')).toHaveAttribute('content', 'noindex, nofollow, noarchive, nosnippet')
  })
}

test('una ruta pública no hereda la directiva privada', async ({ page }) => {
  await page.goto('/acceso')
  await expect(page.locator('meta[name="robots"]')).toHaveCount(1)

  await page.goto('/contacto')
  await expect(page.locator('meta[data-language-school-route-seo]')).toHaveCount(0)
})

test('PocketBase rechaza el bypass directo de contact_requests', async ({ request }) => {
  const pbUrl = process.env.PB_URL || 'http://127.0.0.1:8090'
  const response = await request.post(`${pbUrl}/api/collections/contact_requests/records`, {
    data: {
      name: 'Bypass Bot',
      email: 'bot@example.com',
      message: 'Intento directo sin Turnstile',
      status: 'NEW',
    },
  })

  expect(response.ok()).toBeFalsy()
})

test('endpoint protegido rechaza solicitudes sin token Turnstile', async ({ request }) => {
  const pbUrl = process.env.PB_URL || 'http://127.0.0.1:8090'
  const response = await request.post(`${pbUrl}/api/language-school/contact`, {
    data: {
      name: 'No Token',
      email: 'notoken@example.com',
      message: 'Solicitud sin verificación',
      website: '',
      turnstileToken: '',
    },
  })

  expect(response.status()).toBe(400)
})

test('endpoint protegido acepta un token Turnstile válido de prueba', async ({ request }) => {
  const pbUrl = process.env.PB_URL || 'http://127.0.0.1:8090'
  const response = await request.post(`${pbUrl}/api/language-school/contact`, {
    data: {
      name: 'Turnstile E2E',
      email: 'turnstile-e2e@example.com',
      phone: '',
      interest: 'Seguridad',
      message: 'Validación positiva del endpoint protegido.',
      website: '',
      turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
    },
  })

  if (response.status() !== 201) {
    await new Promise((resolve) => setTimeout(resolve, 4_000))
    const identity = process.env.PB_SUPERUSER_EMAIL || ''
    const password = process.env.PB_SUPERUSER_PASSWORD || ''
    const auth = await request.post(`${pbUrl}/api/collections/_superusers/auth-with-password`, {
      data: { identity, password },
    })
    const authBody = await auth.json() as { token?: string }
    const filter = '(data.url~"/api/language-school/contact" || message~"[contact]")'
    const logs = authBody.token
      ? await request.get(`${pbUrl}/api/logs?page=1&perPage=50&sort=-created&filter=${encodeURIComponent(filter)}`, {
          headers: { Authorization: authBody.token },
        })
      : null
    const logBody = logs?.ok() ? await logs.json() as { items?: Array<Record<string, unknown>> } : { items: [] }
    const safeLogs = (logBody.items || []).map((item) => {
      const data = (item.data || {}) as Record<string, unknown>
      return {
        created: item.created,
        level: item.level,
        message: item.message,
        status: data.status,
        url: data.url,
        stage: data.stage,
        error: data.error,
      }
    })
    const responseBody = await response.text()
    console.error('Protected contact diagnostic:', JSON.stringify({ status: response.status(), responseBody, safeLogs }))
  }

  expect(response.status()).toBe(201)
})
