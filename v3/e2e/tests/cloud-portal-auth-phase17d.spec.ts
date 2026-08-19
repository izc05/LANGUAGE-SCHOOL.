import { expect, test, type Page } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

function cloudChunkLoaded(resources: string[]): boolean {
  return resources.some((name) => /CloudPortalTransition-[^/]+\.(?:js|css)(?:\?|$)/.test(name))
}

async function fillLogin(page: Page, email: string, password: string) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
}

async function expectPortalLogin(page: Page, email: string, password: string, destination: RegExp) {
  await fillLogin(page, email, password)
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page.locator('.cloud-portal-transition')).toBeVisible({ timeout: 5000 })
  await expect(page).toHaveURL(/\/acceso$/)
  await expect(page.locator('.cloud-portal-transition')).toHaveCount(1)

  await expect(page).toHaveURL(destination, { timeout: 5000 })
  await expect(page.locator('.cloud-portal-transition')).toHaveCount(0, { timeout: 5000 })
}

test('17D: alumno navega una sola vez durante whiteout', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expectPortalLogin(
    page,
    requiredEnv('E2E_STUDENT_EMAIL'),
    requiredEnv('E2E_STUDENT_PASSWORD'),
    /\/alumno$/,
  )
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
})

test('17D: profesor navega una sola vez durante whiteout', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expectPortalLogin(
    page,
    requiredEnv('E2E_TEACHER_EMAIL'),
    requiredEnv('E2E_TEACHER_PASSWORD'),
    /\/profesor$/,
  )
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
})

test('17D: admin conserva acceso directo sin cargar nubes', async ({ page }) => {
  await fillLogin(page, requiredEnv('E2E_ADMIN_EMAIL'), requiredEnv('E2E_ADMIN_PASSWORD'))
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin$/, { timeout: 5000 })
  await expect(page.locator('.cloud-portal-transition')).toHaveCount(0)

  const resources = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name))
  expect(cloudChunkLoaded(resources)).toBe(false)
})

test('17D: credenciales incorrectas nunca disparan el portal', async ({ page }) => {
  await fillLogin(page, 'invalid-17d@example.invalid', 'not-the-password')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(/\/acceso$/)
  await expect(page.locator('.cloud-portal-transition')).toHaveCount(0)

  const resources = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name))
  expect(cloudChunkLoaded(resources)).toBe(false)
})
