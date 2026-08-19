import { expect, test } from '@playwright/test'

const INTRO_SESSION_KEY = 'language-school:intro-completed'

function cloudChunkLoaded(resources: string[]): boolean {
  return resources.some((name) => /CloudPortalTransition-[^/]+\.(?:js|css)(?:\?|$)/.test(name))
}

test('17A: provider global permanece inactivo y la transición visual sigue lazy', async ({ page }) => {
  await page.addInitScript((key) => window.sessionStorage.setItem(key, 'true'), INTRO_SESSION_KEY)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  await expect(page.locator('.cloud-portal-transition')).toHaveCount(0)

  const homeResources = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name))
  expect(cloudChunkLoaded(homeResources)).toBe(false)

  await page.goto('/programas')
  await expect(page.locator('.cloud-portal-transition')).toHaveCount(0)
  const programResources = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name))
  expect(cloudChunkLoaded(programResources)).toBe(false)
})
