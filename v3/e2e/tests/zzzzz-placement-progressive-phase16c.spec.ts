import { expect, test, type APIRequestContext } from '@playwright/test'

const PB_URL = 'http://127.0.0.1:8090'
const ALG = 'cefr-v3-progressive'

function env(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

async function auth(request: APIRequestContext, email: string, password: string) {
  const response = await request.post(`${PB_URL}/api/collections/users/auth-with-password`, {
    data: { identity: email, password },
  })
  expect(response.status()).toBe(200)
  return response.json() as Promise<{ token: string }>
}

type AdminQuestion = {
  id: string
  cefrLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
  correctOptionId: string
}

type PublicQuestion = {
  complete: false
  position: number
  total: number
  question: { id: string; options: Array<{ id: string }> }
}

type Session = { attemptId: string; token: string; totalQuestions: number; algorithmVersion: string }

async function start(request: APIRequestContext): Promise<Session> {
  const response = await request.post(`${PB_URL}/api/language-school/placement/start`, { data: { mode: 'PUBLIC' } })
  expect(response.status()).toBe(201)
  const session = await response.json() as Session
  expect(session).toMatchObject({ totalQuestions: 12, algorithmVersion: ALG })
  return session
}

async function next(request: APIRequestContext, session: Session): Promise<PublicQuestion> {
  const response = await request.get(`${PB_URL}/api/language-school/placement/attempts/${session.attemptId}/question`, {
    headers: { 'X-Placement-Token': session.token },
  })
  expect(response.status()).toBe(200)
  const text = await response.text()
  expect(text).not.toContain('correctOptionId')
  expect(text).not.toContain('correct_option_id')
  const question = JSON.parse(text) as PublicQuestion
  expect(question.complete).toBe(false)
  expect(question.total).toBe(12)
  return question
}

async function runRoute(
  request: APIRequestContext,
  questions: Map<string, AdminQuestion>,
  calibrationCorrect: 0 | 2 | 3,
  branchCorrect: (question: AdminQuestion) => boolean,
) {
  const session = await start(request)
  let current = await next(request, session)
  const branchLevels: string[] = []

  for (let position = 1; position <= 12; position += 1) {
    expect(current.position).toBe(position)
    const meta = questions.get(current.question.id)
    expect(meta).toBeTruthy()
    if (!meta) throw new Error('Question not found in admin map')

    if (position <= 3) expect(meta.cefrLevel).toBe('B1')
    else branchLevels.push(meta.cefrLevel)

    const correct = position <= 3 ? position <= calibrationCorrect : branchCorrect(meta)
    const optionId = correct
      ? meta.correctOptionId
      : current.question.options.find((option) => option.id !== meta.correctOptionId)?.id
    expect(optionId).toBeTruthy()

    const answer = await request.post(`${PB_URL}/api/language-school/placement/attempts/${session.attemptId}/answer`, {
      headers: { 'X-Placement-Token': session.token },
      data: { questionId: current.question.id, optionId },
    })
    expect(answer.status()).toBe(200)
    if (position < 12) current = await next(request, session)
  }

  const finish = await request.post(`${PB_URL}/api/language-school/placement/attempts/${session.attemptId}/finish`, {
    headers: { 'X-Placement-Token': session.token },
    data: {},
  })
  expect(finish.status()).toBe(200)
  const result = await finish.json() as {
    algorithmVersion: string
    estimatedLevel: string
    rawScore: number
    maxScore: number
    skillScores: Record<string, { total: number }>
  }
  expect(result.algorithmVersion).toBe(ALG)
  expect(result.maxScore).toBe(12)
  expect(result.skillScores.GRAMMAR.total).toBe(4)
  expect(result.skillScores.VOCABULARY.total).toBe(4)
  expect(result.skillScores.READING.total).toBe(4)
  return { result, branchLevels }
}

test('16C: ruta progresiva A1/B2/C2 y Campus completo', async ({ request }) => {
  const admin = await auth(request, env('E2E_ADMIN_EMAIL'), env('E2E_ADMIN_PASSWORD'))
  const outsider = await auth(request, env('E2E_OUTSIDER_EMAIL'), env('E2E_OUTSIDER_PASSWORD'))

  const listResponse = await request.get(`${PB_URL}/api/language-school/placement/admin/tests`, {
    headers: { Authorization: admin.token },
  })
  expect(listResponse.status()).toBe(200)
  const tests = (await listResponse.json() as {
    tests: Array<{ id: string; version: string; validation: { questionCount: number } }>
  }).tests
  const source = tests.find((item) => item.version === 'ls-cefr-2026-v1')
    || tests.find((item) => item.validation.questionCount >= 72)
  expect(source).toBeTruthy()
  if (!source) throw new Error('Baseline bank not found')

  const create = await request.post(`${PB_URL}/api/language-school/placement/admin/progressive/tests`, {
    headers: { Authorization: admin.token },
    data: {
      sourceTestId: source.id,
      name: 'E2E Progressive Placement',
      version: `e2e-progressive-${Date.now().toString(36)}`,
    },
  })
  expect(create.status()).toBe(201)
  const created = await create.json() as {
    testId: string
    validation: { ready: boolean; questionCount: number; publicQuestionCount: number; campusQuestionCount: number }
  }
  expect(created.validation).toMatchObject({ ready: true, questionCount: 72, publicQuestionCount: 12, campusQuestionCount: 30 })

  const bankResponse = await request.get(`${PB_URL}/api/language-school/placement/admin/tests/${created.testId}/questions`, {
    headers: { Authorization: admin.token },
  })
  expect(bankResponse.status()).toBe(200)
  const bank = (await bankResponse.json() as { questions: AdminQuestion[] }).questions
  expect(bank).toHaveLength(72)
  const byId = new Map(bank.map((question) => [question.id, question]))

  const publish = await request.post(`${PB_URL}/api/language-school/placement/admin/progressive/tests/${created.testId}/publish`, {
    headers: { Authorization: admin.token }, data: {},
  })
  expect(publish.status()).toBe(200)
  expect(await publish.json()).toMatchObject({ status: 'PUBLISHED', algorithmVersion: ALG, validation: { ready: true } })

  const low = await runRoute(request, byId, 0, () => false)
  expect([...new Set(low.branchLevels)].sort()).toEqual(['A1', 'A2'])
  expect(low.result).toMatchObject({ estimatedLevel: 'A1', rawScore: 0 })

  const middle = await runRoute(request, byId, 2, (question) => question.cefrLevel === 'B1' || question.cefrLevel === 'B2')
  expect([...new Set(middle.branchLevels)].sort()).toEqual(['B1', 'B2', 'C1'])
  expect(middle.result.estimatedLevel).toBe('B2')

  const high = await runRoute(request, byId, 3, () => true)
  expect([...new Set(high.branchLevels)].sort()).toEqual(['B2', 'C1', 'C2'])
  expect(high.result).toMatchObject({ estimatedLevel: 'C2', rawScore: 12 })

  const campusStart = await request.post(`${PB_URL}/api/language-school/placement/start`, {
    headers: { Authorization: outsider.token }, data: { mode: 'CAMPUS' },
  })
  expect(campusStart.status()).toBe(201)
  const campus = await campusStart.json() as { attemptId: string; totalQuestions: number; algorithmVersion: string }
  expect(campus).toMatchObject({ totalQuestions: 30, algorithmVersion: ALG })

  const campusQuestion = await request.get(`${PB_URL}/api/language-school/placement/attempts/${campus.attemptId}/question`, {
    headers: { Authorization: outsider.token },
  })
  expect(campusQuestion.status()).toBe(200)
  const campusText = await campusQuestion.text()
  expect(campusText).not.toContain('correct_option_id')
  expect(JSON.parse(campusText)).toMatchObject({ complete: false, total: 30 })
})
