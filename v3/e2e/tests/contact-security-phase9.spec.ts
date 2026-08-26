import { expect, test } from '@playwright/test'

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090'

const payload = {
  name: 'Security E2E',
  email: 'security-e2e@example.com',
  phone: '600000000',
  interest: 'Security',
  message: 'Validación de la protección del formulario público.',
}

test('9.3A: el alta anónima directa en contact_requests queda bloqueada', async ({ request }) => {
  const response = await request.post(`${PB_URL}/api/collections/contact_requests/records`, {
    data: { ...payload, status: 'NEW' },
  })
  expect(response.status()).toBe(403)
})

test('9.3A: el endpoint protegido rechaza solicitudes sin Turnstile', async ({ request }) => {
  const response = await request.post(`${PB_URL}/api/language-school/contact`, {
    data: { ...payload, website: '', turnstileToken: '' },
  })
  expect(response.status()).toBe(400)
  const body = await response.json() as { message?: string }
  expect(body.message).toContain('verificación')
})

test('9.3A: el endpoint protegido acepta el token oficial de E2E y no necesita secretos en cliente', async ({ request }) => {
  const response = await request.post(`${PB_URL}/api/language-school/contact`, {
    data: {
      ...payload,
      email: `security-${Date.now()}@example.com`,
      website: '',
      turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
    },
  })
  expect(response.status(), await response.text()).toBe(201)
})

test('9.3A: el honeypot responde de forma neutra', async ({ request }) => {
  const response = await request.post(`${PB_URL}/api/language-school/contact`, {
    data: { ...payload, website: 'https://spam.example', turnstileToken: '' },
  })
  expect(response.status()).toBe(200)
  await expect(response.json()).resolves.toMatchObject({ success: true })
})
