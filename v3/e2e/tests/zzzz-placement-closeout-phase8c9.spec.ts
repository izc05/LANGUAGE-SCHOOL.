// Coverage matrix: v3/docs/phase8c9-functional-closeout.md
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

async function expectNoHorizontalOverflow(page: Page) {
  const values = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(values.scroll).toBeLessThanOrEqual(values.client + 1)
}

async function authenticatedSummary(request: APIRequestContext, token: string) {
  const response = await request.get(`${PB_URL}/api/language-school/placement/campus/summary`, {
    headers: { Authorization: token },
  })
  expect(response.status()).toBe(200)
  return response.json() as Promise<{
    currentLevel: string
    currentLevelSource: string
    campusQuestionCount: number
    latestAttempt: null | {
      attemptId: string
      algorithmVersion: string
      estimatedLevel: string
      maxScore: number
      skillScores: Record<string, { total: number; diagnosticOnly?: boolean }>
    }
  }>
}

test('8C.9: cierre transversal conserva responsive, roles y privacidad con Listening publicado', async ({ page, request }) => {
  test.setTimeout(120_000)

  const studentEmail = requiredEnv('E2E_OUTSIDER_EMAIL')
  const studentPassword = requiredEnv('E2E_OUTSIDER_PASSWORD')
  const student = await authenticate(request, studentEmail, studentPassword)
  const teacher = await authenticate(request, requiredEnv('E2E_TEACHER_EMAIL'), requiredEnv('E2E_TEACHER_PASSWORD'))
  const admin = await authenticate(request, requiredEnv('E2E_ADMIN_EMAIL'), requiredEnv('E2E_ADMIN_PASSWORD'))

  const summary = await authenticatedSummary(request, student.token)
  expect(summary.campusQuestionCount).toBe(36)
  expect(summary.latestAttempt).toBeTruthy()
  expect(summary.latestAttempt).toMatchObject({ algorithmVersion: 'cefr-v2-listening', maxScore: 30 })
  expect(summary.latestAttempt?.skillScores.LISTENING).toMatchObject({ total: 6, diagnosticOnly: true })

  const anonymousPrivateResult = await request.get(`${PB_URL}/api/language-school/placement/attempts/${summary.latestAttempt!.attemptId}/result`)
  expect(anonymousPrivateResult.status()).toBe(401)

  const teacherAdminApi = await request.get(`${PB_URL}/api/language-school/placement/admin/tests`, {
    headers: { Authorization: teacher.token },
  })
  expect(teacherAdminApi.status()).toBe(403)

  const studentAdminApi = await request.get(`${PB_URL}/api/language-school/placement/admin/tests`, {
    headers: { Authorization: student.token },
  })
  expect(studentAdminApi.status()).toBe(403)

  const adminTests = await request.get(`${PB_URL}/api/language-school/placement/admin/tests`, {
    headers: { Authorization: admin.token },
  })
  expect(adminTests.status()).toBe(200)
  const adminBody = await adminTests.json() as { tests: Array<{ status: string; algorithmVersion: string }> }
  expect(adminBody.tests.some((item) => item.status === 'PUBLISHED' && item.algorithmVersion === 'cefr-v2-listening')).toBe(true)

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1180, height: 820 },
    { width: 820, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/test-de-nivel')
    await expect(page.getByRole('heading', { name: /Descubre tu punto de partida/i })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await login(page, studentEmail, studentPassword, /\/alumno$/)
  await page.goto('/alumno/nivel')
  await expect(page.getByRole('heading', { name: /Tu evolución en inglés/i })).toBeVisible()
  await expect(page.getByText('36 preguntas', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/Comprensión oral/).first()).toBeVisible()
  await expect(page.getByText(/diagnóstico/).first()).toBeVisible()
  expect((await page.locator('body').innerText()).toLowerCase()).not.toContain('correct_option_id')
  expect((await page.locator('body').innerText()).toLowerCase()).not.toContain('public_token_hash')
  await expectNoHorizontalOverflow(page)

  await page.goto('/admin/test-de-nivel')
  await expect(page).toHaveURL(/\/alumno$/)
  await logout(page)

  await login(page, requiredEnv('E2E_TEACHER_EMAIL'), requiredEnv('E2E_TEACHER_PASSWORD'), /\/profesor$/)
  await page.goto('/admin/test-de-nivel')
  await expect(page).toHaveURL(/\/profesor$/)
  await logout(page)

  await page.setViewportSize({ width: 820, height: 1000 })
  await login(page, requiredEnv('E2E_ADMIN_EMAIL'), requiredEnv('E2E_ADMIN_PASSWORD'), /\/admin$/)
  await page.goto('/admin/test-de-nivel')
  await expect(page.getByRole('heading', { name: 'Test de nivel' })).toBeVisible()
  const listeningVersion = page.locator('.placement-version-list button').filter({ hasText: 'Listening' }).first()
  await expect(listeningVersion).toBeVisible()
  await listeningVersion.click()
  await expect(page.getByText('24/24 audios')).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await page.goto('/test-de-nivel')
  await page.keyboard.press('Tab')
  const focusOutline = await page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null
    if (!active) return { tag: '', outlineStyle: 'none', outlineWidth: '0px' }
    const style = getComputedStyle(active)
    return { tag: active.tagName, outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth }
  })
  expect(focusOutline.tag).not.toBe('BODY')
  expect(focusOutline.outlineStyle).not.toBe('none')
  expect(Number.parseFloat(focusOutline.outlineWidth)).toBeGreaterThanOrEqual(2)
})
