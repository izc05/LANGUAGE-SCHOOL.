import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { createPrivilegedUser } from '../helpers/privileged-users'

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

async function authenticate(request: APIRequestContext, collection: string, email: string, password: string): Promise<{ token: string; id: string }> {
  const response = await request.post(`${PB_URL}/api/collections/${collection}/auth-with-password`, { data: { identity: email, password } })
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

function localMonth() {
  const now = new Date()
  const year = now.getFullYear()
  const monthNumber = now.getMonth() + 1
  const month = String(monthNumber).padStart(2, '0')
  const lastDay = new Date(year, monthNumber, 0, 12).getDate()
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  return {
    month: `${year}-${month}`,
    day: (day: number) => `${year}-${month}-${String(Math.min(day, lastDay)).padStart(2, '0')}`,
    end: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
    today: `${year}-${month}-${String(now.getDate()).padStart(2, '0')}`,
    yesterday: `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`,
  }
}

async function createPayment(request: APIRequestContext, admin: { token: string; id: string }, data: Record<string, unknown>) {
  const response = await request.post(`${PB_URL}/api/collections/student_payments/records`, {
    headers: { Authorization: admin.token }, data: { ...data, recorded_by: admin.id },
  })
  expect(response.status(), await response.text()).toBe(200)
  return await response.json() as { id: string }
}

async function createTemporaryStudentEnrollment(request: APIRequestContext, admin: { token: string; id: string }) {
  const groupsResponse = await request.get(`${PB_URL}/api/collections/groups/records?perPage=100`, { headers: { Authorization: admin.token } })
  expect(groupsResponse.status(), await groupsResponse.text()).toBe(200)
  const groups = await groupsResponse.json() as { items: Array<{ id: string; name: string; status: string }> }
  const group = groups.items.find((item) => item.name === 'E2E B1 Group' && item.status === 'ACTIVE') || groups.items.find((item) => item.status === 'ACTIVE')
  expect(group).toBeTruthy()

  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const password = 'E2eTempPaymentPass123!'
  const userResponse = await createPrivilegedUser<{ id: string }>(request, {
    email: `e2e-payment-${unique}@example.com`, password,
    name: 'Payment', surname: 'Summary', role: 'STUDENT', status: 'ACTIVE', phone: '',
  })
  expect([200, 201]).toContain(userResponse.status)
  const student = userResponse.body

  const enrollmentResponse = await request.post(`${PB_URL}/api/collections/enrollments/records`, {
    headers: { Authorization: admin.token }, data: { student: student.id, group: group!.id, status: 'ACTIVE', joined_at: new Date().toISOString() },
  })
  expect([200, 201]).toContain(enrollmentResponse.status())
  const enrollment = await enrollmentResponse.json() as { id: string }
  return { studentId: student.id, enrollmentId: enrollment.id }
}

async function deleteRecord(request: APIRequestContext, superToken: string, collection: string, id: string) {
  const response = await request.delete(`${PB_URL}/api/collections/${collection}/records/${id}`, { headers: { Authorization: superToken } })
  expect([200, 204]).toContain(response.status())
}

async function cleanupTemporaryPaymentStudent(request: APIRequestContext, superToken: string, studentId: string, enrollmentId: string, paymentIds: string[]) {
  for (const paymentId of paymentIds) await deleteRecord(request, superToken, 'student_payments', paymentId)
  await deleteRecord(request, superToken, 'enrollments', enrollmentId)
  await deleteRecord(request, superToken, 'users', studentId)
}

test('15B.4A: resumen económico responde al contexto, método y situación del alumno sin romper móvil', async ({ page, request }) => {
  test.setTimeout(45_000)
  const admin = await authenticate(request, 'users', requiredEnv('E2E_ADMIN_EMAIL'), requiredEnv('E2E_ADMIN_PASSWORD'))
  const superuser = await authenticate(request, '_superusers', requiredEnv('PB_SUPERUSER_EMAIL'), requiredEnv('PB_SUPERUSER_PASSWORD'))
  const fixture = await createTemporaryStudentEnrollment(request, admin)
  const dates = localMonth()
  const paymentIds: string[] = []

  try {
    const paid = await createPayment(request, admin, {
      student: fixture.studentId, enrollment: fixture.enrollmentId, billing_mode: 'INTENSIVE', amount_cents: 6100,
      period_start: dates.day(6), period_end: dates.end, due_date: dates.day(6), status: 'PAID', paid_at: dates.today,
      payment_method: 'BIZUM', reference: 'E2E-15B4A-PAID', notes: 'Pago operativo 15B.4A',
    })
    paymentIds.push(paid.id)
    const overdue = await createPayment(request, admin, {
      student: fixture.studentId, enrollment: fixture.enrollmentId, billing_mode: 'INTENSIVE', amount_cents: 4300,
      period_start: dates.day(7), period_end: dates.day(8), due_date: dates.yesterday, status: 'PENDING', paid_at: '',
      payment_method: '', reference: 'E2E-15B4A-OVERDUE', notes: 'Deuda operativa 15B.4A',
    })
    paymentIds.push(overdue.id)
    const refunded = await createPayment(request, admin, {
      student: fixture.studentId, enrollment: fixture.enrollmentId, billing_mode: 'INTENSIVE', amount_cents: 2500,
      period_start: dates.day(9), period_end: dates.day(10), due_date: dates.day(9), status: 'PAID', paid_at: dates.today,
      payment_method: 'TRANSFER', reference: 'E2E-15B4A-REFUND', notes: 'Reembolso operativo 15B.4A',
    })
    paymentIds.push(refunded.id)
    const refundResponse = await request.patch(`${PB_URL}/api/collections/student_payments/records/${refunded.id}`, {
      headers: { Authorization: admin.token }, data: { status: 'REFUNDED' },
    })
    expect(refundResponse.status(), await refundResponse.text()).toBe(200)

    await loginAdmin(page)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/admin/pagos')
    await expect(page.getByRole('heading', { name: 'Pagos de alumnos' })).toBeVisible()

    const toolbar = page.locator('.admin-payments-toolbar')
    await expect(toolbar).toBeVisible()
    await toolbar.getByRole('combobox', { name: 'Alumno', exact: true }).selectOption(fixture.studentId)
    await toolbar.getByRole('combobox', { name: 'Modalidad', exact: true }).selectOption('INTENSIVE')
    await toolbar.getByLabel('Mes').fill(dates.month)

    await expect(page.getByTestId('payment-summary-obligations')).toContainText('129,00')
    await expect(page.getByTestId('payment-summary-paid')).toContainText('61,00')
    await expect(page.getByTestId('payment-summary-pending')).toContainText('0,00')
    await expect(page.getByTestId('payment-summary-overdue')).toContainText('43,00')
    await expect(page.getByTestId('payment-summary-refunded')).toContainText('25,00')
    await expect(page.getByTestId('payment-summary-debt-students')).toHaveText('1')
    await expect(page.getByTestId('payment-summary-current-students')).toHaveText('0')
    await expect(page.getByTestId('payment-method-bizum')).toContainText('61,00')
    await expect(page.getByTestId('payment-method-bizum')).toContainText('1 cobro')

    await page.getByRole('button', { name: 'Vencidos' }).click()
    await expect(page.locator('.payment-record')).toHaveCount(1)
    await expect(page.locator('.payment-record').first()).toContainText('43,00')
    await expect(page.getByTestId('payment-summary-obligations')).toContainText('129,00')

    await page.getByRole('button', { name: 'Todos', exact: true }).click()
    await toolbar.getByRole('combobox', { name: 'Método', exact: true }).selectOption('BIZUM')
    await expect(page.getByTestId('payment-summary-obligations')).toContainText('61,00')
    await expect(page.getByTestId('payment-summary-paid')).toContainText('61,00')
    await expect(page.getByTestId('payment-summary-debt-students')).toHaveText('0')
    await expect(page.getByTestId('payment-summary-current-students')).toHaveText('1')

    await toolbar.getByRole('combobox', { name: 'Método', exact: true }).selectOption('ALL')
    await page.getByRole('button', { name: 'Reembolsados' }).click()
    await expect(page.locator('.payment-record')).toHaveCount(1)
    await expect(page.locator('.payment-record').first()).toContainText('25,00')
    await expect(page.locator('.payment-record').first()).toContainText('Reembolsado')

    await page.getByRole('button', { name: 'Todos', exact: true }).click()
    await page.getByRole('button', { name: 'Con deuda' }).click()
    await expect(page.locator('.payment-record')).toHaveCount(3)

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByTestId('payment-summary-obligations')).toBeVisible()
    await expect(page.getByTestId('payment-method-bizum')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  } finally {
    await cleanupTemporaryPaymentStudent(request, superuser.token, fixture.studentId, fixture.enrollmentId, paymentIds)
  }
})
