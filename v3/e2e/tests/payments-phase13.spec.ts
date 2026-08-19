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

function localDateParts() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const last = new Date(year, now.getMonth() + 1, 0, 12).getDate()
  return {
    month: `${year}-${month}`,
    start: `${year}-${month}-01`,
    end: `${year}-${month}-${String(last).padStart(2, '0')}`,
    due: `${year}-${month}-05`,
    today: `${year}-${month}-${String(now.getDate()).padStart(2, '0')}`,
  }
}

async function expectNoPaymentRead(request: APIRequestContext, token: string) {
  const list = await request.get(`${PB_URL}/api/collections/student_payments/records?perPage=10`, { headers: { Authorization: token } })
  if (list.status() === 200) {
    const body = await list.json() as { items?: unknown[]; totalItems?: number }
    expect(body.items || []).toHaveLength(0)
    expect(body.totalItems || 0).toBe(0)
  } else {
    expect([403, 404]).toContain(list.status())
  }
}

async function adminPaymentCount(request: APIRequestContext, token: string): Promise<number> {
  const list = await request.get(`${PB_URL}/api/collections/student_payments/records?perPage=1`, { headers: { Authorization: token } })
  expect(list.status(), await list.text()).toBe(200)
  const body = await list.json() as { totalItems?: number }
  return body.totalItems || 0
}

test('13B: la colección económica queda bloqueada para Profesor y Alumno', async ({ request }) => {
  const admin = await authenticate(request, requiredEnv('E2E_ADMIN_EMAIL'), requiredEnv('E2E_ADMIN_PASSWORD'))
  const teacher = await authenticate(request, requiredEnv('E2E_TEACHER_EMAIL'), requiredEnv('E2E_TEACHER_PASSWORD'))
  const student = await authenticate(request, requiredEnv('E2E_STUDENT_EMAIL'), requiredEnv('E2E_STUDENT_PASSWORD'))

  const enrollmentsResponse = await request.get(`${PB_URL}/api/collections/enrollments/records?perPage=10`, { headers: { Authorization: student.token } })
  expect(enrollmentsResponse.status(), await enrollmentsResponse.text()).toBe(200)
  const enrollmentBody = await enrollmentsResponse.json() as { items: Array<{ id: string; student: string }> }
  const enrollment = enrollmentBody.items.find((item) => item.student === student.id)
  expect(enrollment).toBeTruthy()

  await expectNoPaymentRead(request, teacher.token)
  await expectNoPaymentRead(request, student.token)

  const before = await adminPaymentCount(request, admin.token)
  const dates = localDateParts()
  for (const actor of [teacher, student]) {
    const create = await request.post(`${PB_URL}/api/collections/student_payments/records`, {
      headers: { Authorization: actor.token },
      data: {
        student: student.id,
        enrollment: enrollment!.id,
        billing_mode: 'MONTHLY',
        amount_cents: 5500,
        period_start: dates.start,
        period_end: dates.end,
        due_date: dates.due,
        status: 'PENDING',
        recorded_by: admin.id,
      },
    })
    expect(create.ok()).toBe(false)
  }
  const after = await adminPaymentCount(request, admin.token)
  expect(after).toBe(before)
})

test('13C-D: Admin registra una mensualidad, la cobra y la ficha del alumno refleja el histórico', async ({ page, request }) => {
  const dates = localDateParts()
  const studentAccount = await authenticate(request, requiredEnv('E2E_STUDENT_EMAIL'), requiredEnv('E2E_STUDENT_PASSWORD'))
  await loginAdmin(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/admin/pagos')
  await expect(page.getByRole('heading', { name: 'Pagos de alumnos' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Menú de Administrador' }).getByRole('link', { name: 'Pagos' })).toHaveAttribute('aria-current', 'page')

  await page.getByRole('button', { name: '+ Nuevo cobro' }).click()
  const create = page.locator('.admin-payment-create')
  const studentSelect = create.getByLabel('Alumno')
  const studentEmail = requiredEnv('E2E_STUDENT_EMAIL')
  const studentOption = studentSelect.locator(`option[value="${studentAccount.id}"]`)
  await expect(studentOption).toHaveCount(1)
  const selectedStudentName = (await studentOption.textContent())?.trim() || ''
  expect(selectedStudentName).toBeTruthy()
  await studentSelect.selectOption(studentAccount.id)

  const enrollmentSelect = create.getByLabel('Matrícula')
  await expect.poll(async () => enrollmentSelect.locator('option').count()).toBeGreaterThan(1)
  const enrollmentValue = await enrollmentSelect.locator('option').nth(1).getAttribute('value')
  expect(enrollmentValue).toBeTruthy()
  await enrollmentSelect.selectOption(enrollmentValue!)

  const record = page.locator('.payment-record').filter({ hasText: selectedStudentName }).filter({ hasText: '55,00' }).first()
  if (await record.count() === 0) {
    await create.getByLabel('Modalidad').selectOption('MONTHLY')
    await create.getByLabel('Importe (€)').fill('55')
    await create.getByLabel('Inicio del periodo').fill(dates.start)
    await create.getByLabel('Fin del periodo').fill(dates.end)
    await create.getByLabel('Vencimiento').fill(dates.due)
    await create.getByRole('button', { name: 'Crear pendiente' }).click()
    await expect(page.getByText('Cobro pendiente creado correctamente.')).toBeVisible()
  }

  await expect(record).toBeVisible()
  const markPaid = record.getByRole('button', { name: 'Marcar pagado' })
  if (await markPaid.count()) {
    await expect(record.getByText(/Pendiente|Vencido/)).toBeVisible()
    await markPaid.click()
    const payPanel = page.locator('.payment-pay-panel')
    await payPanel.getByLabel('Fecha de pago').fill(dates.today)
    await payPanel.getByLabel('Método').selectOption('BIZUM')
    await payPanel.getByRole('button', { name: 'Confirmar pago' }).click()
    await expect(page.getByText('Pago registrado correctamente.')).toBeVisible()
  }
  await expect(record.getByText('Pagado')).toBeVisible()

  await page.goto('/admin/alumnos')
  const row = page.locator('.students-table-row').filter({ hasText: studentEmail }).first()
  await expect(row).toBeVisible()
  await row.click()
  const summary = page.locator('.student-payment-summary')
  await expect(summary).toBeVisible()
  await expect(summary.getByText('Al corriente')).toBeVisible()
  await expect(summary.getByText('55,00')).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(summary).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
