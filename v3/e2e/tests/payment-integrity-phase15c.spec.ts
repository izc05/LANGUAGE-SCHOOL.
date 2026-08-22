import { expect, test, type APIRequestContext } from '@playwright/test'

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

test('15C: pagos conservan alumno + matrícula y transiciones económicas coherentes en backend', async ({ request }) => {
  const admin = await authenticate(request, 'users', requiredEnv('E2E_ADMIN_EMAIL'), requiredEnv('E2E_ADMIN_PASSWORD'))
  const superuser = await authenticate(request, '_superusers', requiredEnv('PB_SUPERUSER_EMAIL'), requiredEnv('PB_SUPERUSER_PASSWORD'))

  const enrollmentsResponse = await request.get(`${PB_URL}/api/collections/enrollments/records?perPage=50&filter=status%3D%22ACTIVE%22`, {
    headers: { Authorization: admin.token },
  })
  expect(enrollmentsResponse.status(), await enrollmentsResponse.text()).toBe(200)
  const enrollments = await enrollmentsResponse.json() as { items: Array<{ id: string; student: string }> }
  const enrollment = enrollments.items.find((item) => Boolean(item.student))
  expect(enrollment).toBeTruthy()

  const uniqueDay = String((Date.now() % 20) + 1).padStart(2, '0')
  const base = {
    enrollment: enrollment!.id,
    billing_mode: 'INTENSIVE',
    amount_cents: 4321,
    period_start: `2098-12-${uniqueDay}`,
    period_end: `2098-12-${uniqueDay}`,
    due_date: `2098-12-${uniqueDay}`,
    status: 'PENDING',
    paid_at: '',
    payment_method: '',
    reference: '15C payment integrity',
    notes: '',
    recorded_by: admin.id,
  }

  const mismatchedStudent = await request.post(`${PB_URL}/api/collections/student_payments/records`, {
    headers: { Authorization: admin.token },
    data: { ...base, student: admin.id },
  })
  expect(mismatchedStudent.status(), await mismatchedStudent.text()).toBe(400)

  const forgedRecorder = await request.post(`${PB_URL}/api/collections/student_payments/records`, {
    headers: { Authorization: admin.token },
    data: { ...base, student: enrollment!.student, recorded_by: enrollment!.student },
  })
  expect(forgedRecorder.status(), await forgedRecorder.text()).toBe(400)

  const create = await request.post(`${PB_URL}/api/collections/student_payments/records`, {
    headers: { Authorization: admin.token },
    data: { ...base, student: enrollment!.student },
  })
  expect(create.status(), await create.text()).toBe(200)
  const record = await create.json() as { id: string }

  try {
    const rewriteIdentity = await request.patch(`${PB_URL}/api/collections/student_payments/records/${record.id}`, {
      headers: { Authorization: admin.token },
      data: { student: admin.id },
    })
    expect(rewriteIdentity.status(), await rewriteIdentity.text()).toBe(404)

    const pendingCorrection = await request.patch(`${PB_URL}/api/collections/student_payments/records/${record.id}`, {
      headers: { Authorization: admin.token },
      data: { amount_cents: 4322, status: 'PENDING' },
    })
    expect(pendingCorrection.status(), await pendingCorrection.text()).toBe(200)

    const invalidRefund = await request.patch(`${PB_URL}/api/collections/student_payments/records/${record.id}`, {
      headers: { Authorization: admin.token },
      data: { status: 'REFUNDED' },
    })
    expect(invalidRefund.status(), await invalidRefund.text()).toBe(400)

    const paidWithoutEvidence = await request.patch(`${PB_URL}/api/collections/student_payments/records/${record.id}`, {
      headers: { Authorization: admin.token },
      data: { status: 'PAID' },
    })
    expect(paidWithoutEvidence.status(), await paidWithoutEvidence.text()).toBe(400)

    const paid = await request.patch(`${PB_URL}/api/collections/student_payments/records/${record.id}`, {
      headers: { Authorization: admin.token },
      data: { status: 'PAID', paid_at: '2098-12-15', payment_method: 'BIZUM' },
    })
    expect(paid.status(), await paid.text()).toBe(200)

    const rewriteSettledAmount = await request.patch(`${PB_URL}/api/collections/student_payments/records/${record.id}`, {
      headers: { Authorization: admin.token },
      data: { amount_cents: 9999 },
    })
    expect(rewriteSettledAmount.status(), await rewriteSettledAmount.text()).toBe(400)

    const reopen = await request.patch(`${PB_URL}/api/collections/student_payments/records/${record.id}`, {
      headers: { Authorization: admin.token },
      data: { status: 'PENDING' },
    })
    expect(reopen.status(), await reopen.text()).toBe(400)

    const refund = await request.patch(`${PB_URL}/api/collections/student_payments/records/${record.id}`, {
      headers: { Authorization: admin.token },
      data: { status: 'REFUNDED', notes: 'Reembolso E2E' },
    })
    expect(refund.status(), await refund.text()).toBe(200)
  } finally {
    const cleanup = await request.delete(`${PB_URL}/api/collections/student_payments/records/${record.id}`, {
      headers: { Authorization: superuser.token },
    })
    expect([200, 204]).toContain(cleanup.status())
  }
})
