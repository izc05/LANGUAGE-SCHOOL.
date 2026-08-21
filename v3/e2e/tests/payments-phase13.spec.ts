import { readFile } from 'node:fs/promises'
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

function futureMonthParts(monthsAhead = 4) {
  const now = new Date()
  const target = new Date(now.getFullYear(), now.getMonth() + monthsAhead, 1, 12)
  const year = target.getFullYear()
  const monthNumber = target.getMonth() + 1
  const month = String(monthNumber).padStart(2, '0')
  const last = new Date(year, monthNumber, 0, 12).getDate()
  return {
    month: `${year}-${month}`,
    start: `${year}-${month}-01`,
    end: `${year}-${month}-${String(last).padStart(2, '0')}`,
    due: `${year}-${month}-05`,
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

test('13C-D + 14C + 15B.4B: Admin cobra, filtra por curso y exporta Excel + justificante PDF', async ({ page, request }) => {
  const dates = localDateParts()
  const studentAccount = await authenticate(request, requiredEnv('E2E_STUDENT_EMAIL'), requiredEnv('E2E_STUDENT_PASSWORD'))
  const adminAccount = await authenticate(request, requiredEnv('E2E_ADMIN_EMAIL'), requiredEnv('E2E_ADMIN_PASSWORD'))
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

  const enrollmentResponse = await request.get(`${PB_URL}/api/collections/enrollments/records/${enrollmentValue}?expand=group.course`, {
    headers: { Authorization: adminAccount.token },
  })
  expect(enrollmentResponse.status(), await enrollmentResponse.text()).toBe(200)
  const expandedEnrollment = await enrollmentResponse.json() as { expand?: { group?: { course?: string } } }
  const courseId = expandedEnrollment.expand?.group?.course || ''
  expect(courseId).toBeTruthy()

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
    await expect(record.getByRole('button', { name: 'Justificante PDF' })).toHaveCount(0)
    await markPaid.click()
    const payPanel = page.locator('.payment-pay-panel')
    await payPanel.getByLabel('Fecha de pago').fill(dates.today)
    await payPanel.getByLabel('Método').selectOption('BIZUM')
    await payPanel.getByRole('button', { name: 'Confirmar pago' }).click()
    await expect(page.getByText('Pago registrado correctamente.')).toBeVisible()
  }
  await expect(record.getByText('Pagado')).toBeVisible()
  await expect(record.getByRole('button', { name: 'Justificante PDF' })).toBeVisible()

  const toolbar = page.locator('.admin-payments-toolbar')
  const courseFilter = toolbar.getByRole('combobox', { name: 'Curso', exact: true })
  await expect(courseFilter.locator(`option[value="${courseId}"]`)).toHaveCount(1)
  await courseFilter.selectOption(courseId)
  await expect(record).toBeVisible()
  await courseFilter.selectOption('ALL')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar Excel' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^pagos-language-school-.*\.xls$/)
  const excelPath = await download.path()
  expect(excelPath).toBeTruthy()
  const excelBody = await readFile(excelPath!, 'utf8')
  expect(excelBody).toContain('<Worksheet ss:Name="Resumen">')
  expect(excelBody).toContain('Cobros por método')
  expect(excelBody).toContain('<Worksheet ss:Name="Pagos">')
  await expect(page.getByText(/Excel preparado con resumen económico y \d+ registro/)).toBeVisible()

  const receiptPromise = page.waitForEvent('download')
  await record.getByRole('button', { name: 'Justificante PDF' }).click()
  const receipt = await receiptPromise
  expect(receipt.suggestedFilename()).toMatch(/^justificante-pago-.*\.pdf$/)
  const receiptPath = await receipt.path()
  expect(receiptPath).toBeTruthy()
  const pdfBody = (await readFile(receiptPath!)).toString('latin1')
  expect(pdfBody.startsWith('%PDF-1.4')).toBe(true)
  expect(pdfBody).toContain('JUSTIFICANTE DE PAGO - NO FACTURA')
  expect(pdfBody).toContain('ID interno del pago:')
  await expect(page.getByText(/Justificante PDF preparado:/)).toBeVisible()

  await page.goto('/admin/alumnos')
  const search = page.locator('.admin-student-directory-phase14').getByLabel('Buscar')
  await search.fill(studentEmail)
  const row = page.locator('.phase14-student-row').filter({ hasText: studentEmail }).first()
  await expect(row).toBeVisible()
  await row.click()
  await expect(page).toHaveURL(new RegExp(`/admin/alumnos/${studentAccount.id}$`))

  const paymentCard = page.locator('.phase14-payment-card')
  await expect(paymentCard).toBeVisible()
  await expect(paymentCard.getByText('Al corriente')).toBeVisible()
  await expect(paymentCard.getByText('55,00')).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(paymentCard).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('13E: Admin genera mensualidades por grupo y el mismo mes no se duplica', async ({ page, request }) => {
  const admin = await authenticate(request, requiredEnv('E2E_ADMIN_EMAIL'), requiredEnv('E2E_ADMIN_PASSWORD'))
  const dates = futureMonthParts(4)
  await loginAdmin(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/admin/pagos')

  await page.getByRole('button', { name: 'Generar mensualidades' }).click()
  const batch = page.locator('.admin-payment-batch')
  await expect(batch).toBeVisible()
  await expect(batch.getByRole('heading', { name: 'Mensualidades por grupo' })).toBeVisible()

  const groupSelect = batch.getByLabel('Grupo')
  await expect.poll(async () => groupSelect.locator('option').count()).toBeGreaterThan(1)
  const groupId = await groupSelect.locator('option').nth(1).getAttribute('value')
  expect(groupId).toBeTruthy()
  await groupSelect.selectOption(groupId!)
  await batch.getByLabel('Mes').fill(dates.month)
  await batch.getByLabel('Importe por alumno (€)').fill('61')
  await batch.getByLabel('Vencimiento').fill(dates.due)

  const active = Number(await batch.getByTestId('batch-active-count').textContent())
  const existing = Number(await batch.getByTestId('batch-existing-count').textContent())
  const missing = Number(await batch.getByTestId('batch-missing-count').textContent())
  expect(active).toBeGreaterThan(0)
  expect(existing + missing).toBe(active)

  const before = await adminPaymentCount(request, admin.token)
  if (missing > 0) {
    await batch.getByRole('button', { name: new RegExp(`Generar ${missing} mensualidad`) }).click()
    await expect(page.getByText(/mensualidad(?:es)? creada/)).toBeVisible()
  }
  await expect(batch.getByTestId('batch-missing-count')).toHaveText('0')
  await expect(batch.getByRole('button', { name: 'Nada pendiente de generar' })).toBeDisabled()
  const afterFirst = await adminPaymentCount(request, admin.token)
  expect(afterFirst).toBe(before + missing)

  await page.reload()
  await page.getByRole('button', { name: 'Generar mensualidades' }).click()
  const batchAgain = page.locator('.admin-payment-batch')
  await batchAgain.getByLabel('Grupo').selectOption(groupId!)
  await batchAgain.getByLabel('Mes').fill(dates.month)
  await expect(batchAgain.getByTestId('batch-existing-count')).toHaveText(String(active))
  await expect(batchAgain.getByTestId('batch-missing-count')).toHaveText('0')
  await expect(batchAgain.getByRole('button', { name: 'Nada pendiente de generar' })).toBeDisabled()
  expect(await adminPaymentCount(request, admin.token)).toBe(afterFirst)

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(batchAgain).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
