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

function futureMonth(monthsAhead: number) {
  const now = new Date()
  const target = new Date(now.getFullYear(), now.getMonth() + monthsAhead, 1, 12)
  const year = target.getFullYear()
  const monthNumber = target.getMonth() + 1
  const month = String(monthNumber).padStart(2, '0')
  const lastDay = new Date(year, monthNumber, 0, 12).getDate()
  return {
    start: `${year}-${month}-01`,
    end: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
    due: `${year}-${month}-05`,
  }
}

test('15B.4C: la ficha del alumno permite revisar y descargar todo su historial económico sin romper móvil', async ({ page, request }) => {
  test.setTimeout(60_000)
  const admin = await authenticate(request, requiredEnv('E2E_ADMIN_EMAIL'), requiredEnv('E2E_ADMIN_PASSWORD'))
  const student = await authenticate(request, requiredEnv('E2E_STUDENT_EMAIL'), requiredEnv('E2E_STUDENT_PASSWORD'))
  const enrollmentsResponse = await request.get(`${PB_URL}/api/collections/enrollments/records?perPage=20`, { headers: { Authorization: student.token } })
  expect(enrollmentsResponse.status(), await enrollmentsResponse.text()).toBe(200)
  const enrollmentBody = await enrollmentsResponse.json() as { items: Array<{ id: string; student: string }> }
  const enrollment = enrollmentBody.items.find((item) => item.student === student.id)
  expect(enrollment).toBeTruthy()

  const createdIds: string[] = []
  try {
    for (let index = 0; index < 7; index += 1) {
      const dates = futureMonth(48 + index)
      const paid = index === 0
      const response = await request.post(`${PB_URL}/api/collections/student_payments/records`, {
        headers: { Authorization: admin.token },
        data: {
          student: student.id,
          enrollment: enrollment!.id,
          billing_mode: 'MONTHLY',
          amount_cents: 7100 + (index * 100),
          period_start: dates.start,
          period_end: dates.end,
          due_date: dates.due,
          status: paid ? 'PAID' : 'PENDING',
          ...(paid ? { paid_at: dates.start, payment_method: 'TRANSFER' } : {}),
          reference: `phase15b4c-${index}`,
          notes: 'E2E historial económico completo',
          recorded_by: admin.id,
        },
      })
      expect(response.status(), await response.text()).toBe(200)
      const record = await response.json() as { id: string }
      createdIds.push(record.id)
    }

    await loginAdmin(page)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(`/admin/alumnos/${student.id}`)

    const card = page.locator('.phase14-payment-card')
    await expect(card).toBeVisible()
    await expect(card.getByRole('heading', { name: 'Situación económica' })).toBeVisible()
    await expect(card.getByRole('button', { name: 'Descargar historial' })).toBeEnabled()
    await expect(card.getByRole('button', { name: /Ver historial completo \(/ })).toBeVisible()

    const historyRows = card.getByTestId('student-payment-history').locator(':scope > div')
    await expect(historyRows).toHaveCount(6)
    await card.getByRole('button', { name: /Ver historial completo \(/ }).click()
    await expect.poll(async () => historyRows.count()).toBeGreaterThanOrEqual(7)
    await expect(card.getByRole('button', { name: 'Mostrar los 6 más recientes' })).toBeVisible()

    const excelPromise = page.waitForEvent('download')
    await card.getByRole('button', { name: 'Descargar historial' }).click()
    const excel = await excelPromise
    expect(excel.suggestedFilename()).toMatch(/^pagos-language-school-historial-.*\.xls$/)
    const excelPath = await excel.path()
    expect(excelPath).toBeTruthy()
    const excelBody = await readFile(excelPath!, 'utf8')
    expect(excelBody).toContain('<Worksheet ss:Name="Resumen">')
    expect(excelBody).toContain('<Worksheet ss:Name="Pagos">')
    expect(excelBody).toContain(requiredEnv('E2E_STUDENT_EMAIL'))
    await expect(page.getByText(/Historial económico completo preparado con \d+ movimiento/)).toBeVisible()

    const receiptButton = card.getByRole('button', { name: /Justificante de/ }).first()
    await expect(receiptButton).toBeVisible()
    const receiptPromise = page.waitForEvent('download')
    await receiptButton.click()
    const receipt = await receiptPromise
    expect(receipt.suggestedFilename()).toMatch(/^justificante-pago-.*\.pdf$/)
    const receiptPath = await receipt.path()
    expect(receiptPath).toBeTruthy()
    const pdfBody = (await readFile(receiptPath!)).toString('latin1')
    expect(pdfBody.startsWith('%PDF-1.4')).toBe(true)
    expect(pdfBody).toContain('JUSTIFICANTE DE PAGO - NO FACTURA')

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(card).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  } finally {
    for (const id of createdIds.reverse()) {
      await request.delete(`${PB_URL}/api/collections/student_payments/records/${id}`, { headers: { Authorization: admin.token } })
    }
  }
})
