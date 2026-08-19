import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

async function authenticate(request: APIRequestContext, email: string, password: string): Promise<{ token: string; id: string }> {
  const response = await request.post(`${PB_URL}/api/collections/users/auth-with-password`, { data: { identity: email, password } })
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

function futurePeriod(monthsAhead = 10) {
  const now = new Date()
  const target = new Date(now.getFullYear(), now.getMonth() + monthsAhead, 1, 12)
  const year = target.getFullYear()
  const monthNumber = target.getMonth() + 1
  const month = String(monthNumber).padStart(2, '0')
  const last = new Date(year, monthNumber, 0, 12).getDate()
  return {
    start: `${year}-${month}-10`,
    end: `${year}-${month}-${String(Math.min(last, 20)).padStart(2, '0')}`,
    due: `${year}-${month}-09`,
  }
}

async function findAdminPayment(request: APIRequestContext, token: string, enrollmentId: string, start: string, end: string) {
  const response = await request.get(`${PB_URL}/api/collections/student_payments/records?perPage=500`, { headers: { Authorization: token } })
  expect(response.status(), await response.text()).toBe(200)
  const body = await response.json() as { items: Array<Record<string, unknown>> }
  return body.items.find((item) => item.enrollment === enrollmentId && String(item.period_start).slice(0, 10) === start && String(item.period_end).slice(0, 10) === end)
}

test('13F: pagos queda aislado y Admin gestiona céntimos sin destruir el histórico ni guardar datos bancarios sensibles', async ({ request }) => {
  const admin = await authenticate(request, requiredEnv('E2E_ADMIN_EMAIL'), requiredEnv('E2E_ADMIN_PASSWORD'))
  const teacher = await authenticate(request, requiredEnv('E2E_TEACHER_EMAIL'), requiredEnv('E2E_TEACHER_PASSWORD'))
  const student = await authenticate(request, requiredEnv('E2E_STUDENT_EMAIL'), requiredEnv('E2E_STUDENT_PASSWORD'))

  const enrollmentsResponse = await request.get(`${PB_URL}/api/collections/enrollments/records?perPage=50`, { headers: { Authorization: student.token } })
  expect(enrollmentsResponse.status(), await enrollmentsResponse.text()).toBe(200)
  const enrollmentBody = await enrollmentsResponse.json() as { items: Array<{ id: string; student: string }> }
  const enrollment = enrollmentBody.items.find((item) => item.student === student.id)
  expect(enrollment).toBeTruthy()

  const period = futurePeriod()
  const create = await request.post(`${PB_URL}/api/collections/student_payments/records`, {
    headers: { Authorization: admin.token },
    data: {
      student: student.id,
      enrollment: enrollment!.id,
      billing_mode: 'INTENSIVE',
      amount_cents: 6200,
      period_start: period.start,
      period_end: period.end,
      due_date: period.due,
      status: 'PENDING',
      paid_at: '',
      payment_method: '',
      reference: 'E2E-13F',
      notes: 'Registro temporal para verificar aislamiento',
      recorded_by: admin.id,
    },
  })

  let record = create.ok() ? await create.json() as Record<string, unknown> : await findAdminPayment(request, admin.token, enrollment!.id, period.start, period.end)
  expect(record).toBeTruthy()
  const recordId = String(record!.id)

  const update = await request.patch(`${PB_URL}/api/collections/student_payments/records/${recordId}`, {
    headers: { Authorization: admin.token },
    data: { amount_cents: 6300, status: 'PENDING' },
  })
  expect(update.status(), await update.text()).toBe(200)
  record = await update.json() as Record<string, unknown>
  expect(record.amount_cents).toBe(6300)
  expect(Number.isInteger(record.amount_cents)).toBe(true)

  const forbiddenSensitiveFields = ['card_number', 'card_pan', 'cvv', 'cvc', 'iban', 'bank_account', 'bank_account_number']
  for (const field of forbiddenSensitiveFields) expect(Object.prototype.hasOwnProperty.call(record, field)).toBe(false)

  for (const actor of [teacher, student]) {
    const read = await request.get(`${PB_URL}/api/collections/student_payments/records/${recordId}`, { headers: { Authorization: actor.token } })
    expect([403, 404]).toContain(read.status())

    const actorUpdate = await request.patch(`${PB_URL}/api/collections/student_payments/records/${recordId}`, {
      headers: { Authorization: actor.token },
      data: { amount_cents: 1 },
    })
    expect(actorUpdate.ok()).toBe(false)

    const actorDelete = await request.delete(`${PB_URL}/api/collections/student_payments/records/${recordId}`, { headers: { Authorization: actor.token } })
    expect(actorDelete.ok()).toBe(false)
  }

  const afterIsolation = await request.get(`${PB_URL}/api/collections/student_payments/records/${recordId}`, { headers: { Authorization: admin.token } })
  expect(afterIsolation.status(), await afterIsolation.text()).toBe(200)
  const afterIsolationRecord = await afterIsolation.json() as { amount_cents: number }
  expect(afterIsolationRecord.amount_cents).toBe(6300)

  const cancel = await request.patch(`${PB_URL}/api/collections/student_payments/records/${recordId}`, {
    headers: { Authorization: admin.token },
    data: { status: 'CANCELLED', notes: '13F cierre: conservar trazabilidad sin borrado físico' },
  })
  expect(cancel.status(), await cancel.text()).toBe(200)
  const cancelled = await cancel.json() as { status: string; amount_cents: number }
  expect(cancelled.status).toBe('CANCELLED')
  expect(cancelled.amount_cents).toBe(6300)

  const adminDelete = await request.delete(`${PB_URL}/api/collections/student_payments/records/${recordId}`, { headers: { Authorization: admin.token } })
  expect(adminDelete.status(), await adminDelete.text()).toBe(403)

  const preserved = await request.get(`${PB_URL}/api/collections/student_payments/records/${recordId}`, { headers: { Authorization: admin.token } })
  expect(preserved.status(), await preserved.text()).toBe(200)
  const preservedRecord = await preserved.json() as { status: string; amount_cents: number }
  expect(preservedRecord.status).toBe('CANCELLED')
  expect(preservedRecord.amount_cents).toBe(6300)
})

test('13F: lote sigue siendo mensual, intensivo sigue manual y Pagos cierra responsive', async ({ page }) => {
  await loginAdmin(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/admin/pagos')

  await page.getByRole('button', { name: 'Generar mensualidades' }).click()
  const batch = page.locator('.admin-payment-batch')
  await expect(batch).toBeVisible()
  await expect(batch.getByText('Los intensivos siguen gestionándose manualmente por su periodo concreto.')).toBeVisible()
  await expect(batch.getByText('Solo mensual')).toBeVisible()

  await page.getByRole('button', { name: 'Cerrar lote' }).click()
  await page.getByRole('button', { name: '+ Nuevo cobro' }).click()
  const create = page.locator('.admin-payment-create')
  await expect(create.getByLabel('Modalidad').locator('option[value="MONTHLY"]')).toHaveCount(1)
  await expect(create.getByLabel('Modalidad').locator('option[value="INTENSIVE"]')).toHaveCount(1)
  await expect(create.getByLabel('Importe (€)')).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
