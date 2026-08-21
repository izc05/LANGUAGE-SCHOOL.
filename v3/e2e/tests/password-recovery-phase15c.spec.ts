import { expect, test, type APIRequestContext } from '@playwright/test'

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090'
const SMTP_HTTP = process.env.LANGUAGE_SCHOOL_E2E_SMTP_HTTP || 'http://127.0.0.1:8093'
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || 'http://127.0.0.1:4173'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
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

async function createTemporaryStudent(request: APIRequestContext, email: string, password: string): Promise<string> {
  const token = await superuserToken(request)
  const response = await request.post(`${PB_URL}/api/collections/users/records`, {
    headers: { Authorization: token },
    data: {
      email,
      password,
      passwordConfirm: password,
      name: 'Recovery',
      surname: 'Student',
      role: 'STUDENT',
      status: 'ACTIVE',
      verified: true,
      phone: '',
    },
  })
  expect([200, 201]).toContain(response.status())
  const record = await response.json() as { id: string }
  return record.id
}

async function deleteTemporaryUser(request: APIRequestContext, userId: string): Promise<void> {
  const token = await superuserToken(request)
  const response = await request.delete(`${PB_URL}/api/collections/users/records/${userId}`, {
    headers: { Authorization: token },
  })
  expect([200, 204]).toContain(response.status())
}

type CapturedMail = {
  subject: string
  to: string
  decoded: string
}

async function capturedMailFor(request: APIRequestContext, email: string): Promise<CapturedMail[]> {
  const response = await request.get(`${SMTP_HTTP}/messages?recipient=${encodeURIComponent(email)}`)
  expect(response.status()).toBe(200)
  const payload = await response.json() as { messages?: CapturedMail[] }
  return payload.messages || []
}

test('15C: recuperación usa correo real, enlace público, token de un uso y no revela cuentas', async ({ page, request }) => {
  test.setTimeout(45_000)

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const email = `recovery-${suffix}@example.com`
  const unknownEmail = `unknown-${suffix}@example.com`
  const oldPassword = 'RecoveryOldPass123!'
  const newPassword = 'RecoveryNewPass456!'
  let userId = ''

  await request.delete(`${SMTP_HTTP}/messages`)

  try {
    userId = await createTemporaryStudent(request, email, oldPassword)

    // Public request remains neutral for an address that is not registered.
    await page.goto('/recuperar-cuenta')
    await page.getByLabel('Email').fill(unknownEmail)
    await page.getByRole('button', { name: 'Enviar enlace de recuperación' }).click()
    await expect(page.getByRole('status')).toContainText('Si existe una cuenta activa asociada a ese email')
    await expect.poll(async () => (await capturedMailFor(request, unknownEmail)).length, { timeout: 3_000 }).toBe(0)

    await page.getByRole('button', { name: 'Enviar a otro email' }).click()
    await page.getByLabel('Email').fill(email)
    await page.getByRole('button', { name: 'Enviar enlace de recuperación' }).click()
    await expect(page.getByRole('status')).toContainText('Si existe una cuenta activa asociada a ese email')

    await expect.poll(async () => (await capturedMailFor(request, email)).length, { timeout: 8_000 }).toBe(1)
    const [mail] = await capturedMailFor(request, email)
    expect(mail.subject).toContain('Recupera tu contraseña')

    const hrefMatch = mail.decoded.match(/href="([^"]*\/recuperar-cuenta\?token=[^"]+)"/i)
    expect(hrefMatch?.[1]).toBeTruthy()
    const recoveryUrl = hrefMatch?.[1] || ''
    expect(recoveryUrl.startsWith(`${PUBLIC_ORIGIN}/recuperar-cuenta?token=`)).toBe(true)
    expect(recoveryUrl).not.toContain('/_/')

    await page.goto(recoveryUrl)
    await page.getByLabel('Nueva contraseña').fill(newPassword)
    await page.getByLabel('Repite la contraseña').fill(newPassword)
    await page.getByRole('button', { name: 'Guardar nueva contraseña' }).click()
    await expect(page.getByRole('status')).toContainText('Tu contraseña se ha cambiado correctamente')

    const oldLogin = await request.post(`${PB_URL}/api/collections/users/auth-with-password`, {
      data: { identity: email, password: oldPassword },
    })
    expect(oldLogin.status()).not.toBe(200)

    const newLogin = await request.post(`${PB_URL}/api/collections/users/auth-with-password`, {
      data: { identity: email, password: newPassword },
    })
    expect(newLogin.status()).toBe(200)

    // The same reset token cannot be consumed twice.
    await page.goto(recoveryUrl)
    await page.getByLabel('Nueva contraseña').fill('AnotherRecoveryPass789!')
    await page.getByLabel('Repite la contraseña').fill('AnotherRecoveryPass789!')
    await page.getByRole('button', { name: 'Guardar nueva contraseña' }).click()
    await expect(page.getByRole('alert')).toContainText('El enlace no es válido o ha caducado')
  } finally {
    if (userId) await deleteTemporaryUser(request, userId)
    await request.delete(`${SMTP_HTTP}/messages`)
  }
})
