import { expect, test, type APIRequestContext } from '@playwright/test'

const PB_URL = 'http://127.0.0.1:8090'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

async function authenticate(request: APIRequestContext, email: string, password: string) {
  const response = await request.post(`${PB_URL}/api/collections/users/auth-with-password`, {
    data: { identity: email, password },
  })
  expect(response.status()).toBe(200)
  return response.json() as Promise<{ token: string; record: { id: string } }>
}

async function createUnevaluatedStudent(request: APIRequestContext, adminToken: string) {
  const groupsResponse = await request.get(`${PB_URL}/api/collections/groups/records?perPage=100&expand=course,teacher`, {
    headers: { Authorization: adminToken },
  })
  expect(groupsResponse.status()).toBe(200)
  const groups = await groupsResponse.json() as {
    items: Array<{ id: string; course: string; status: string; capacity: number }>
  }
  const enrollmentsResponse = await request.get(`${PB_URL}/api/collections/enrollments/records?perPage=500`, {
    headers: { Authorization: adminToken },
  })
  expect(enrollmentsResponse.status()).toBe(200)
  const enrollments = await enrollmentsResponse.json() as { items: Array<{ group: string; status: string }> }
  const group = groups.items.find((candidate) => {
    if (candidate.status !== 'ACTIVE') return false
    const occupied = enrollments.items.filter((item) => item.group === candidate.id && item.status === 'ACTIVE').length
    return occupied < candidate.capacity
  })
  expect(group).toBeTruthy()

  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const response = await request.post(`${PB_URL}/api/language-school/admin/student-onboarding/complete`, {
    headers: { Authorization: adminToken },
    data: {
      email: `e2e-level-${unique}@example.com`,
      name: 'Level',
      surname: 'History',
      phone: '',
      birthDate: '',
      guardianName: '',
      guardianPhone: '',
      notesPrivate: 'Alumno temporal 15B.3E.1',
      levelMode: 'UNEVALUATED',
      initialLevel: '',
      levelNotes: '',
      expectedCourseId: group?.course,
      targetGroupId: group?.id,
      acknowledgeLevelMismatch: false,
      activationBaseUrl: '',
    },
  })
  expect(response.status()).toBe(201)
  return response.json() as Promise<{ userId: string }>
}

async function createCompletedAutomaticAttempt(request: APIRequestContext, adminToken: string, studentId: string) {
  const testsResponse = await request.get(`${PB_URL}/api/collections/placement_tests/records?perPage=100`, {
    headers: { Authorization: adminToken },
  })
  expect(testsResponse.status()).toBe(200)
  const tests = await testsResponse.json() as { items: Array<{ id: string; status: string; algorithm_version: string }> }
  const placementTest = tests.items.find((item) => item.status === 'PUBLISHED') || tests.items[0]
  expect(placementTest).toBeTruthy()

  const now = new Date().toISOString()
  const response = await request.post(`${PB_URL}/api/collections/placement_attempts/records`, {
    headers: { Authorization: adminToken },
    data: {
      test: placementTest?.id,
      mode: 'CAMPUS',
      student: studentId,
      public_token_hash: '',
      status: 'COMPLETED',
      algorithm_version: placementTest?.algorithm_version || 'e2e-15b3e',
      selection_snapshot: {},
      started_at: now,
      completed_at: now,
      raw_score: 84,
      max_score: 100,
      score_percent: 84,
      estimated_level: 'C1',
      skill_scores: {},
    },
  })
  expect(response.status()).toBe(200)
  return response.json() as Promise<{ id: string; estimated_level: string }>
}

test('15B.3E.1: Admin añade nivel acumulativo y no puede reescribir histórico ni test automático', async ({ request }) => {
  const admin = await authenticate(request, requiredEnv('E2E_ADMIN_EMAIL'), requiredEnv('E2E_ADMIN_PASSWORD'))
  const student = await createUnevaluatedStudent(request, admin.token)
  const summaryUrl = `${PB_URL}/api/language-school/placement/admin/students/${student.userId}/summary`
  const assessmentUrl = `${PB_URL}/api/language-school/placement/admin/students/${student.userId}/assessments`

  const anonymous = await request.get(summaryUrl)
  expect(anonymous.status()).toBe(401)

  const before = await request.get(summaryUrl, { headers: { Authorization: admin.token } })
  expect(before.status()).toBe(200)
  expect(before.headers()['cache-control']).toContain('no-store')
  expect(await before.json()).toMatchObject({ currentLevel: '', currentLevelSource: 'NONE', assessmentHistory: [] })

  const invalidFirstReview = await request.post(assessmentUrl, {
    headers: { Authorization: admin.token },
    data: { validatedLevel: 'B1', reason: 'REVIEW', notes: 'No debe aceptarse como primera valoración manual.' },
  })
  expect(invalidFirstReview.status()).toBe(400)

  const initialResponse = await request.post(assessmentUrl, {
    headers: { Authorization: admin.token },
    data: {
      validatedLevel: 'B1',
      speakingLevel: 'B1',
      reason: 'INITIAL',
      notes: 'Entrevista inicial de academia.',
      assessedBy: 'forged-user',
      automaticLevel: 'C2',
    },
  })
  expect(initialResponse.status()).toBe(201)
  const initial = await initialResponse.json() as {
    assessment: { id: string; validatedLevel: string; automaticLevel: string; sourceAttemptId: string; assessedBy: string; reason: string }
  }
  expect(initial.assessment).toMatchObject({
    validatedLevel: 'B1',
    automaticLevel: '',
    sourceAttemptId: '',
    assessedBy: admin.record.id,
    reason: 'INITIAL',
  })

  const duplicateInitial = await request.post(assessmentUrl, {
    headers: { Authorization: admin.token },
    data: { validatedLevel: 'B2', reason: 'INITIAL' },
  })
  expect(duplicateInitial.status()).toBe(400)

  const directAssessmentPatch = await request.patch(`${PB_URL}/api/collections/student_level_assessments/records/${initial.assessment.id}`, {
    headers: { Authorization: admin.token },
    data: { validated_level: 'A1' },
  })
  expect([403, 404]).toContain(directAssessmentPatch.status())

  const directAssessmentDelete = await request.delete(`${PB_URL}/api/collections/student_level_assessments/records/${initial.assessment.id}`, {
    headers: { Authorization: admin.token },
  })
  expect([403, 404]).toContain(directAssessmentDelete.status())

  const automatic = await createCompletedAutomaticAttempt(request, admin.token, student.userId)
  expect(automatic.estimated_level).toBe('C1')

  const reviewResponse = await request.post(assessmentUrl, {
    headers: { Authorization: admin.token },
    data: {
      sourceAttemptId: automatic.id,
      validatedLevel: 'B2',
      speakingLevel: 'B2',
      reason: 'REVIEW',
      notes: 'Revisión de academia posterior al test; se mantiene la evidencia automática.',
      automaticLevel: 'A1',
      assessedBy: 'forged-user',
    },
  })
  expect(reviewResponse.status()).toBe(201)
  const review = await reviewResponse.json() as {
    assessment: { automaticLevel: string; validatedLevel: string; sourceAttemptId: string; assessedBy: string; reason: string }
    summary: { currentLevel: string; currentLevelSource: string; latestAttempt: { id: string; estimatedLevel: string }; assessmentHistory: Array<{ id: string; reason: string }> }
  }
  expect(review.assessment).toMatchObject({
    automaticLevel: 'C1',
    validatedLevel: 'B2',
    sourceAttemptId: automatic.id,
    assessedBy: admin.record.id,
    reason: 'REVIEW',
  })
  expect(review.summary.currentLevel).toBe('B2')
  expect(review.summary.currentLevelSource).toBe('VALIDATED')
  expect(review.summary.latestAttempt).toMatchObject({ id: automatic.id, estimatedLevel: 'C1' })
  expect(review.summary.assessmentHistory).toHaveLength(2)
  expect(review.summary.assessmentHistory.map((item) => item.reason)).toEqual(['REVIEW', 'INITIAL'])

  const directAttemptPatch = await request.patch(`${PB_URL}/api/collections/placement_attempts/records/${automatic.id}`, {
    headers: { Authorization: admin.token },
    data: { estimated_level: 'A1', score_percent: 1 },
  })
  expect([403, 404]).toContain(directAttemptPatch.status())

  const directAttemptDelete = await request.delete(`${PB_URL}/api/collections/placement_attempts/records/${automatic.id}`, {
    headers: { Authorization: admin.token },
  })
  expect([403, 404]).toContain(directAttemptDelete.status())

  const after = await request.get(summaryUrl, { headers: { Authorization: admin.token } })
  expect(after.status()).toBe(200)
  const finalSummary = await after.json() as {
    currentLevel: string
    currentLevelSource: string
    latestAttempt: { estimatedLevel: string; scorePercent: number }
    assessmentHistory: Array<{ reason: string; validatedLevel: string }>
  }
  expect(finalSummary.currentLevel).toBe('B2')
  expect(finalSummary.currentLevelSource).toBe('VALIDATED')
  expect(finalSummary.latestAttempt).toMatchObject({ estimatedLevel: 'C1', scorePercent: 84 })
  expect(finalSummary.assessmentHistory).toHaveLength(2)
  expect(finalSummary.assessmentHistory[1]).toMatchObject({ reason: 'INITIAL', validatedLevel: 'B1' })
})
