import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const PB_URL = 'http://127.0.0.1:8090'
const PROGRESSIVE = 'cefr-v3-progressive'

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
  return response.json() as Promise<{ token: string }>
}

async function loginAdmin(page: Page) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(requiredEnv('E2E_ADMIN_EMAIL'))
  await page.getByLabel('Contraseña').fill(requiredEnv('E2E_ADMIN_PASSWORD'))
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

async function noOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

test('16F: Admin gestiona una revisión progresiva con cobertura, filtros e histórico protegido', async ({ request, page }) => {
  const suffix = Date.now().toString(36)
  const version = `e2e-16f-${suffix}`
  const admin = await authenticate(request, requiredEnv('E2E_ADMIN_EMAIL'), requiredEnv('E2E_ADMIN_PASSWORD'))
  const student = await authenticate(request, requiredEnv('E2E_STUDENT_EMAIL'), requiredEnv('E2E_STUDENT_PASSWORD'))

  const list = await request.get(`${PB_URL}/api/language-school/placement/admin/tests`, {
    headers: { Authorization: admin.token },
  })
  expect(list.status()).toBe(200)
  const tests = (await list.json() as {
    tests: Array<{ id: string; version: string; status: string; algorithmVersion: string; validation: { questionCount: number } }>
  }).tests
  const source = [...tests]
    .filter((item) => ['cefr-v1', 'cefr-v2-listening', PROGRESSIVE].includes(item.algorithmVersion))
    .sort((left, right) => Number(right.validation.questionCount || 0) - Number(left.validation.questionCount || 0))[0]
  expect(source).toBeTruthy()
  if (!source) throw new Error('No placement source available for 16F')
  expect(source.validation.questionCount).toBeGreaterThanOrEqual(72)

  const forbidden = await request.post(`${PB_URL}/api/language-school/placement/admin/progressive/tests`, {
    headers: { Authorization: student.token },
    data: { name: 'Forbidden', version: `${version}-forbidden`, sourceTestId: source.id },
  })
  expect(forbidden.status()).toBe(403)

  const createdResponse = await request.post(`${PB_URL}/api/language-school/placement/admin/progressive/tests`, {
    headers: { Authorization: admin.token },
    data: { name: 'E2E Progressive Admin 16F', version, sourceTestId: source.id },
  })
  expect(createdResponse.status(), await createdResponse.text()).toBe(201)
  const created = await createdResponse.json() as {
    testId: string
    algorithmVersion: string
    validation: { ready: boolean; requirements: Array<{ skill: string; level: string; required: number; available: number; ready: boolean }> }
  }
  expect(created.algorithmVersion).toBe(PROGRESSIVE)
  expect(created.validation.ready).toBe(true)
  expect(created.validation.requirements).toHaveLength(18)
  expect(created.validation.requirements.every((item) => item.ready && item.available >= item.required)).toBe(true)

  try {
    const statusResponse = await request.get(`${PB_URL}/api/language-school/placement/admin/progressive/tests/${created.testId}`, {
      headers: { Authorization: admin.token },
    })
    expect(statusResponse.status()).toBe(200)
    expect(statusResponse.headers()['cache-control']).toContain('no-store')
    const statusText = await statusResponse.text()
    expect(statusText).not.toContain('correct_option_id')
    expect(statusText).not.toContain('selected_option_id')
    expect(JSON.parse(statusText)).toMatchObject({ algorithmVersion: PROGRESSIVE, status: 'DRAFT', validation: { ready: true } })

    await loginAdmin(page)
    await page.goto('/admin/test-de-nivel')
    await expect(page.getByRole('heading', { name: 'Test de nivel', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Crear versión DRAFT progresiva' })).toBeVisible()

    const versionButton = page.locator('.placement-version-list button', { hasText: version })
    await expect(versionButton).toBeVisible()
    await versionButton.click()

    await expect(page.getByText(PROGRESSIVE, { exact: false }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Cobertura del banco' })).toBeVisible()
    await expect(page.locator('.placement-coverage-cell')).toHaveCount(18)
    await expect(page.getByText('Banco preparado para publicar')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Publicar versión' })).toBeEnabled()

    await page.getByLabel('Filtrar competencia').selectOption('VOCABULARY')
    await page.getByLabel('Filtrar nivel MCER').selectOption('C1')
    const filtered = page.locator('.placement-question-list article')
    expect(await filtered.count()).toBeGreaterThan(0)
    for (const card of await filtered.all()) {
      await expect(card).toContainText('Vocabulario')
      await expect(card).toContainText('C1')
    }

    await page.getByRole('button', { name: 'Limpiar filtros' }).click()
    const firstQuestion = page.locator('.placement-question-list article').first()
    await firstQuestion.getByRole('button', { name: 'Editar' }).click()
    const prompt = page.getByLabel('Enunciado')
    const originalPrompt = await prompt.inputValue()
    await prompt.fill(`${originalPrompt} · revisada 16F`)
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.locator('.cms-notice.success-notice')).toContainText('Pregunta actualizada')
    await expect(page.getByRole('heading', { name: 'Cobertura del banco' })).toBeVisible()

    await page.goto('/admin/test-de-nivel/resultados')
    await expect(page.getByRole('heading', { name: 'Resultados de nivel', exact: true })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Intentos recientes del test de nivel' })).toBeVisible()

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/admin/test-de-nivel')
    await page.locator('.placement-version-list button', { hasText: version }).click()
    await expect(page.getByRole('heading', { name: 'Cobertura del banco' })).toBeVisible()
    await noOverflow(page)
  } finally {
    const cleanup = await request.delete(`${PB_URL}/api/language-school/placement/admin/tests/${created.testId}`, {
      headers: { Authorization: admin.token },
    })
    expect(cleanup.status()).toBe(200)
  }
})
