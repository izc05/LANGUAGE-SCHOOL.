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

function localMonth() {
  const now = new Date()
  const year = now.getFullYear()
  const monthNumber = now.getMonth() + 1
  const month = String(monthNumber).padStart(2, '0')
  const lastDay = new Date(year, monthNumber, 0, 12).getDate()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
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
    headers: { Authorization: admin.token },
    data: { ...data, recorded_by: admin.id },
  })
  expect(response.status(), await response.text()).toBe(200)
  return await response.json() as { id: string }
}

test('15B.4A: resumen económico responde al contexto, método y situación del alumno sin romper móvil', async ({ page, request }) => {
  const admin = await authenticate(request, requiredEnv('E2E_ADMIN_EMAIL'), requiredEnv('E2E_ADMIN_PASSWORD'))
  const student = await authenticate(request, requiredEnv('E2E_STUDENT_EMAIL'), requiredEnv('E2E_STUDENT_PASSWORD'))
  const dates = localMonth()

  const enrollmentsResponse = await request.get(`${PB_URL}/api/collections/enrollments/records?perPage=50`, { headers: { Authorization: student.token } })
  expect(enrollmentsResponse.status(), await enrollmentsResponse.text()).toBe(200)
  const enrollmentBody = await enrollmentsResponse.json() as { items: Array<{ id: string; student: string; status: string }> }
  const enrollment = enrollmentBody.items.find((item) => item.student === student.id && item.status === 'ACTIVE')
  expect(enrollment).toBeTruthy()

  await createPayment(request, admin, {
    student: student.id,
    enrollment: enrollment!.id,
    billing_mode: 'INTENSIVE',
    amount_cents: 6100,
    period_start: dates.day(6),
    period_end: dates.end,
    due_date: dates.day(6),
    status: 'PAID',
    paid_at: dates.today,
    payment_method: 'BIZUM',
    reference: 'E2E-15B4A-PAID',
    notes: 'Pago operativo 15B.4A',
  })

  await createPayment(request, admin, {
    student: student.id,
    enrollment: enrollment!.id,
    billing_mode: 'INTENSIVE',
    amount_cents: 4300,
    period_start: dates.day(7),
    period_end: dates.day(8),
    due_date: dates.yesterday,
    status: 'PENDING',
    paid_at: '',
    payment_method: '',
    reference: 'E2E-15B4A-OVERDUE',
    notes: 'Deuda operativa 15B.4A',
  })

  const refunded = await createPayment(request, admin, {
    student: student.id,
    enrollment: enrollment!.id,
    billing_mode: 'INTENSIVE',
    amount_cents: 2500,
    period_start: dates.day(9),
    period_end: dates.day(10),
    due_date: dates.day(9),
    status: 'PAID',
    paid_at: dates.today,
    payment_method: 'TRANSFER',
    reference: 'E2E-15B4A-REFUND',
    notes: 'Reembolso operativo 15B.4A',
  })
  const refundResponse = await request.patch(`${PB_URL}/api/collections/student_payments/records/${refunded.id}`, {
    headers: { Authorization: admin.token },
    data: { status: 'REFUNDED' },
  })
  expect(refundResponse.status(), await refundResponse.text()).toBe(200)

  await loginAdmin(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/admin/pagos')
  await expect(page.getByRole('heading', { name: 'Pagos de alumnos' })).toBeVisible()

  await page.getByLabel('Alumno').selectOption(student.id)
  await page.getByLabel('Modalidad').selectOption('INTENSIVE')
  await page.getByLabel('Mes').fill(dates.month)

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

  await page.getByRole('button', { name: 'Todos' }).click()
  await page.getByLabel('Método').selectOption('BIZUM')
  await expect(page.getByTestId('payment-summary-obligations')).toContainText('61,00')
  await expect(page.getByTestId('payment-summary-paid')).toContainText('61,00')
  await expect(page.getByTestId('payment-summary-debt-students')).toHaveText('0')
  await expect(page.getByTestId('payment-summary-current-students')).toHaveText('1')

  await page.getByLabel('Método').selectOption('ALL')
  await page.getByRole('button', { name: 'Reembolsados' }).click()
  await expect(page.locator('.payment-record')).toHaveCount(1)
  await expect(page.locator('.payment-record').first()).toContainText('25,00')
  await expect(page.locator('.payment-record').first()).toContainText('Reembolsado')

  await page.getByRole('button', { name: 'Todos' }).click()
  await page.getByRole('button', { name: 'Con deuda' }).click()
  await expect(page.locator('.payment-record')).toHaveCount(3)

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByTestId('payment-summary-obligations')).toBeVisible()
  await expect(page.getByTestId('payment-method-bizum')).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
