import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090'
const SMTP_HTTP = process.env.LANGUAGE_SCHOOL_E2E_SMTP_HTTP || 'http://127.0.0.1:8093'
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || process.env.E2E_BASE_URL || 'http://127.0.0.1:4173'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

async function authenticate(
  request: APIRequestContext,
  collection: string,
  email: string,
  password: string,
): Promise<{ token: string; id: string }> {
  const response = await request.post(`${PB_URL}/api/collections/${collection}/auth-with-password`, {
    data: { identity: email, password },
  })
  expect(response.status(), await response.text()).toBe(200)
  const body = await response.json() as { token: string; record: { id: string } }
  return { token: body.token, id: body.record.id }
}

type InvitedRole = 'STUDENT' | 'TEACHER'

type Invitation = {
  userId: string
  invitationId: string
  role?: InvitedRole
  status: 'PENDING'
  activationUrl: string
  emailSent: boolean
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

async function createInvitation(
  request: APIRequestContext,
  adminToken: string,
  role: InvitedRole,
  email: string,
): Promise<Invitation> {
  const response = await request.post(`${PB_URL}/api/language-school/admin/accounts/invite`, {
    headers: { Authorization: adminToken },
    data: {
      role,
      name: role === 'STUDENT' ? 'Activation Student' : 'Activation Teacher',
      surname: 'E2E',
      email,
      phone: '',
      activationBaseUrl: requiredEnv('E2E_BASE_URL'),
    },
  })
  expect(response.status(), await response.text()).toBe(201)
  return response.json() as Promise<Invitation>
}

async function reissueInvitation(
  request: APIRequestContext,
  adminToken: string,
  userId: string,
): Promise<Invitation> {
  const response = await request.post(`${PB_URL}/api/language-school/admin/accounts/invite/resend`, {
    headers: { Authorization: adminToken },
    data: { userId, activationBaseUrl: requiredEnv('E2E_BASE_URL') },
  })
  expect(response.status(), await response.text()).toBe(200)
  return response.json() as Promise<Invitation>
}

async function activationUrlFromMail(request: APIRequestContext, email: string): Promise<string> {
  await expect.poll(async () => (await capturedMailFor(request, email)).length, { timeout: 8_000 }).toBe(1)
  const [mail] = await capturedMailFor(request, email)
  expect(mail.subject).toContain('Activa tu cuenta')
  const hrefMatch = mail.decoded.match(/href="([^"]*\/activar-cuenta\?token=[^"]+)"/i)
  expect(hrefMatch?.[1]).toBeTruthy()
  const activationUrl = hrefMatch?.[1] || ''
  expect(activationUrl.startsWith(`${PUBLIC_ORIGIN}/activar-cuenta?token=`)).toBe(true)
  expect(activationUrl).not.toContain('/_/')
  return activationUrl
}

async function assertActivationState(
  request: APIRequestContext,
  adminToken: string,
  superToken: string,
  userId: string,
  role: InvitedRole,
) {
  const statusResponse = await request.post(`${PB_URL}/api/language-school/admin/accounts/invite/status`, {
    headers: { Authorization: adminToken },
    data: { userId },
  })
  expect(statusResponse.status(), await statusResponse.text()).toBe(200)
  const status = await statusResponse.json() as { accountStatus: string; invitationStatus: string }
  expect(status.accountStatus).toBe('ACTIVE')
  expect(status.invitationStatus).toBe('USED')

  const userResponse = await request.get(`${PB_URL}/api/collections/users/records/${userId}`, {
    headers: { Authorization: superToken },
  })
  expect(userResponse.status(), await userResponse.text()).toBe(200)
  const user = await userResponse.json() as { status: string; verified: boolean; role: string }
  expect(user.status).toBe('ACTIVE')
  expect(user.verified).toBe(true)
  expect(user.role).toBe(role)

  const profileCollection = role === 'STUDENT' ? 'student_profiles' : 'teacher_profiles'
  const profileFilter = encodeURIComponent(`user = "${userId}"`)
  const profileResponse = await request.get(`${PB_URL}/api/collections/${profileCollection}/records?perPage=10&filter=${profileFilter}`, {
    headers: { Authorization: superToken },
  })
  expect(profileResponse.status(), await profileResponse.text()).toBe(200)
  const profiles = await profileResponse.json() as { items: Array<{ active: boolean }> }
  expect(profiles.items).toHaveLength(1)
  expect(profiles.items[0].active).toBe(true)
}

async function activateAndLogin(
  page: Page,
  request: APIRequestContext,
  adminToken: string,
  superToken: string,
  role: InvitedRole,
) {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const email = `e2e-activation-${role.toLowerCase()}-${unique}@example.com`
  const password = role === 'STUDENT' ? 'StudentActivation123!' : 'TeacherActivation123!'
  let userId = ''

  await request.delete(`${SMTP_HTTP}/messages`)

  try {
    const invitation = await createInvitation(request, adminToken, role, email)
    userId = invitation.userId

    // El ADMIN puede conocer el estado de la invitación, pero nunca recibe el enlace/token secreto.
    expect(invitation.activationUrl).toBe('')
    expect(invitation.emailSent).toBe(true)

    const firstActivationUrl = await activationUrlFromMail(request, email)
    const firstActivation = new URL(firstActivationUrl)
    const firstToken = firstActivation.searchParams.get('token') || ''
    expect(firstToken).toMatch(/^[A-Za-z0-9]{40,100}$/)

    // Regenerar rota el token anterior y el nuevo vuelve a viajar solo por email.
    await request.delete(`${SMTP_HTTP}/messages`)
    const reissued = await reissueInvitation(request, adminToken, userId)
    expect(reissued.activationUrl).toBe('')
    expect(reissued.emailSent).toBe(true)

    const activationUrl = await activationUrlFromMail(request, email)
    expect(activationUrl).not.toBe(firstActivationUrl)
    const activation = new URL(activationUrl)
    const token = activation.searchParams.get('token') || ''
    expect(activation.pathname).toBe('/activar-cuenta')
    expect(token).toMatch(/^[A-Za-z0-9]{40,100}$/)

    const revokedOldToken = await request.post(`${PB_URL}/api/language-school/account/activate`, {
      data: { token: firstToken, password, passwordConfirm: password },
    })
    expect(revokedOldToken.status()).toBe(400)

    const before = await request.post(`${PB_URL}/api/collections/users/auth-with-password`, {
      data: { identity: email, password },
    })
    expect([400, 401]).toContain(before.status())

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(activationUrl)
    await expect(page.getByRole('heading', { name: 'Activa tu cuenta.' })).toBeVisible()
    await expect(page.locator('body')).not.toContainText(token)
    const overflowBefore = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflowBefore).toBeLessThanOrEqual(1)

    await page.getByLabel('Nueva contraseña').fill(password)
    await page.getByLabel('Confirmar contraseña').fill(password)
    await page.getByRole('button', { name: 'Activar mi cuenta' }).click()

    await expect(page.getByRole('heading', { name: 'Cuenta activada.' })).toBeVisible()
    await expect(page.getByRole('status')).toContainText('Ya puedes entrar a tu espacio privado.')
    await assertActivationState(request, adminToken, superToken, userId, role)

    const reused = await request.post(`${PB_URL}/api/language-school/account/activate`, {
      data: { token, password, passwordConfirm: password },
    })
    expect(reused.status()).toBe(400)

    await page.getByRole('link', { name: 'Entrar a mi espacio' }).click()
    await expect(page).toHaveURL(/\/acceso$/)
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Contraseña').fill(password)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL(role === 'STUDENT' ? /\/alumno$/ : /\/profesor$/, { timeout: 15_000 })
  } finally {
    if (userId) {
      const deleteResponse = await request.delete(`${PB_URL}/api/collections/users/records/${userId}`, {
        headers: { Authorization: superToken },
      })
      expect([200, 204]).toContain(deleteResponse.status())
    }
    await request.delete(`${SMTP_HTTP}/messages`)
  }
}

test('15C: Alumno recibe activación solo por email, la rotación invalida el enlace anterior y entra', async ({ request, page }) => {
  const admin = await authenticate(request, 'users', requiredEnv('E2E_ADMIN_EMAIL'), requiredEnv('E2E_ADMIN_PASSWORD'))
  const superuser = await authenticate(request, '_superusers', requiredEnv('PB_SUPERUSER_EMAIL'), requiredEnv('PB_SUPERUSER_PASSWORD'))
  await activateAndLogin(page, request, admin.token, superuser.token, 'STUDENT')
})

test('15C: Profesor recibe activación solo por email, la rotación invalida el enlace anterior y entra', async ({ request, page }) => {
  const admin = await authenticate(request, 'users', requiredEnv('E2E_ADMIN_EMAIL'), requiredEnv('E2E_ADMIN_PASSWORD'))
  const superuser = await authenticate(request, '_superusers', requiredEnv('PB_SUPERUSER_EMAIL'), requiredEnv('PB_SUPERUSER_PASSWORD'))
  await activateAndLogin(page, request, admin.token, superuser.token, 'TEACHER')
})