import { expect, test, type APIRequestContext } from '@playwright/test'

const PB_URL = 'http://127.0.0.1:8090'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

async function adminToken(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${PB_URL}/api/collections/users/auth-with-password`, {
    data: {
      identity: requiredEnv('E2E_ADMIN_EMAIL'),
      password: requiredEnv('E2E_ADMIN_PASSWORD'),
    },
  })
  expect(response.status()).toBe(200)
  return (await response.json() as { token: string }).token
}

async function startPublicAttempt(request: APIRequestContext): Promise<{ attemptId: string; token: string }> {
  const response = await request.post(`${PB_URL}/api/language-school/placement/start`, { data: { mode: 'PUBLIC' } })
  expect(response.status()).toBe(201)
  return response.json() as Promise<{ attemptId: string; token: string }>
}

async function completePublicAttempt(request: APIRequestContext, attempt: { attemptId: string; token: string }) {
  for (let index = 0; index < 15; index += 1) {
    const next = await request.get(`${PB_URL}/api/language-school/placement/attempts/${attempt.attemptId}/question`, {
      headers: { 'X-Placement-Token': attempt.token },
    })
    expect(next.status()).toBe(200)
    const payload = await next.json() as { question?: { id: string } }
    expect(payload.question?.id).toBeTruthy()
    const answer = await request.post(`${PB_URL}/api/language-school/placement/attempts/${attempt.attemptId}/answer`, {
      headers: { 'X-Placement-Token': attempt.token },
      data: { questionId: payload.question?.id, optionId: 'a' },
    })
    expect(answer.status()).toBe(200)
  }

  const finish = await request.post(`${PB_URL}/api/language-school/placement/attempts/${attempt.attemptId}/finish`, {
    headers: { 'X-Placement-Token': attempt.token },
    data: {},
  })
  expect(finish.status()).toBe(200)
  expect(await finish.json()).toMatchObject({ estimatedLevel: 'C2', scorePercent: 100 })
}

test('8C.3: recomendación usa CEFR estructurado y contacto queda ligado al intento poseído', async ({ request }) => {
  const token = await adminToken(request)
  const courseList = await request.get(`${PB_URL}/api/collections/courses/records?perPage=20&filter=${encodeURIComponent('slug = "e2e-english-b1"')}`, {
    headers: { Authorization: token },
  })
  expect(courseList.status()).toBe(200)
  const course = (await courseList.json() as { items: Array<{ id: string; level: string }> }).items[0]
  expect(course).toBeTruthy()
  expect(course.level).toBe('B1')
  const patchCourse = await request.patch(`${PB_URL}/api/collections/courses/records/${course.id}`, {
    headers: { Authorization: token },
    data: { cefr_levels: ['C1', 'C2'] },
  })
  expect(patchCourse.status()).toBe(200)

  const genericContact = await request.post(`${PB_URL}/api/collections/contact_requests/records`, {
    data: { name: 'E2E Generic 8C3', email: 'generic8c3@example.com', phone: '', interest: 'General', message: 'Generic contact remains available.', status: 'NEW' },
  })
  expect(genericContact.status()).toBe(200)

  const attempt = await startPublicAttempt(request)

  const forbiddenDirectLink = await request.post(`${PB_URL}/api/collections/contact_requests/records`, {
    data: {
      name: 'Forged placement', email: 'forged@example.com', phone: '', interest: 'Test', message: 'Must be rejected.', status: 'NEW',
      placement_attempt: attempt.attemptId,
    },
  })
  expect(forbiddenDirectLink.status()).toBe(400)

  const beforeCompletion = await request.get(`${PB_URL}/api/language-school/placement/attempts/${attempt.attemptId}/recommendations`, {
    headers: { 'X-Placement-Token': attempt.token },
  })
  expect(beforeCompletion.status()).toBe(400)

  await completePublicAttempt(request, attempt)

  const wrongToken = await request.get(`${PB_URL}/api/language-school/placement/attempts/${attempt.attemptId}/recommendations`, {
    headers: { 'X-Placement-Token': `${attempt.token}tampered` },
  })
  expect(wrongToken.status()).toBe(403)

  const recommendations = await request.get(`${PB_URL}/api/language-school/placement/attempts/${attempt.attemptId}/recommendations`, {
    headers: { 'X-Placement-Token': attempt.token },
  })
  expect(recommendations.status()).toBe(200)
  expect(recommendations.headers()['cache-control']).toContain('no-store')
  const recommendationBody = await recommendations.json() as {
    estimatedLevel: string
    courses: Array<{ title: string; level: string; slug: string; cefrLevels: string[] }>
  }
  expect(recommendationBody.estimatedLevel).toBe('C2')
  expect(recommendationBody.courses).toEqual(expect.arrayContaining([
    expect.objectContaining({ title: 'E2E English B1', level: 'B1', slug: 'e2e-english-b1', cefrLevels: ['C1', 'C2'] }),
  ]))

  const forgedContact = await request.post(`${PB_URL}/api/language-school/placement/attempts/${attempt.attemptId}/contact`, {
    headers: { 'X-Placement-Token': attempt.token },
    data: { name: 'E2E Placement Contact', email: 'placement8c3@example.com', message: 'Call me about the result.', placementScore: 1 },
  })
  expect(forgedContact.status()).toBe(400)

  const contactWithWrongToken = await request.post(`${PB_URL}/api/language-school/placement/attempts/${attempt.attemptId}/contact`, {
    headers: { 'X-Placement-Token': `${attempt.token}tampered` },
    data: { name: 'E2E Placement Contact', email: 'placement8c3@example.com', message: 'Call me about the result.' },
  })
  expect(contactWithWrongToken.status()).toBe(403)

  const contact = await request.post(`${PB_URL}/api/language-school/placement/attempts/${attempt.attemptId}/contact`, {
    headers: { 'X-Placement-Token': attempt.token },
    data: { name: 'E2E Placement Contact', email: 'placement8c3@example.com', phone: '600123123', interest: 'Orientación tras test', message: 'Quiero saber qué programa encaja con mi resultado.' },
  })
  expect(contact.status()).toBe(201)
  expect(contact.headers()['cache-control']).toContain('no-store')
  expect(await contact.json()).toEqual({ created: true })

  const savedContacts = await request.get(`${PB_URL}/api/collections/contact_requests/records?perPage=20&filter=${encodeURIComponent('email = "placement8c3@example.com"')}`, {
    headers: { Authorization: token },
  })
  expect(savedContacts.status()).toBe(200)
  const saved = (await savedContacts.json() as { items: Array<Record<string, unknown>> }).items[0]
  expect(saved).toMatchObject({
    placement_attempt: attempt.attemptId,
    placement_level: 'C2',
    placement_score: 100,
    status: 'NEW',
  })
})
