import { expect, test, type Page } from '@playwright/test'

const INTRO_SESSION_KEY = 'language-school:intro-completed'

function cloudChunkLoaded(resources: string[]): boolean {
  return resources.some((name) => /CloudPortalTransition-[^/]+\.(?:js|css)(?:\?|$)/.test(name))
}

async function resetIntro(page: Page) {
  await page.goto('/')
  await page.evaluate((key) => window.sessionStorage.removeItem(key), INTRO_SESSION_KEY)
  await page.reload()
}

test('17C: ENTRAR activa portal lazy, monta Home durante whiteout y conserva returning session', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await resetIntro(page)

  await expect(page.getByLabel('Language School Rocío Ruiz')).toBeVisible()
  await expect(page.locator('.intro-orbit-globe-canvas canvas')).toBeVisible()
  await expect(page.getByRole('button', { name: 'ENTRAR' })).toBeVisible()

  const before = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name))
  expect(cloudChunkLoaded(before)).toBe(false)

  await page.getByRole('button', { name: 'ENTRAR' }).click()
  await expect(page.locator('.cloud-portal-transition')).toBeVisible()
  await expect(page.getByRole('button', { name: 'ENTRANDO…' })).toBeDisabled()

  const during = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name))
  expect(cloudChunkLoaded(during)).toBe(true)

  await expect.poll(() => page.evaluate((key) => window.sessionStorage.getItem(key), INTRO_SESSION_KEY), { timeout: 4500 }).toBe('true')
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 4500 })
  await expect(page.locator('.cloud-portal-transition')).toHaveCount(0, { timeout: 4500 })

  await page.reload()
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  await expect(page.locator('.intro-orbit-globe-canvas')).toHaveCount(0)
  await expect(page.locator('.cloud-portal-transition')).toHaveCount(0)

  const returningResources = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name))
  expect(cloudChunkLoaded(returningResources)).toBe(false)
})

test('17C: reduced motion entra inmediatamente sin descargar la transición de nubes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await resetIntro(page)

  await expect(page.getByRole('button', { name: 'ENTRAR' })).toBeVisible()
  await page.getByRole('button', { name: 'ENTRAR' }).click()

  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 1500 })
  await expect(page.locator('.cloud-portal-transition')).toHaveCount(0)
  await expect.poll(() => page.evaluate((key) => window.sessionStorage.getItem(key), INTRO_SESSION_KEY)).toBe('true')

  const resources = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name))
  expect(cloudChunkLoaded(resources)).toBe(false)
})
