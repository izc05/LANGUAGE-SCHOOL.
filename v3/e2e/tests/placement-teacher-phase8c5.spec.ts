import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

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

async function completeCampusAttempt(request: APIRequestContext, token: string) {
  const start = await request.post(`${PB_URL}/api/language-school/placement/start`, {
    headers: { Authorization: token },
    data: { mode: 'CAMPUS' },
  })
  expect([200, 201]).toContain(start.status())
  const session = await start.json() as { attemptId: string; totalQuestions: number; resumed?: boolean }
  expect(session.totalQuestions).toBe(30)

  let safety = 0
  while (safety < 30) {
    safety += 1
    const next = await request.get(`${PB_URL}/api/language-school/placement/attempts/${session.attemptId}/question`, {
      headers: { Authorization: token },
    })
    expect(next.status()).toBe(200)
    const payload = await next.json() as { complete?: boolean; question?: { id: string } }
    if (payload.complete) break
    expect(payload.question?.id).toBeTruthy()
    const answer = await request.post(`${PB_URL}/api/language-school/placement/attempts/${session.attemptId}/answer`, {
      headers: { Authorization: token },
      data: { questionId: payload.question?.id, optionId: 'a' },
    })
    expect(answer.status()).toBe(200)
  }

  const ready = await request.get(`${PB_URL}/api/language-school/placement/attempts/${session.attemptId}/question`, {
    headers: { Authorization: token },
  })
  expect(ready.status()).toBe(200)
  expect((await ready.json() as { complete?: boolean }).complete).toBe(true)

  const finish = await request.post(`${PB_URL}/api/language-school/placement/attempts/${session.attemptId}/finish`, {
    headers: { Authorization: token }, data: {},
  })
  expect(finish.status()).toBe(200)
  const result = await finish.json() as { attemptId: string; estimatedLevel: string; scorePercent: number }
  expect(result).toMatchObject({ estimatedLevel: 'C2', scorePercent: 100 })
  return result
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/profesor$/)
}

test('8C.5: profesor solo valida alumnos propios y conserva el test automático', async ({ request, page }) => {
  const student = await authenticate(request, requiredEnv('E2E_STUDENT_EMAIL'), requiredEnv('E2E_STUDENT_PASSWORD'))
  const outsider = await authenticate(request, requiredEnv('E2E_OUTSIDER_EMAIL'), requiredEnv('E2E_OUTSIDER_PASSWORD'))
  const teacher = await authenticate(request, requiredEnv('E2E_TEACHER_EMAIL'), requiredEnv('E2E_TEACHER_PASSWORD'))
  const automatic = await completeCampusAttempt(request, student.token)

  const anonymous = await request.get(`${PB_URL}/api/language-school/placement/teacher/students/${student.record.id}/summary`)
  expect(anonymous.status()).toBe(401)

  const studentCannotActAsTeacher = await request.get(`${PB_URL}/api/language-school/placement/teacher/students/${student.record.id}/summary`, {
    headers: { Authorization: student.token },
  })
  expect(studentCannotActAsTeacher.status()).toBe(403)

  const outsiderSummary = await request.get(`${PB_URL}/api/language-school/placement/teacher/students/${outsider.record.id}/summary`, {
    headers: { Authorization: teacher.token },
  })
  expect(outsiderSummary.status()).toBe(403)

  const summary = await request.get(`${PB_URL}/api/language-school/placement/teacher/students/${student.record.id}/summary`, {
    headers: { Authorization: teacher.token },
  })
  expect(summary.status()).toBe(200)
  expect(summary.headers()['cache-control']).toContain('no-store')
  const before = await summary.json() as {
    currentLevel: string
    currentLevelSource: string
    latestAttempt: { attemptId: string; estimatedLevel: string; scorePercent: number }
    assessmentHistory: unknown[]
  }
  expect(before.currentLevel).toBe('C2')
  expect(before.currentLevelSource).toBe('AUTOMATIC')
  expect(before.latestAttempt).toMatchObject({ attemptId: automatic.attemptId, estimatedLevel: 'C2', scorePercent: 100 })
  expect(before.assessmentHistory).toHaveLength(0)

  const forgedTeacher = await request.post(`${PB_URL}/api/language-school/placement/teacher/students/${student.record.id}/validate`, {
    headers: { Authorization: teacher.token },
    data: {
      sourceAttemptId: automatic.attemptId,
      speakingLevel: 'C1',
      validatedLevel: 'C1',
      notes: 'Speaking sólido; conviene afinar precisión y espontaneidad.',
      reason: 'REVIEW',
      assessedBy: outsider.record.id,
      automaticLevel: 'A1',
    },
  })
  expect(forgedTeacher.status()).toBe(201)
  expect(forgedTeacher.headers()['cache-control']).toContain('no-store')
  const created = await forgedTeacher.json() as { assessment: { automaticLevel: string; speakingLevel: string; validatedLevel: string; assessedBy: string; sourceAttemptId: string } }
  expect(created.assessment).toMatchObject({
    automaticLevel: 'C2',
    speakingLevel: 'C1',
    validatedLevel: 'C1',
    assessedBy: teacher.record.id,
    sourceAttemptId: automatic.attemptId,
  })

  const afterResponse = await request.get(`${PB_URL}/api/language-school/placement/teacher/students/${student.record.id}/summary`, {
    headers: { Authorization: teacher.token },
  })
  expect(afterResponse.status()).toBe(200)
  const after = await afterResponse.json() as {
    currentLevel: string
    currentLevelSource: string
    latestAttempt: { estimatedLevel: string; scorePercent: number }
    latestAssessment: { speakingLevel: string; validatedLevel: string; assessedBy: string }
    assessmentHistory: unknown[]
  }
  expect(after.currentLevel).toBe('C1')
  expect(after.currentLevelSource).toBe('VALIDATED')
  expect(after.latestAttempt).toMatchObject({ estimatedLevel: 'C2', scorePercent: 100 })
  expect(after.latestAssessment).toMatchObject({ speakingLevel: 'C1', validatedLevel: 'C1', assessedBy: teacher.record.id })
  expect(after.assessmentHistory).toHaveLength(1)

  const directPrivateCollection = await request.get(`${PB_URL}/api/collections/student_level_assessments/records?perPage=20`, {
    headers: { Authorization: teacher.token },
  })
  expect([200, 403]).toContain(directPrivateCollection.status())
  if (directPrivateCollection.status() === 200) {
    expect((await directPrivateCollection.json() as { items?: unknown[] }).items ?? []).toHaveLength(0)
  }

  await login(page, requiredEnv('E2E_TEACHER_EMAIL'), requiredEnv('E2E_TEACHER_PASSWORD'))
  await page.goto('/profesor/niveles')
  await expect(page.getByRole('heading', { name: 'Niveles de mis alumnos' })).toBeVisible()
  await expect(page.getByText('E2E Student', { exact: true }).first()).toBeVisible()
  await expect(page.locator('.teacher-levels-current').getByText('C1', { exact: true })).toBeVisible()
  await expect(page.locator('.teacher-level-attempt')).toContainText('C2 · 100%')
  await expect(page.locator('.teacher-level-history-list')).toContainText('Speaking C1')

  await page.getByLabel('Speaking').selectOption('C2')
  await page.getByLabel('Nivel validado').selectOption('C2')
  await page.getByLabel('Motivo').selectOption('PROGRESS')
  await page.getByLabel('Observaciones').fill('Segunda valoración E2E desde la interfaz del profesor.')
  await page.getByRole('button', { name: 'Guardar nivel validado' }).click()
  await expect(page.getByRole('status')).toContainText('Nivel C2 validado')
  await expect(page.locator('.teacher-level-history-list > div')).toHaveCount(2)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Niveles de mis alumnos' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)

  const outsiderWrite = await request.post(`${PB_URL}/api/language-school/placement/teacher/students/${outsider.record.id}/validate`, {
    headers: { Authorization: teacher.token },
    data: { validatedLevel: 'A1', reason: 'OTHER' },
  })
  expect(outsiderWrite.status()).toBe(403)
})
