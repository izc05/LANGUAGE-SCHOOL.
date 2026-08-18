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

async function loginAdmin(page: Page) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(requiredEnv('E2E_ADMIN_EMAIL'))
  await page.getByLabel('Contraseña').fill(requiredEnv('E2E_ADMIN_PASSWORD'))
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

test('8C.6: Admin versiona el banco y PUBLISHED queda inmutable en servidor y UI', async ({ request, page }) => {
  const admin = await authenticate(request, requiredEnv('E2E_ADMIN_EMAIL'), requiredEnv('E2E_ADMIN_PASSWORD'))
  const student = await authenticate(request, requiredEnv('E2E_STUDENT_EMAIL'), requiredEnv('E2E_STUDENT_PASSWORD'))

  const studentList = await request.get(`${PB_URL}/api/language-school/placement/admin/tests`, {
    headers: { Authorization: student.token },
  })
  expect(studentList.status()).toBe(403)

  const directCreate = await request.post(`${PB_URL}/api/collections/placement_tests/records`, {
    headers: { Authorization: admin.token },
    data: {
      name: 'Bypass attempt',
      version: 'e2e-direct-bypass',
      status: 'DRAFT',
      algorithm_version: 'cefr-v1',
      public_question_count: 15,
      campus_question_count: 30,
      public_blueprint: [],
      campus_blueprint: [],
      campus_retake_days: 30,
      created_by: admin.record.id,
    },
  })
  expect(directCreate.status()).toBe(403)

  const initialList = await request.get(`${PB_URL}/api/language-school/placement/admin/tests`, {
    headers: { Authorization: admin.token },
  })
  expect(initialList.status()).toBe(200)
  const initial = await initialList.json() as {
    tests: Array<{ id: string; version: string; status: string; validation: { ready: boolean } }>
  }
  const published = initial.tests.find((item) => item.status === 'PUBLISHED')
  expect(published).toBeTruthy()
  expect(published?.validation.ready).toBe(true)

  const draftResponse = await request.post(`${PB_URL}/api/language-school/placement/admin/tests`, {
    headers: { Authorization: admin.token },
    data: {
      name: 'E2E Placement Test 8C.6',
      version: 'e2e-8c6-api',
      sourceTestId: published?.id,
    },
  })
  expect(draftResponse.status()).toBe(201)
  const draft = (await draftResponse.json() as {
    test: { id: string; status: string; validation: { ready: boolean; questionCount: number } }
  }).test
  expect(draft.status).toBe('DRAFT')
  expect(draft.validation.ready).toBe(true)
  expect(draft.validation.questionCount).toBe(30)

  const questionsResponse = await request.get(`${PB_URL}/api/language-school/placement/admin/tests/${draft.id}/questions`, {
    headers: { Authorization: admin.token },
  })
  expect(questionsResponse.status()).toBe(200)
  const questions = (await questionsResponse.json() as {
    questions: Array<{ id: string; prompt: string; code: string }>
  }).questions
  expect(questions).toHaveLength(30)

  const first = questions[0]
  const update = await request.patch(`${PB_URL}/api/language-school/placement/admin/questions/${first.id}`, {
    headers: { Authorization: admin.token },
    data: { prompt: `${first.prompt} · revisada en 8C.6` },
  })
  expect(update.status()).toBe(200)
  expect((await update.json() as { question: { prompt: string } }).question.prompt).toContain('revisada en 8C.6')

  const directUpdate = await request.patch(`${PB_URL}/api/collections/placement_questions/records/${first.id}`, {
    headers: { Authorization: admin.token },
    data: { prompt: 'Intento de bypass directo' },
  })
  expect(directUpdate.status()).toBe(403)

  const publishedQuestionsResponse = await request.get(`${PB_URL}/api/language-school/placement/admin/tests/${published?.id}/questions`, {
    headers: { Authorization: admin.token },
  })
  expect(publishedQuestionsResponse.status()).toBe(200)
  const publishedQuestions = (await publishedQuestionsResponse.json() as {
    questions: Array<{ id: string }>
  }).questions
  expect(publishedQuestions.length).toBeGreaterThan(0)

  const immutableEndpoint = await request.patch(`${PB_URL}/api/language-school/placement/admin/questions/${publishedQuestions[0].id}`, {
    headers: { Authorization: admin.token },
    data: { prompt: 'No debería guardarse' },
  })
  expect(immutableEndpoint.status()).toBe(400)

  const publishedResult = await request.post(`${PB_URL}/api/language-school/placement/admin/tests/${draft.id}/publish`, {
    headers: { Authorization: admin.token },
    data: {},
  })
  expect(publishedResult.status()).toBe(200)
  expect((await publishedResult.json() as { test: { status: string; version: string } }).test).toMatchObject({
    status: 'PUBLISHED',
    version: 'e2e-8c6-api',
  })

  const afterList = await request.get(`${PB_URL}/api/language-school/placement/admin/tests`, {
    headers: { Authorization: admin.token },
  })
  const after = await afterList.json() as {
    tests: Array<{ id: string; version: string; status: string }>
  }
  expect(after.tests.find((item) => item.id === draft.id)?.status).toBe('PUBLISHED')
  expect(after.tests.find((item) => item.id === published?.id)?.status).toBe('ARCHIVED')

  const immutablePublished = await request.patch(`${PB_URL}/api/language-school/placement/admin/tests/${draft.id}`, {
    headers: { Authorization: admin.token },
    data: { name: 'No debe cambiar' },
  })
  expect(immutablePublished.status()).toBe(400)

  await loginAdmin(page)
  await page.goto('/admin/test-de-nivel')
  await expect(page.getByRole('heading', { name: 'Test de nivel' })).toBeVisible()
  await expect(page.getByText('e2e-8c6-api', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Versión inmutable.')).toBeVisible()

  await page.getByLabel('Versión').first().fill('e2e-8c6-ui')
  await page.getByRole('button', { name: 'Crear versión' }).click()
  await expect(page.getByRole('status')).toContainText('Nueva versión DRAFT creada')
  await expect(page.getByText('e2e-8c6-ui', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Banco preparado para publicar')).toBeVisible()

  const firstQuestionCard = page.locator('.placement-question-list article').first()
  await firstQuestionCard.getByRole('button', { name: 'Editar' }).click()
  const prompt = page.getByLabel('Enunciado')
  await prompt.fill('Pregunta actualizada desde la interfaz 8C.6')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('status')).toContainText('Pregunta actualizada')

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Publicar versión' }).click()
  await expect(page.getByRole('status')).toContainText('publicada')
  await expect(page.getByText('Versión inmutable.')).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Test de nivel' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
