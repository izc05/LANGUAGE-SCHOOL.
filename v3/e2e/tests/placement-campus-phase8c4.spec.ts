import { expect, test, type Page } from '@playwright/test'

const PB_URL = 'http://127.0.0.1:8090'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
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

async function connectedRequest(page: Page, path: string, method: 'GET' | 'POST' = 'GET', body?: Record<string, unknown>) {
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

const owner = {
  email: requiredEnv('E2E_OUTSIDER_EMAIL'),
  password: requiredEnv('E2E_OUTSIDER_PASSWORD'),
}
const foreignStudent = {
  email: requiredEnv('E2E_STUDENT_EMAIL'),
  password: requiredEnv('E2E_STUDENT_PASSWORD'),
}

test('8C.4: Mi nivel reanuda, completa 30 preguntas, conserva histórico y aplica retake server-side', async ({ page, request }) => {
  const anonymousSummary = await request.get(`${PB_URL}/api/language-school/placement/campus/summary`)
  expect(anonymousSummary.status()).toBe(401)

  const directAttempts = await request.get(`${PB_URL}/api/collections/placement_attempts/records?perPage=5`)
  expect([200, 403]).toContain(directAttempts.status())
  if (directAttempts.status() === 200) {
    expect((await directAttempts.json() as { items?: unknown[] }).items ?? []).toHaveLength(0)
  }

  await login(page, owner.email, owner.password, /\/alumno$/)
  await page.goto('/alumno/nivel')
  await expect(page.getByRole('heading', { name: /Tu evolución en inglés/ })).toBeVisible()
  await expect(page.getByText('Aún no tienes un nivel evaluado')).toBeVisible()
  await expect(page.getByText('30 preguntas', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Empezar evaluación' })).toBeVisible()

  await page.getByRole('button', { name: 'Empezar evaluación' }).click()
  await expect(page.getByText('Pregunta 1 de 30')).toBeVisible()
  const firstA = page.getByLabel('Option A')
  await page.locator('.student-level-options label', { has: firstA }).click()
  await expect(firstA).toBeChecked()
  await page.getByRole('button', { name: 'Confirmar respuesta' }).click()
  await expect(page.getByText('Pregunta 2 de 30')).toBeVisible()

  await page.goto('/alumno')
  await expect(page.getByText('Nivel del curso')).toBeVisible()
  await expect(page.getByText('Nivel actual')).toHaveCount(0)
  await page.goto('/alumno/nivel')
  await expect(page.getByText('Has respondido 1 de 30 preguntas.')).toBeVisible()
  await page.getByRole('button', { name: 'Continuar evaluación' }).click()
  await expect(page.getByText('Pregunta 2 de 30')).toBeVisible()

  for (let position = 2; position <= 30; position += 1) {
    await expect(page.getByText(`Pregunta ${position} de 30`)).toBeVisible()
    const optionA = page.getByLabel('Option A')
    await page.locator('.student-level-options label', { has: optionA }).click()
    await expect(optionA).toBeChecked()
    await page.getByRole('button', { name: position === 30 ? 'Finalizar evaluación' : 'Confirmar respuesta' }).click()
  }

  await expect(page.getByText('Evaluación completada · C2')).toBeVisible()
  await expect(page.locator('.student-level-current')).toContainText('C2')
  await expect(page.locator('.student-level-current')).toContainText('Última estimación automática')
  await expect(page.locator('.student-level-latest')).toContainText('100%')
  await expect(page.locator('.student-level-history-list article')).toHaveCount(1)
  await expect(page.getByText('Próxima repetición')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Repetir evaluación' })).toHaveCount(0)

  const summaryResponse = await connectedRequest(page, '/api/language-school/placement/campus/summary')
  expect(summaryResponse.status).toBe(200)
  expect(summaryResponse.cacheControl).toContain('no-store')
  const summary = summaryResponse.body as {
    currentLevel: string
    currentLevelSource: string
    latestAttempt: { attemptId: string; estimatedLevel: string; scorePercent: number }
    history: Array<{ attemptId: string }>
    retake: { allowed: boolean; days: number; nextAvailableAt: string }
  }
  expect(summary.currentLevel).toBe('C2')
  expect(summary.currentLevelSource).toBe('AUTOMATIC')
  expect(summary.latestAttempt).toMatchObject({ estimatedLevel: 'C2', scorePercent: 100 })
  expect(summary.history).toHaveLength(1)
  expect(summary.retake.allowed).toBe(false)
  expect(summary.retake.days).toBe(30)
  expect(summary.retake.nextAvailableAt).toBeTruthy()

  const blockedRetake = await connectedRequest(page, '/api/language-school/placement/start', 'POST', { mode: 'CAMPUS' })
  expect(blockedRetake.status).toBe(400)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  await expect(page.getByRole('heading', { name: /Tu evolución en inglés/ })).toBeVisible()

  const ownerAttemptId = summary.latestAttempt.attemptId
  await logout(page)
  await login(page, foreignStudent.email, foreignStudent.password, /\/alumno$/)
  const foreignResult = await connectedRequest(page, `/api/language-school/placement/attempts/${ownerAttemptId}/result`)
  expect(foreignResult.status).toBe(403)

  const foreignSummary = await connectedRequest(page, '/api/language-school/placement/campus/summary')
  expect(foreignSummary.status).toBe(200)
  expect((foreignSummary.body as { history: unknown[] }).history).toHaveLength(0)
})
