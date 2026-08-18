import { expect, test, type Page } from '@playwright/test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const placementCore = require('../../pocketbase/pb_hooks/placement_core.js') as {
  PUBLIC_BLUEPRINT: Array<{ skill: string; level: string; count: number }>
  CAMPUS_BLUEPRINT: Array<{ skill: string; level: string; count: number }>
  candidateLevelFromPercent: (percent: number) => string
  calculateCefrV1: (items: Array<{ skill: string; level: string; correct: boolean }>, mode: 'PUBLIC' | 'CAMPUS') => {
    rawScore: number
    scorePercent: number
    estimatedLevel: string
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

const PB_URL = 'http://127.0.0.1:8090'
const credentials = {
  student: { email: requiredEnv('E2E_STUDENT_EMAIL'), password: requiredEnv('E2E_STUDENT_PASSWORD') },
  outsider: { email: requiredEnv('E2E_OUTSIDER_EMAIL'), password: requiredEnv('E2E_OUTSIDER_PASSWORD') },
}

async function login(page: Page, email: string, password: string, expectedPath: RegExp) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(expectedPath)
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/acceso$/)
}

async function connectedRequest(
  page: Page,
  path: string,
  method: 'GET' | 'POST' = 'GET',
  body?: Record<string, unknown>,
) {
  return page.evaluate(async ({ path, method, body }) => {
    const stored = JSON.parse(localStorage.getItem('pocketbase_auth') || '{}') as { token?: string }
    const response = await fetch(`http://127.0.0.1:8090${path}`, {
      method,
      headers: {
        ...(stored.token ? { Authorization: stored.token } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    let payload: unknown = null
    try { payload = await response.json() } catch { payload = null }
    return { status: response.status, body: payload, cacheControl: response.headers.get('cache-control') }
  }, { path, method, body })
}

test('8C.1: cefr-v1 cubre límites A1–C2 y guardias de evidencia', () => {
  const thresholds: Array<[number, string]> = [
    [0, 'A1'], [19, 'A1'], [20, 'A2'], [34, 'A2'], [35, 'B1'], [49, 'B1'],
    [50, 'B2'], [64, 'B2'], [65, 'C1'], [79, 'C1'], [80, 'C2'], [100, 'C2'],
  ]
  thresholds.forEach(([percent, level]) => expect(placementCore.candidateLevelFromPercent(percent)).toBe(level))

  const fromBlueprint = (
    blueprint: Array<{ skill: string; level: string; count: number }>,
    decide: (cell: { skill: string; level: string; count: number }, ordinal: number) => boolean,
  ) => blueprint.flatMap((cell) => Array.from({ length: cell.count }, (_, ordinal) => ({
    skill: cell.skill, level: cell.level, correct: decide(cell, ordinal),
  })))

  expect(placementCore.calculateCefrV1(fromBlueprint(placementCore.PUBLIC_BLUEPRINT, () => true), 'PUBLIC')).toMatchObject({
    rawScore: 15, scorePercent: 100, estimatedLevel: 'C2',
  })
  expect(placementCore.calculateCefrV1(fromBlueprint(placementCore.PUBLIC_BLUEPRINT, () => false), 'PUBLIC')).toMatchObject({
    rawScore: 0, scorePercent: 0, estimatedLevel: 'A1',
  })
  expect(placementCore.calculateCefrV1(
    fromBlueprint(placementCore.PUBLIC_BLUEPRINT, (cell) => cell.level !== 'C2'),
    'PUBLIC',
  )).toMatchObject({ rawScore: 13, scorePercent: 86.67, estimatedLevel: 'C1' })

  let campusC2Seen = 0
  let otherWrong = 5
  const campusPass = fromBlueprint(placementCore.CAMPUS_BLUEPRINT, (cell) => {
    if (cell.level === 'C2') { campusC2Seen += 1; return campusC2Seen <= 4 }
    if (otherWrong > 0) { otherWrong -= 1; return false }
    return true
  })
  expect(placementCore.calculateCefrV1(campusPass, 'CAMPUS')).toMatchObject({
    rawScore: 24, scorePercent: 80, estimatedLevel: 'C2',
  })

  campusC2Seen = 0
  otherWrong = 4
  const campusFail = fromBlueprint(placementCore.CAMPUS_BLUEPRINT, (cell) => {
    if (cell.level === 'C2') { campusC2Seen += 1; return campusC2Seen <= 3 }
    if (otherWrong > 0) { otherWrong -= 1; return false }
    return true
  })
  expect(placementCore.calculateCefrV1(campusFail, 'CAMPUS')).toMatchObject({
    rawScore: 24, scorePercent: 80, estimatedLevel: 'C1',
  })
})

test('8C.1: PUBLIC usa token opaco, no expone answer key y calcula C2 solo en servidor', async ({ request }) => {
  const directQuestionList = await request.get(`${PB_URL}/api/collections/placement_questions/records?perPage=5`)
  expect([200, 403]).toContain(directQuestionList.status())
  if (directQuestionList.status() === 200) {
    const directBody = await directQuestionList.json() as { items?: unknown[] }
    expect(directBody.items ?? []).toHaveLength(0)
  }

  const start = await request.post(`${PB_URL}/api/language-school/placement/start`, { data: { mode: 'PUBLIC' } })
  expect(start.status()).toBe(201)
  expect(start.headers()['cache-control']).toContain('no-store')
  const started = await start.json() as { attemptId: string; token: string; totalQuestions: number; mode: string }
  expect(started.mode).toBe('PUBLIC')
  expect(started.totalQuestions).toBe(15)
  expect(started.token.length).toBeGreaterThanOrEqual(40)

  const denied = await request.get(`${PB_URL}/api/language-school/placement/attempts/${started.attemptId}/question`, {
    headers: { 'X-Placement-Token': `${started.token}tampered` },
  })
  expect(denied.status()).toBe(403)

  for (let index = 0; index < 15; index += 1) {
    const questionResponse = await request.get(`${PB_URL}/api/language-school/placement/attempts/${started.attemptId}/question`, {
      headers: { 'X-Placement-Token': started.token },
    })
    expect(questionResponse.status()).toBe(200)
    expect(questionResponse.headers()['cache-control']).toContain('no-store')
    const questionText = await questionResponse.text()
    expect(questionText).not.toContain('correct_option_id')
    expect(questionText).not.toContain('internal_explanation')
    expect(questionText).not.toContain('is_correct')
    expect(questionText).not.toContain('points_awarded')

    const payload = JSON.parse(questionText) as {
      complete: boolean
      question?: { id: string; options: Array<{ id: string; label: string }> }
    }
    expect(payload.complete).toBe(false)
    expect(payload.question).toBeTruthy()
    expect(payload.question?.options).toHaveLength(3)

    const answer = await request.post(`${PB_URL}/api/language-school/placement/attempts/${started.attemptId}/answer`, {
      headers: { 'X-Placement-Token': started.token },
      data: { questionId: payload.question?.id, optionId: 'a' },
    })
    expect(answer.status()).toBe(200)
    const answerText = await answer.text()
    expect(answerText).not.toContain('is_correct')
    expect(answerText).not.toContain('correct')
  }

  const forgedFinish = await request.post(`${PB_URL}/api/language-school/placement/attempts/${started.attemptId}/finish`, {
    headers: { 'X-Placement-Token': started.token },
    data: { scorePercent: 100, estimatedLevel: 'C2' },
  })
  expect(forgedFinish.status()).toBe(400)

  const finish = await request.post(`${PB_URL}/api/language-school/placement/attempts/${started.attemptId}/finish`, {
    headers: { 'X-Placement-Token': started.token },
    data: {},
  })
  expect(finish.status()).toBe(200)
  const result = await finish.json() as {
    status: string
    estimatedLevel: string
    rawScore: number
    maxScore: number
    scorePercent: number
    skillScores: Record<string, { percent: number }>
  }
  expect(result.status).toBe('COMPLETED')
  expect(result.estimatedLevel).toBe('C2')
  expect(result.rawScore).toBe(15)
  expect(result.maxScore).toBe(15)
  expect(result.scorePercent).toBe(100)
  expect(result.skillScores.GRAMMAR.percent).toBe(100)
  expect(result.skillScores.VOCABULARY.percent).toBe(100)
  expect(result.skillScores.READING.percent).toBe(100)

  const repeatedFinish = await request.post(`${PB_URL}/api/language-school/placement/attempts/${started.attemptId}/finish`, {
    headers: { 'X-Placement-Token': started.token },
    data: {},
  })
  expect(repeatedFinish.status()).toBe(200)
  expect(await repeatedFinish.json()).toMatchObject({ estimatedLevel: 'C2', rawScore: 15, maxScore: 15 })
})

test('8C.1: CAMPUS exige STUDENT y Alumno B no accede al intento de Alumno A', async ({ page, request }) => {
  const anonymousCampus = await request.post(`${PB_URL}/api/language-school/placement/start`, { data: { mode: 'CAMPUS' } })
  expect(anonymousCampus.status()).toBe(401)

  await login(page, credentials.student.email, credentials.student.password, /\/alumno$/)
  const campusStart = await connectedRequest(page, '/api/language-school/placement/start', 'POST', { mode: 'CAMPUS' })
  expect(campusStart.status).toBe(201)
  expect(campusStart.cacheControl).toContain('no-store')
  const campusAttempt = campusStart.body as { attemptId: string; totalQuestions: number; token?: string }
  expect(campusAttempt.totalQuestions).toBe(30)
  expect(campusAttempt.token).toBeUndefined()

  const firstQuestion = await connectedRequest(page, `/api/language-school/placement/attempts/${campusAttempt.attemptId}/question`)
  expect(firstQuestion.status).toBe(200)
  const question = (firstQuestion.body as { question?: { id: string } }).question
  expect(question?.id).toBeTruthy()

  const forgedAnswer = await connectedRequest(
    page,
    `/api/language-school/placement/attempts/${campusAttempt.attemptId}/answer`,
    'POST',
    { questionId: question?.id, optionId: 'a', scorePercent: 100 },
  )
  expect(forgedAnswer.status).toBe(400)

  const validAnswer = await connectedRequest(
    page,
    `/api/language-school/placement/attempts/${campusAttempt.attemptId}/answer`,
    'POST',
    { questionId: question?.id, optionId: 'a' },
  )
  expect(validAnswer.status).toBe(200)
  expect(JSON.stringify(validAnswer.body)).not.toContain('is_correct')

  await logout(page)
  await login(page, credentials.outsider.email, credentials.outsider.password, /\/alumno$/)
  const outsiderRead = await connectedRequest(page, `/api/language-school/placement/attempts/${campusAttempt.attemptId}/question`)
  expect(outsiderRead.status).toBe(403)

  const outsiderResult = await connectedRequest(page, `/api/language-school/placement/attempts/${campusAttempt.attemptId}/result`)
  expect(outsiderResult.status).toBe(403)
})
