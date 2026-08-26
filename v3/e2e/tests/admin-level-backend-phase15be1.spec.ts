import { expect, test, type APIRequestContext } from '@playwright/test'
import { createPrivilegedUser } from '../helpers/privileged-users'

const PB_URL = 'http://127.0.0.1:8090'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

async function authenticateCollection(request: APIRequestContext, collection: string, email: string, password: string) {
  const response = await request.post(`${PB_URL}/api/collections/${collection}/auth-with-password`, { data: { identity: email, password } })
  expect(response.status(), await response.text()).toBe(200)
  return response.json() as Promise<{ token: string; record: { id: string } }>
}

async function createTemporaryStudent(request: APIRequestContext) {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const email = `e2e-level-${unique}@example.com`
  const password = 'E2eTempLevelPass123!'
  const response = await createPrivilegedUser<{ id: string }>(request, {
    email, password, name: 'Level', surname: 'History', role: 'STUDENT', status: 'ACTIVE', phone: '',
  })
  expect([200, 201]).toContain(response.status)
  const record = response.body
  const auth = await authenticateCollection(request, 'users', email, password)
  expect(auth.record.id).toBe(record.id)
  return { id: record.id, token: auth.token }
}

async function completeCampusAttempt(request: APIRequestContext, studentToken: string) {
  const start = await request.post(`${PB_URL}/api/language-school/placement/start`, {
    headers: { Authorization: studentToken }, data: { mode: 'CAMPUS' },
  })
  expect([200, 201]).toContain(start.status())
  const session = await start.json() as { attemptId: string; totalQuestions: number }
  expect(session.totalQuestions).toBe(30)

  let safety = 0
  while (safety < 30) {
    safety += 1
    const next = await request.get(`${PB_URL}/api/language-school/placement/attempts/${session.attemptId}/question`, {
      headers: { Authorization: studentToken },
    })
    expect(next.status()).toBe(200)
    const payload = await next.json() as { complete?: boolean; question?: { id: string } }
    if (payload.complete) break
    expect(payload.question?.id).toBeTruthy()
    const answer = await request.post(`${PB_URL}/api/language-school/placement/attempts/${session.attemptId}/answer`, {
      headers: { Authorization: studentToken }, data: { questionId: payload.question?.id, optionId: 'a' },
    })
    expect(answer.status()).toBe(200)
  }

  const finish = await request.post(`${PB_URL}/api/language-school/placement/attempts/${session.attemptId}/finish`, {
    headers: { Authorization: studentToken }, data: {},
  })
  expect(finish.status(), await finish.text()).toBe(200)
  const result = await finish.json() as { attemptId: string; estimatedLevel: string; scorePercent: number }
  expect(result).toMatchObject({ attemptId: session.attemptId, estimatedLevel: 'C2', scorePercent: 100 })
  return result
}

async function listRecords(request: APIRequestContext, superToken: string, collection: string) {
  const response = await request.get(`${PB_URL}/api/collections/${collection}/records?perPage=500`, { headers: { Authorization: superToken } })
  expect(response.status(), await response.text()).toBe(200)
  return (await response.json() as { items: Array<Record<string, unknown> & { id: string }> }).items
}

async function deleteRecord(request: APIRequestContext, superToken: string, collection: string, id: string) {
  const response = await request.delete(`${PB_URL}/api/collections/${collection}/records/${id}`, { headers: { Authorization: superToken } })
  expect([200, 204]).toContain(response.status())
}

async function cleanupTemporaryStudent(request: APIRequestContext, superToken: string, studentId: string) {
  const assessments = (await listRecords(request, superToken, 'student_level_assessments')).filter((item) => item.student === studentId)
  for (const assessment of assessments) await deleteRecord(request, superToken, 'student_level_assessments', assessment.id)
  const attempts = (await listRecords(request, superToken, 'placement_attempts')).filter((item) => item.student === studentId)
  const attemptIds = new Set(attempts.map((item) => item.id))
  const answers = (await listRecords(request, superToken, 'placement_answers')).filter((item) => typeof item.attempt === 'string' && attemptIds.has(item.attempt))
  for (const answer of answers) await deleteRecord(request, superToken, 'placement_answers', answer.id)
  for (const attempt of attempts) await deleteRecord(request, superToken, 'placement_attempts', attempt.id)
  await deleteRecord(request, superToken, 'users', studentId)
}

test('15B.3E.1: Admin añade nivel acumulativo y no puede reescribir histórico ni test automático', async ({ request }) => {
  const admin = await authenticateCollection(request, 'users', requiredEnv('E2E_ADMIN_EMAIL'), requiredEnv('E2E_ADMIN_PASSWORD'))
  const superuser = await authenticateCollection(request, '_superusers', requiredEnv('PB_SUPERUSER_EMAIL'), requiredEnv('PB_SUPERUSER_PASSWORD'))
  const student = await createTemporaryStudent(request)
  const summaryUrl = `${PB_URL}/api/language-school/placement/admin/students/${student.id}/summary`
  const assessmentUrl = `${PB_URL}/api/language-school/placement/admin/students/${student.id}/assessments`

  try {
    const anonymous = await request.get(summaryUrl)
    expect(anonymous.status()).toBe(401)

    const before = await request.get(summaryUrl, { headers: { Authorization: admin.token } })
    expect(before.status()).toBe(200)
    expect(before.headers()['cache-control']).toContain('no-store')
    expect(await before.json()).toMatchObject({ currentLevel: '', currentLevelSource: 'NONE', assessmentHistory: [] })

    const invalidFirstReview = await request.post(assessmentUrl, {
      headers: { Authorization: admin.token }, data: { validatedLevel: 'B1', reason: 'REVIEW', notes: 'No debe aceptarse como primera valoración manual.' },
    })
    expect(invalidFirstReview.status()).toBe(400)

    const initialResponse = await request.post(assessmentUrl, {
      headers: { Authorization: admin.token },
      data: { validatedLevel: 'B1', speakingLevel: 'B1', reason: 'INITIAL', notes: 'Entrevista inicial de academia.', assessedBy: 'forged-user', automaticLevel: 'C2' },
    })
    expect(initialResponse.status(), await initialResponse.text()).toBe(201)
    const initial = await initialResponse.json() as { assessment: { id: string; validatedLevel: string; automaticLevel: string; sourceAttemptId: string; assessedBy: string; reason: string } }
    expect(initial.assessment).toMatchObject({ validatedLevel: 'B1', automaticLevel: '', sourceAttemptId: '', assessedBy: admin.record.id, reason: 'INITIAL' })

    const duplicateInitial = await request.post(assessmentUrl, {
      headers: { Authorization: admin.token }, data: { validatedLevel: 'B2', reason: 'INITIAL' },
    })
    expect(duplicateInitial.status()).toBe(400)

    const directAssessmentPatch = await request.patch(`${PB_URL}/api/collections/student_level_assessments/records/${initial.assessment.id}`, {
      headers: { Authorization: admin.token }, data: { validated_level: 'A1' },
    })
    expect([403, 404]).toContain(directAssessmentPatch.status())
    const directAssessmentDelete = await request.delete(`${PB_URL}/api/collections/student_level_assessments/records/${initial.assessment.id}`, {
      headers: { Authorization: admin.token },
    })
    expect([403, 404]).toContain(directAssessmentDelete.status())

    const automatic = await completeCampusAttempt(request, student.token)
    const reviewResponse = await request.post(assessmentUrl, {
      headers: { Authorization: admin.token },
      data: { sourceAttemptId: automatic.attemptId, validatedLevel: 'B2', speakingLevel: 'B2', reason: 'REVIEW', notes: 'Revisión de academia posterior al test; se mantiene la evidencia automática.', automaticLevel: 'A1', assessedBy: 'forged-user' },
    })
    expect(reviewResponse.status(), await reviewResponse.text()).toBe(201)
    const review = await reviewResponse.json() as {
      assessment: { automaticLevel: string; validatedLevel: string; sourceAttemptId: string; assessedBy: string; reason: string }
      summary: { currentLevel: string; currentLevelSource: string; latestAttempt: { id: string; estimatedLevel: string }; assessmentHistory: Array<{ id: string; reason: string }> }
    }
    expect(review.assessment).toMatchObject({ automaticLevel: 'C2', validatedLevel: 'B2', sourceAttemptId: automatic.attemptId, assessedBy: admin.record.id, reason: 'REVIEW' })
    expect(review.summary.currentLevel).toBe('B2')
    expect(review.summary.currentLevelSource).toBe('VALIDATED')
    expect(review.summary.latestAttempt).toMatchObject({ id: automatic.attemptId, estimatedLevel: 'C2' })
    expect(review.summary.assessmentHistory).toHaveLength(2)
    expect(review.summary.assessmentHistory.map((item) => item.reason)).toEqual(['REVIEW', 'INITIAL'])

    const directAttemptPatch = await request.patch(`${PB_URL}/api/collections/placement_attempts/records/${automatic.attemptId}`, {
      headers: { Authorization: admin.token }, data: { estimated_level: 'A1', score_percent: 1 },
    })
    expect([403, 404]).toContain(directAttemptPatch.status())
    const directAttemptDelete = await request.delete(`${PB_URL}/api/collections/placement_attempts/records/${automatic.attemptId}`, { headers: { Authorization: admin.token } })
    expect([403, 404]).toContain(directAttemptDelete.status())

    const after = await request.get(summaryUrl, { headers: { Authorization: admin.token } })
    expect(after.status()).toBe(200)
    const finalSummary = await after.json() as { currentLevel: string; currentLevelSource: string; latestAttempt: { estimatedLevel: string; scorePercent: number }; assessmentHistory: Array<{ reason: string; validatedLevel: string }> }
    expect(finalSummary.currentLevel).toBe('B2')
    expect(finalSummary.currentLevelSource).toBe('VALIDATED')
    expect(finalSummary.latestAttempt).toMatchObject({ estimatedLevel: 'C2', scorePercent: 100 })
    expect(finalSummary.assessmentHistory).toHaveLength(2)
    expect(finalSummary.assessmentHistory[1]).toMatchObject({ reason: 'INITIAL', validatedLevel: 'B1' })
  } finally {
    await cleanupTemporaryStudent(request, superuser.token, student.id)
  }
})
