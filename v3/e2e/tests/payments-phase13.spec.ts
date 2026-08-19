import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

async function authToken(request: APIRequestContext, email: string, password: string): Promise<string> {
  const response = await request.post(`${PB_URL}/api/collections/users/auth-with-password`, { data: { identity: email, password } })
  expect(response.status(), await response.text()).toBe(200)
  const body = await response.json() as { token: string }
  return body.token
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

test('13B: la colección económica queda bloqueada para Profesor y Alumno', async ({ request }) => {
  const teacherToken = await authToken(request, requiredEnv('E2E_TEACHER_EMAIL'), requiredEnv('E2E_TEACHER_PASSWORD'))
  const studentToken = await authToken(request, requiredEnv('E2E_STUDENT_EMAIL'), requiredEnv('E2E_STUDENT_PASSWORD'))

  for (const token of [teacherToken, studentToken]) {
    const list = await request.get(`${PB_URL}/api/collections/student_payments/records?perPage=1`, { headers: { Authorization: token } })
    expect([403, 404]).toContain(list.status())
    const create = await request.post(`${PB_URL}/api/collections/student_payments/records`, {
      headers: { Authorization: token },
      data: { student: 'forbidden', enrollment: 'forbidden', billing_mode: 'MONTHLY', amount_cents: 5500, period_start: '2026-08-01', period_end: '2026-08-31', due_date: '2026-08-05', status: 'PENDING', recorded_by: 'forbidden' },
    })
    expect([403, 404]).toContain(create.status())
  }
})

test('13C-D: Admin registra una mensualidad, la cobra y la ficha del alumno refleja el histórico', async ({ page }) => {
  const dates = localDateParts()
  await loginAdmin(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/admin/pagos')
  await expect(page.getByRole('heading', { name: 'Pagos de alumnos' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Menú de Administrador' }).getByRole('link', { name: 'Pagos' })).toHaveAttribute('aria-current', 'page')

  await page.getByRole('button', { name: '+ Nuevo cobro' }).click()
  const create = page.locator('.admin-payment-create')
  const studentSelect = create.getByLabel('Alumno')
  const studentEmail = requiredEnv('E2E_STUDENT_EMAIL')
  const targetOption = studentSelect.locator('option').filter({ hasText: /.+/ }).nth(1)
  const optionValue = await targetOption.getAttribute('value')
  expect(optionValue).toBeTruthy()
  await studentSelect.selectOption(optionValue!)

  const enrollmentSelect = create.getByLabel('Matrícula')
  await expect.poll(async () => enrollmentSelect.locator('option').count()).toBeGreaterThan(1)
  const enrollmentValue = await enrollmentSelect.locator('option').nth(1).getAttribute('value')
  await enrollmentSelect.selectOption(enrollmentValue!)

  await create.getByLabel('Modalidad').selectOption('MONTHLY')
  await create.getByLabel('Importe (€)').fill('55')
  await create.getByLabel('Inicio del periodo').fill(dates.start)
  await create.getByLabel('Fin del periodo').fill(dates.end)
  await create.getByLabel('Vencimiento').fill(dates.due)
  await create.getByRole('button', { name: 'Crear pendiente' }).click()
  await expect(page.getByText('Cobro pendiente creado correctamente.')).toBeVisible()

  const record = page.locator('.payment-record').filter({ hasText: '55,00' }).first()
  await expect(record).toBeVisible()
  await expect(record.getByText(/Pendiente|Vencido/)).toBeVisible()
  await record.getByRole('button', { name: 'Marcar pagado' }).click()
  const payPanel = page.locator('.payment-pay-panel')
  await payPanel.getByLabel('Fecha de pago').fill(dates.today)
  await payPanel.getByLabel('Método').selectOption('BIZUM')
  await payPanel.getByRole('button', { name: 'Confirmar pago' }).click()
  await expect(page.getByText('Pago registrado correctamente.')).toBeVisible()
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
