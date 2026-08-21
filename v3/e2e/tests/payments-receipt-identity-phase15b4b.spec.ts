import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090'

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

async function loginAdmin(page: Page) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(requiredEnv('E2E_ADMIN_EMAIL'))
  await page.getByLabel('Contraseña').fill(requiredEnv('E2E_ADMIN_PASSWORD'))
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

function currentMonth() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const last = new Date(year, now.getMonth() + 1, 0, 12).getDate()
  return {
    start: `${year}-${month}-01`,
    end: `${year}-${month}-${String(last).padStart(2, '0')}`,
    due: `${year}-${month}-05`,
    paidAt: `${year}-${month}-${String(now.getDate()).padStart(2, '0')}`,
  }
}

test('15B.4B: connected no emite justificante con identidad genérica o de fallback', async ({ request, page }) => {
  const admin = await authenticate(request, 'users', requiredEnv('E2E_ADMIN_EMAIL'), requiredEnv('E2E_ADMIN_PASSWORD'))
  const student = await authenticate(request, 'users', requiredEnv('E2E_STUDENT_EMAIL'), requiredEnv('E2E_STUDENT_PASSWORD'))
  const superuser = await authenticate(request, '_superusers', requiredEnv('PB_SUPERUSER_EMAIL'), requiredEnv('PB_SUPERUSER_PASSWORD'))

  const settingsResponse = await request.get(`${PB_URL}/api/collections/site_settings/records?perPage=1`, {
    headers: { Authorization: admin.token },
  })
  expect(settingsResponse.status(), await settingsResponse.text()).toBe(200)
  const settingsBody = await settingsResponse.json() as {
    items: Array<{
      id: string
      academy_name: string
      phone: string
      email: string
      address: string
      legal_texts: Record<string, string>
    }>
  }
  const settings = settingsBody.items[0]
  expect(settings).toBeTruthy()

  const enrollmentsResponse = await request.get(`${PB_URL}/api/collections/enrollments/records?perPage=100`, {
    headers: { Authorization: admin.token },
  })
  expect(enrollmentsResponse.status(), await enrollmentsResponse.text()).toBe(200)
  const enrollments = await enrollmentsResponse.json() as { items: Array<{ id: string; student: string; status: string }> }
  const enrollment = enrollments.items.find((item) => item.student === student.id && item.status === 'ACTIVE')
  expect(enrollment).toBeTruthy()

  const dates = currentMonth()
  let paymentId = ''
  try {
    const paymentResponse = await request.post(`${PB_URL}/api/collections/student_payments/records`, {
      headers: { Authorization: admin.token },
      data: {
        student: student.id,
        enrollment: enrollment!.id,
        billing_mode: 'INTENSIVE',
        amount_cents: 5731,
        period_start: dates.start,
        period_end: dates.end,
        due_date: dates.due,
        status: 'PAID',
        paid_at: dates.paidAt,
        payment_method: 'BIZUM',
        reference: 'E2E receipt identity guard',
        notes: 'Registro temporal del fail-safe de identidad.',
        recorded_by: admin.id,
      },
    })
    expect([200, 201]).toContain(paymentResponse.status())
    paymentId = ((await paymentResponse.json()) as { id: string }).id

    const neutralLegal = {
      ...(settings.legal_texts || {}),
      legal_owner_name: '',
      legal_tax_id: '',
    }
    const neutralResponse = await request.patch(`${PB_URL}/api/collections/site_settings/records/${settings.id}`, {
      headers: { Authorization: admin.token },
      data: {
        academy_name: 'Language School',
        phone: '',
        email: '',
        address: '',
        legal_texts: neutralLegal,
      },
    })
    expect(neutralResponse.status(), await neutralResponse.text()).toBe(200)

    await loginAdmin(page)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/admin/pagos')

    const record = page.locator('.payment-record').filter({ hasText: '57,31' }).filter({ hasText: 'E2E Student' }).first()
    await expect(record).toBeVisible()
    await expect(record.getByText('Pagado')).toBeVisible()
    const receiptButton = record.getByRole('button', { name: 'Justificante PDF' })
    await expect(receiptButton).toBeVisible()

    let downloaded = false
    page.once('download', () => { downloaded = true })
    await receiptButton.click()
    await expect(page.getByRole('alert')).toContainText('Completa la identidad real de la academia')
    await page.waitForTimeout(150)
    expect(downloaded).toBe(false)
  } finally {
    const restoreResponse = await request.patch(`${PB_URL}/api/collections/site_settings/records/${settings.id}`, {
      headers: { Authorization: admin.token },
      data: {
        academy_name: settings.academy_name,
        phone: settings.phone,
        email: settings.email,
        address: settings.address,
        legal_texts: settings.legal_texts || {},
      },
    })
    expect(restoreResponse.status(), await restoreResponse.text()).toBe(200)

    if (paymentId) {
      const deleteResponse = await request.delete(`${PB_URL}/api/collections/student_payments/records/${paymentId}`, {
        headers: { Authorization: superuser.token },
      })
      expect([200, 204]).toContain(deleteResponse.status())
    }
  }
})