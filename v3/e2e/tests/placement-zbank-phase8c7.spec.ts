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

async function completePublic(request: APIRequestContext): Promise<string[]> {
  const start = await request.post(`${PB_URL}/api/language-school/placement/start`, { data: { mode: 'PUBLIC' } })
  expect(start.status()).toBe(201)
  const session = await start.json() as { attemptId: string; token: string; totalQuestions: number }
  expect(session.totalQuestions).toBe(15)
  const ids: string[] = []

  for (let index = 0; index < session.totalQuestions; index += 1) {
    const next = await request.get(`${PB_URL}/api/language-school/placement/attempts/${session.attemptId}/question`, {
      headers: { 'X-Placement-Token': session.token },
    })
    expect(next.status()).toBe(200)
    const body = await next.json() as { question?: { id: string; options: Array<{ id: string }> } }
    expect(body.question?.id).toBeTruthy()
    expect(body.question?.options.length).toBe(4)
    ids.push(body.question!.id)
    const answer = await request.post(`${PB_URL}/api/language-school/placement/attempts/${session.attemptId}/answer`, {
      headers: { 'X-Placement-Token': session.token },
      data: { questionId: body.question!.id, optionId: body.question!.options[0].id },
    })
    expect(answer.status()).toBe(200)
  }

  const finish = await request.post(`${PB_URL}/api/language-school/placement/attempts/${session.attemptId}/finish`, {
    headers: { 'X-Placement-Token': session.token }, data: {},
  })
  expect(finish.status()).toBe(200)
  return ids
}

async function completeCampus(request: APIRequestContext, token: string): Promise<string[]> {
  const start = await request.post(`${PB_URL}/api/language-school/placement/start`, {
    headers: { Authorization: token }, data: { mode: 'CAMPUS' },
  })
  expect([200, 201]).toContain(start.status())
  const session = await start.json() as { attemptId: string; totalQuestions: number }
  expect(session.totalQuestions).toBe(30)
  const ids: string[] = []

  for (let index = 0; index < session.totalQuestions; index += 1) {
    const next = await request.get(`${PB_URL}/api/language-school/placement/attempts/${session.attemptId}/question`, {
      headers: { Authorization: token },
    })
    expect(next.status()).toBe(200)
    const body = await next.json() as { question?: { id: string; options: Array<{ id: string }> } }
    expect(body.question?.id).toBeTruthy()
    ids.push(body.question!.id)
    const answer = await request.post(`${PB_URL}/api/language-school/placement/attempts/${session.attemptId}/answer`, {
      headers: { Authorization: token },
      data: { questionId: body.question!.id, optionId: body.question!.options[0].id },
    })
    expect(answer.status()).toBe(200)
  }

  const finish = await request.post(`${PB_URL}/api/language-school/placement/attempts/${session.attemptId}/finish`, {
    headers: { Authorization: token }, data: {},
  })
  expect(finish.status()).toBe(200)
  return ids
}

function intersection(left: string[], right: string[]): string[] {
  const rightSet = new Set(right)
  return [...new Set(left)].filter((id) => rightSet.has(id))
}

test('8C.7: banco real tiene 72 variantes y Campus evita repetir la versión anterior', async ({ request }) => {
  const admin = await authenticate(request, requiredEnv('E2E_ADMIN_EMAIL'), requiredEnv('E2E_ADMIN_PASSWORD'))
  const student = await authenticate(request, requiredEnv('E2E_STUDENT_EMAIL'), requiredEnv('E2E_STUDENT_PASSWORD'))

  const testsResponse = await request.get(`${PB_URL}/api/language-school/placement/admin/tests`, {
    headers: { Authorization: admin.token },
  })
  expect(testsResponse.status()).toBe(200)
  const tests = (await testsResponse.json() as {
    tests: Array<{ id: string; version: string; status: string; validation: { ready: boolean; questionCount: number; activeQuestionCount: number; requirements: Array<{ skill: string; level: string; available: number; required: number; ready: boolean }> } }>
  }).tests
  const baseline = tests.find((item) => item.version === 'ls-cefr-2026-v1')
  expect(baseline).toBeTruthy()
  expect(baseline).toMatchObject({ status: 'DRAFT' })
  expect(baseline!.validation).toMatchObject({ ready: true, questionCount: 72, activeQuestionCount: 72 })
  expect(baseline!.validation.requirements).toHaveLength(18)
  baseline!.validation.requirements.forEach((cell) => {
    expect(cell.available).toBe(4)
    expect(cell.ready).toBe(true)
    expect(cell.available).toBeGreaterThanOrEqual(cell.required)
  })

  const bankResponse = await request.get(`${PB_URL}/api/language-school/placement/admin/tests/${baseline!.id}/questions`, {
    headers: { Authorization: admin.token },
  })
  expect(bankResponse.status()).toBe(200)
  const bankText = await bankResponse.text()
  const bank = JSON.parse(bankText) as { questions: Array<{ code: string; skill: string; cefrLevel: string; correctOptionId: string; options: Array<{ id: string }> }> }
  expect(bank.questions).toHaveLength(72)
  expect(new Set(bank.questions.map((question) => question.code)).size).toBe(72)
  const cells = new Map<string, Array<{ correctOptionId: string }>>()
  bank.questions.forEach((question) => {
    const key = `${question.skill}:${question.cefrLevel}`
    cells.set(key, [...(cells.get(key) || []), question])
  })
  expect(cells.size).toBe(18)
  cells.forEach((cell) => {
    expect(cell).toHaveLength(4)
    expect(cell.map((question) => question.correctOptionId).sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  const allowRetake = await request.patch(`${PB_URL}/api/language-school/placement/admin/tests/${baseline!.id}`, {
    headers: { Authorization: admin.token }, data: { campusRetakeDays: 0 },
  })
  expect(allowRetake.status()).toBe(200)
  const publish = await request.post(`${PB_URL}/api/language-school/placement/admin/tests/${baseline!.id}/publish`, {
    headers: { Authorization: admin.token }, data: {},
  })
  expect(publish.status()).toBe(200)
  expect((await publish.json() as { test: { status: string; version: string } }).test).toMatchObject({ status: 'PUBLISHED', version: 'ls-cefr-2026-v1' })

  const publicOne = await completePublic(request)
  const publicTwo = await completePublic(request)
  expect(publicOne).toHaveLength(15)
  expect(publicTwo).toHaveLength(15)
  expect(new Set(publicOne).size).toBe(15)
  expect(new Set(publicTwo).size).toBe(15)
  expect(intersection(publicOne, publicTwo).length).toBeLessThan(15)

  const campusOne = await completeCampus(request, student.token)
  const campusTwo = await completeCampus(request, student.token)
  expect(campusOne).toHaveLength(30)
  expect(campusTwo).toHaveLength(30)
  expect(new Set(campusOne).size).toBe(30)
  expect(new Set(campusTwo).size).toBe(30)
  expect(intersection(campusOne, campusTwo)).toEqual([])

  const overview = await request.get(`${PB_URL}/api/language-school/placement/admin/overview`, {
    headers: { Authorization: admin.token },
  })
  expect(overview.status()).toBe(200)
  const overviewBody = await overview.json() as { recentAttempts: Array<{ testVersion: string }> }
  expect(overviewBody.recentAttempts.some((attempt) => attempt.testVersion === 'ls-cefr-2026-v1')).toBe(true)
})
