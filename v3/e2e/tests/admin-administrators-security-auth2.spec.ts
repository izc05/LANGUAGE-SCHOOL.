import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090'
const SMTP_HTTP = process.env.LANGUAGE_SCHOOL_E2E_SMTP_HTTP || 'http://127.0.0.1:8093'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

type CapturedMail = { subject: string; to: string; decoded: string }

async function capturedMailFor(request: APIRequestContext, email: string): Promise<CapturedMail[]> {
  const response = await request.get(`${SMTP_HTTP}/messages?recipient=${encodeURIComponent(email)}`)
  expect(response.status()).toBe(200)
  const payload = await response.json() as { messages?: CapturedMail[] }
  return payload.messages || []
}

async function superuserToken(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    data: {
      identity: requiredEnv('PB_SUPERUSER_EMAIL'),
      password: requiredEnv('PB_SUPERUSER_PASSWORD'),
    },
  })
  expect(response.status()).toBe(200)
  const payload = await response.json() as { token?: string }
  expect(payload.token).toBeTruthy()
  return payload.token || ''
}

async function findUserId(request: APIRequestContext, email: string): Promise<string> {
  const token = await superuserToken(request)
  const response = await request.get(`${PB_URL}/api/collections/users/records`, {
    headers: { Authorization: token },
    params: { filter: `email = "${email}"`, perPage: 1 },
  })
  expect(response.status()).toBe(200)
  const payload = await response.json() as { items?: Array<{ id: string }> }
  return payload.items?.[0]?.id || ''
}

async function deleteUser(request: APIRequestContext, userId: string): Promise<void> {
  if (!userId) return
  const token = await superuserToken(request)
  const response = await request.delete(`${PB_URL}/api/collections/users/records/${userId}`, { headers: { Authorization: token } })
  expect([200, 204]).toContain(response.status())
}

async function loginExistingAdmin(page: Page) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(requiredEnv('E2E_ADMIN_EMAIL'))
  await page.getByLabel('Contraseña').fill(requiredEnv('E2E_ADMIN_PASSWORD'))
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

test('SECURITY-AUTH.2: Admin invita otro ADMIN, titular activa su cuenta y primer login exige MFA', async ({ page, request }) => {
  test.setTimeout(90_000)
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const email = `admin-auth2-${suffix}@example.com`
  const password = 'AdminAuth2OwnPass123!'
  let userId = ''

  await request.delete(`${SMTP_HTTP}/messages`)

  try {
    await loginExistingAdmin(page)
    await page.goto('/admin/administradores')
    await expect(page.getByRole('heading', { name: 'Administradores' })).toBeVisible()
    await expect(page.getByText('2FA obligatorio')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toHaveCount(0)

    await page.getByLabel('Nombre').fill('Nueva')
    await page.getByLabel('Apellidos').fill('Administradora')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel(/Teléfono/).fill('600123456')

    const inviteResponsePromise = page.waitForResponse((response) =>
      response.url().endsWith('/api/language-school/admin/accounts/invite') && response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Enviar invitación segura' }).click()
    const inviteResponse = await inviteResponsePromise
    expect(inviteResponse.status()).toBe(201)
    const invitePayload = await inviteResponse.json() as { activationUrl?: string; emailSent?: boolean }
    expect(invitePayload.activationUrl).toBe('')
    expect(invitePayload.emailSent).toBe(true)
    await expect(page.locator('.success-notice')).toContainText('Administrador invitado')
    await expect(page.locator('a[href*="/activar-cuenta?token="]')).toHaveCount(0)

    await expect.poll(async () => (await capturedMailFor(request, email)).length, { timeout: 8_000 }).toBe(1)
    const [activationMail] = await capturedMailFor(request, email)
    expect(activationMail.subject).toContain('Activa tu cuenta')
    const activationMatch = activationMail.decoded.match(/href="([^"]*\/activar-cuenta\?token=[^"]+)"/i)
    expect(activationMatch?.[1]).toBeTruthy()
    const activationUrl = activationMatch?.[1] || ''

    userId = await findUserId(request, email)
    expect(userId).toBeTruthy()

    await page.goto(activationUrl)
    await page.getByLabel('Nueva contraseña').fill(password)
    await page.getByLabel('Confirmar contraseña').fill(password)
    await page.getByRole('button', { name: 'Activar mi cuenta' }).click()
    await expect(page.getByRole('status')).toContainText('Ya puedes entrar a tu espacio privado')

    await request.delete(`${SMTP_HTTP}/messages`)
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await page.reload()
    await page.goto('/acceso')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Contraseña').fill(password)
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByRole('heading', { name: 'Confirma que eres tú.' })).toBeVisible()
    await expect(page).toHaveURL(/\/acceso$/)

    await expect.poll(async () => (await capturedMailFor(request, email)).length, { timeout: 8_000 }).toBe(1)
    const [otpMail] = await capturedMailFor(request, email)
    expect(otpMail.subject).toContain('Código de acceso')
    const otp = otpMail.decoded.match(/\b(\d{6})\b/)?.[1] || ''
    expect(otp).toMatch(/^\d{6}$/)

    await page.getByLabel('Código de seguridad').fill(otp)
    await page.getByRole('button', { name: 'Verificar y entrar' }).click()
    await expect(page).toHaveURL(/\/admin$/)

    await page.goto('/admin/administradores')
    const currentRow = page.getByTestId('admin-account-row').filter({ hasText: email })
    await expect(currentRow).toContainText('TU CUENTA')
    await expect(currentRow).toContainText('Activo')
  } finally {
    if (!userId) userId = await findUserId(request, email).catch(() => '')
    await deleteUser(request, userId)
    await request.delete(`${SMTP_HTTP}/messages`)
  }
})
