import { expect, test, type Page } from '@playwright/test'

const INTRO_SESSION_KEY = 'language-school:intro-completed'
const viewports = [
  { width: 1440, height: 900 },
  { width: 1180, height: 900 },
  { width: 820, height: 900 },
  { width: 390, height: 844 },
]

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

function cloudChunkLoaded(resources: string[]): boolean {
  return resources.some((name) => /CloudPortalTransition-[^/]+\.(?:js|css)(?:\?|$)/.test(name))
}

async function resetIntro(page: Page) {
  await page.goto('/')
  await page.evaluate((key) => window.sessionStorage.removeItem(key), INTRO_SESSION_KEY)
  await page.reload()
}

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1)
}

test('17F: portal cubre 1440, 1180, 820 y 390 sin overflow ni carga anticipada', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await resetIntro(page)

    await expect(page.getByRole('button', { name: 'ENTRAR' })).toBeVisible()
    const before = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name))
    expect(cloudChunkLoaded(before)).toBe(false)

    await page.getByRole('button', { name: 'ENTRAR' }).click()
    const overlay = page.locator('.cloud-portal-transition')
    await expect(overlay).toBeVisible({ timeout: 5000 })
    await expect(overlay).toHaveCount(1)
    await expect(overlay).toHaveAttribute('aria-hidden', 'true')

    const rect = await overlay.evaluate((element) => {
      const box = element.getBoundingClientRect()
      return { x: box.x, y: box.y, width: box.width, height: box.height }
    })
    expect(rect.x).toBeLessThanOrEqual(1)
    expect(rect.y).toBeLessThanOrEqual(1)
    expect(rect.width).toBeGreaterThanOrEqual(viewport.width - 1)
    expect(rect.height).toBeGreaterThanOrEqual(viewport.height - 1)
    await expectNoHorizontalOverflow(page)

    await expect.poll(
      () => page.evaluate((key) => window.sessionStorage.getItem(key), INTRO_SESSION_KEY),
      { timeout: 5000 },
    ).toBe('true')
    await expect(overlay).toHaveCount(0, { timeout: 5000 })
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await expectNoHorizontalOverflow(page)
  }
})

test('17F: reduced motion lleva al alumno hasta el aula sin descargar el portal visual', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/acceso')

  await page.getByLabel('Email').fill(requiredEnv('E2E_STUDENT_EMAIL'))
  await page.getByLabel('Contraseña').fill(requiredEnv('E2E_STUDENT_PASSWORD'))
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page).toHaveURL(/\/alumno$/, { timeout: 5000 })
  await expect(page.locator('.cloud-portal-transition')).toHaveCount(0)
  let resources = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name))
  expect(cloudChunkLoaded(resources)).toBe(false)

  const classroomEntry = page.locator('.campus-online-entry')
  await expect(classroomEntry).toBeVisible()
  await classroomEntry.click()

  await expect(page).toHaveURL(/\/alumno\/aula\/[^/]+$/, { timeout: 5000 })
  await expect(page.locator('.cloud-portal-transition')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name: 'E2E Speaking class' })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  resources = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name))
  expect(cloudChunkLoaded(resources)).toBe(false)
})
