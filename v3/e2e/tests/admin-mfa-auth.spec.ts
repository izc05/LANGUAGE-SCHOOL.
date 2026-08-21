import { expect, test } from '@playwright/test'

function futureJwt(): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')
  return `${header}.${payload}.e2e-signature`
}

test('SECURITY-AUTH.1: ADMIN no recibe sesión hasta completar el segundo factor', async ({ page }) => {
  let passwordAttempts = 0
  let otpRequests = 0
  let otpVerifications = 0

  await page.route('**/api/collections/users/auth-with-password', async (route) => {
    passwordAttempts += 1
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ status: 401, message: 'Multi-factor authentication required.', data: {}, mfaId: 'e2e-mfa-id' }),
    })
  })

  await page.route('**/api/collections/users/request-otp', async (route) => {
    otpRequests += 1
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ otpId: `e2e-otp-${otpRequests}` }) })
  })

  await page.route('**/api/collections/users/auth-with-otp**', async (route) => {
    otpVerifications += 1
    const requestBody = route.request().postDataJSON() as { password?: string }
    expect(requestBody.password).toBe('123456')
    expect(new URL(route.request().url()).searchParams.get('mfaId')).toBe('e2e-mfa-id')

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: futureJwt(),
        record: {
          id: 'e2emfaadmin0001', collectionId: '_pb_users_auth_', collectionName: 'users',
          email: 'mfa-admin@example.com', emailVisibility: false, verified: true,
          name: 'MFA', surname: 'Admin', role: 'ADMIN', status: 'ACTIVE', avatar: '', phone: '',
          created: '2026-08-21 17:00:00.000Z', updated: '2026-08-21 17:00:00.000Z',
        },
      }),
    })
  })

  await page.goto('/acceso')
  await page.getByLabel('Email').fill('mfa-admin@example.com')
  await page.getByLabel('Contraseña').fill('CorrectPassword123!')
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page).toHaveURL(/\/acceso$/)
  await expect(page.getByRole('heading', { name: 'Confirma que eres tú.' })).toBeVisible()
  await expect(page.getByLabel('Código de seguridad')).toBeVisible()
  await expect(page.getByText('Por seguridad, la contraseña por sí sola no permite entrar en Administración.')).toBeVisible()
  expect(passwordAttempts).toBe(1)
  expect(otpRequests).toBe(1)
  expect(otpVerifications).toBe(0)

  await page.getByLabel('Código de seguridad').fill('123456')
  await page.getByRole('button', { name: 'Verificar y entrar' }).click()

  await expect(page).toHaveURL(/\/admin$/, { timeout: 5000 })
  expect(otpVerifications).toBe(1)
})

test('SECURITY-AUTH.1: código inválido mantiene el ADMIN fuera', async ({ page }) => {
  await page.route('**/api/collections/users/auth-with-password', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ status: 401, message: 'Multi-factor authentication required.', data: {}, mfaId: 'e2e-mfa-id-invalid' }),
    })
  })

  await page.route('**/api/collections/users/request-otp', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ otpId: 'e2e-otp-invalid' }) })
  })

  await page.route('**/api/collections/users/auth-with-otp**', async (route) => {
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ status: 400, message: 'Failed to authenticate.', data: {} }) })
  })

  await page.goto('/acceso')
  await page.getByLabel('Email').fill('mfa-admin@example.com')
  await page.getByLabel('Contraseña').fill('CorrectPassword123!')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.getByLabel('Código de seguridad').fill('000000')
  await page.getByRole('button', { name: 'Verificar y entrar' }).click()

  await expect(page).toHaveURL(/\/acceso$/)
  await expect(page.getByRole('alert')).toContainText('El código no es válido o ha caducado')
  await expect(page.getByLabel('Código de seguridad')).toBeVisible()
})
