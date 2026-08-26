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

function wavSilence(): Buffer {
  const sampleRate = 8000
  const samples = 800
  const dataSize = samples
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate, 28)
  buffer.writeUInt16LE(1, 32)
  buffer.writeUInt16LE(8, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)
  buffer.fill(128, 44)
  return buffer
}

type ListeningQuestion = {
  id: string
  code: string
  cefrLevel: string
  passage: string
  hasAudio: boolean
  audioName: string
}

type ListeningStatus = {
  testId: string
  validation: {
    ready: boolean
    questionCount: number
    activeQuestionCount: number
    listeningCount: number
    listeningWithAudio: number
    errors: string[]
  }
  listeningQuestions: ListeningQuestion[]
}

async function adminTests(request: APIRequestContext, token: string) {
  const response = await request.get(`${PB_URL}/api/language-school/placement/admin/tests`, {
    headers: { Authorization: token },
  })
  expect(response.status()).toBe(200)
  return (await response.json() as { tests: Array<{ id: string; version: string; status: string; algorithmVersion: string }> }).tests
}

async function listeningStatus(request: APIRequestContext, token: string, testId: string): Promise<ListeningStatus> {
  const response = await request.get(`${PB_URL}/api/language-school/placement/admin/listening/tests/${testId}`, {
    headers: { Authorization: token },
  })
  expect(response.status()).toBe(200)
  return response.json() as Promise<ListeningStatus>
}

async function answerAttempt(
  request: APIRequestContext,
  attemptId: string,
  headers: Record<string, string>,
  expectedTotal: number,
  onQuestion?: (question: { id: string; skill: string; prompt: string; passage: string; hasAudio?: boolean; options: Array<{ id: string }> }) => Promise<void>,
) {
  for (let index = 0; index < expectedTotal; index += 1) {
    const next = await request.get(`${PB_URL}/api/language-school/placement/attempts/${attemptId}/question`, { headers })
    expect(next.status()).toBe(200)
    const body = await next.json() as {
      question?: { id: string; skill: string; prompt: string; passage: string; hasAudio?: boolean; options: Array<{ id: string }> }
    }
    expect(body.question?.id).toBeTruthy()
    expect(body.question?.options.length).toBeGreaterThanOrEqual(2)
    if (onQuestion) await onQuestion(body.question!)
    const answer = await request.post(`${PB_URL}/api/language-school/placement/attempts/${attemptId}/answer`, {
      headers,
      data: { questionId: body.question!.id, optionId: body.question!.options[0].id },
    })
    expect(answer.status()).toBe(200)
  }
}

test('8C.8 backend: Listening queda versionado, protegido y diagnóstico sin alterar cefr-v1', async ({ request }) => {
  const admin = await authenticate(request, requiredEnv('E2E_ADMIN_EMAIL'), requiredEnv('E2E_ADMIN_PASSWORD'))
  const student = await authenticate(request, requiredEnv('E2E_STUDENT_EMAIL'), requiredEnv('E2E_STUDENT_PASSWORD'))
  const outsider = await authenticate(request, requiredEnv('E2E_OUTSIDER_EMAIL'), requiredEnv('E2E_OUTSIDER_PASSWORD'))

  const tests = await adminTests(request, admin.token)
  const published = tests.find((item) => item.status === 'PUBLISHED')
  expect(published).toBeTruthy()
  expect(published!.algorithmVersion).toBe('cefr-v1')

  const version = `e2e-listening-${Date.now()}`
  const create = await request.post(`${PB_URL}/api/language-school/placement/admin/listening/tests`, {
    headers: { Authorization: admin.token },
    data: { sourceTestId: published!.id, name: 'E2E Listening', version },
  })
  expect(create.status()).toBe(201)
  const created = await create.json() as { testId: string; algorithmVersion: string; validation: { ready: boolean } }
  expect(created.algorithmVersion).toBe('cefr-v2-listening')
  expect(created.validation.ready).toBe(false)

  let status = await listeningStatus(request, admin.token, created.testId)
  expect(status.listeningQuestions).toHaveLength(24)
  expect(status.validation.listeningCount).toBe(24)
  expect(status.validation.listeningWithAudio).toBe(0)
  expect(status.validation.ready).toBe(false)
  for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
    expect(status.listeningQuestions.filter((item) => item.cefrLevel === level)).toHaveLength(4)
  }

  const prematurePublish = await request.post(`${PB_URL}/api/language-school/placement/admin/listening/tests/${created.testId}/publish`, {
    headers: { Authorization: admin.token }, data: {},
  })
  expect(prematurePublish.status()).toBe(400)

  const wav = wavSilence()
  for (const question of status.listeningQuestions) {
    const upload = await request.post(`${PB_URL}/api/language-school/placement/admin/listening/questions/${question.id}/audio`, {
      headers: { Authorization: admin.token },
      multipart: { audio: { name: `${question.code}.wav`, mimeType: 'audio/wav', buffer: wav } },
    })
    expect(upload.status(), `audio upload for ${question.code}`).toBe(200)
  }

  status = await listeningStatus(request, admin.token, created.testId)
  expect(status.validation.listeningWithAudio).toBe(24)
  expect(status.validation.ready).toBe(true)
  status.listeningQuestions.forEach((question) => expect(question.hasAudio).toBe(true))

  const preview = await request.get(`${PB_URL}/api/language-school/placement/admin/listening/questions/${status.listeningQuestions[0].id}/audio`, {
    headers: { Authorization: admin.token },
  })
  expect(preview.status()).toBe(200)
  expect(preview.headers()['content-type']).toContain('audio')

  const clone = await request.post(`${PB_URL}/api/language-school/placement/admin/listening/tests`, {
    headers: { Authorization: admin.token },
    data: { sourceTestId: created.testId, name: 'E2E Listening clone', version: `${version}-clone` },
  })
  expect(clone.status()).toBe(201)
  const cloned = await clone.json() as { testId: string; validation: { ready: boolean } }
  expect(cloned.validation.ready).toBe(true)
  const cloneStatus = await listeningStatus(request, admin.token, cloned.testId)
  expect(cloneStatus.validation.listeningWithAudio).toBe(24)
  expect(cloneStatus.validation.ready).toBe(true)

  const publish = await request.post(`${PB_URL}/api/language-school/placement/admin/listening/tests/${cloned.testId}/publish`, {
    headers: { Authorization: admin.token }, data: {},
  })
  expect(publish.status()).toBe(200)

  const publishedStatus = await listeningStatus(request, admin.token, cloned.testId)
  const deleteAfterPublish = await request.delete(`${PB_URL}/api/language-school/placement/admin/listening/questions/${publishedStatus.listeningQuestions[0].id}/audio`, {
    headers: { Authorization: admin.token },
  })
  expect(deleteAfterPublish.status()).toBe(400)

  const publicStart = await request.post(`${PB_URL}/api/language-school/placement/start`, { data: { mode: 'PUBLIC' } })
  expect(publicStart.status()).toBe(201)
  const publicSession = await publicStart.json() as { attemptId: string; token: string; totalQuestions: number; algorithmVersion: string }
  expect(publicSession.totalQuestions).toBe(21)
  expect(publicSession.algorithmVersion).toBe('cefr-v2-listening')
  let publicListening = 0
  await answerAttempt(request, publicSession.attemptId, { 'X-Placement-Token': publicSession.token }, 21, async (question) => {
    expect(question).not.toHaveProperty('correctOptionId')
    if (question.skill !== 'LISTENING') return
    publicListening += 1
    expect(question.passage).toBe('')
    expect(question.hasAudio).toBe(true)
    const wrongToken = await request.get(`${PB_URL}/api/language-school/placement/attempts/${publicSession.attemptId}/questions/${question.id}/audio`, {
      headers: { 'X-Placement-Token': 'wrong-token' },
    })
    expect(wrongToken.status()).toBe(403)
    const audio = await request.get(`${PB_URL}/api/language-school/placement/attempts/${publicSession.attemptId}/questions/${question.id}/audio`, {
      headers: { 'X-Placement-Token': publicSession.token },
    })
    expect(audio.status()).toBe(200)
    expect(audio.headers()['content-type']).toContain('audio')
  })
  expect(publicListening).toBe(6)

  const publicFinish = await request.post(`${PB_URL}/api/language-school/placement/attempts/${publicSession.attemptId}/finish`, {
    headers: { 'X-Placement-Token': publicSession.token }, data: {},
  })
  expect(publicFinish.status()).toBe(200)
  const result = await publicFinish.json() as {
    algorithmVersion: string
    rawScore: number
    maxScore: number
    scorePercent: number
    estimatedLevel: string
    listeningDiagnosticOnly: boolean
    skillScores: Record<string, { correct: number; total: number; percent: number; diagnosticOnly?: boolean }>
  }
  expect(result.algorithmVersion).toBe('cefr-v2-listening')
  expect(result.maxScore).toBe(15)
  expect(result.skillScores.LISTENING).toMatchObject({ total: 6, diagnosticOnly: true })
  expect(result.listeningDiagnosticOnly).toBe(true)

  const campusStart = await request.post(`${PB_URL}/api/language-school/placement/start`, {
    headers: { Authorization: outsider.token }, data: { mode: 'CAMPUS' },
  })
  expect([200, 201]).toContain(campusStart.status())
  const campusSession = await campusStart.json() as { attemptId: string; totalQuestions: number; algorithmVersion: string }
  expect(campusSession.totalQuestions).toBe(36)
  expect(campusSession.algorithmVersion).toBe('cefr-v2-listening')
  let checkedCampusAudio = false

  await answerAttempt(request, campusSession.attemptId, { Authorization: outsider.token }, 36, async (question) => {
    if (question.skill !== 'LISTENING' || checkedCampusAudio) return
    checkedCampusAudio = true
    expect(question.passage).toBe('')
    const anonymous = await request.get(`${PB_URL}/api/language-school/placement/attempts/${campusSession.attemptId}/questions/${question.id}/audio`)
    expect(anonymous.status()).toBe(401)
    const otherStudent = await request.get(`${PB_URL}/api/language-school/placement/attempts/${campusSession.attemptId}/questions/${question.id}/audio`, {
      headers: { Authorization: student.token },
    })
    expect(otherStudent.status()).toBe(403)
    const owner = await request.get(`${PB_URL}/api/language-school/placement/attempts/${campusSession.attemptId}/questions/${question.id}/audio`, {
      headers: { Authorization: outsider.token },
    })
    expect(owner.status()).toBe(200)
  })
  expect(checkedCampusAudio).toBe(true)

  const campusFinish = await request.post(`${PB_URL}/api/language-school/placement/attempts/${campusSession.attemptId}/finish`, {
    headers: { Authorization: outsider.token }, data: {},
  })
  expect(campusFinish.status()).toBe(200)
  const campusResult = await campusFinish.json() as { maxScore: number; skillScores: Record<string, { total: number; diagnosticOnly?: boolean }> }
  expect(campusResult.maxScore).toBe(30)
  expect(campusResult.skillScores.LISTENING).toMatchObject({ total: 6, diagnosticOnly: true })
})
