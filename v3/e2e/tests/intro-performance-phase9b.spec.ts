import { expect, test } from '@playwright/test'

const INTRO_SESSION_KEY = 'language-school:intro-completed'

test('9.7B: primera visita conserva globo 3D y una sesión completada no vuelve a cargar IntroPage', async ({ page }) => {
  await page.goto('/')
  await page.evaluate((key) => window.sessionStorage.removeItem(key), INTRO_SESSION_KEY)
  await page.reload()

  await expect(page.getByLabel('Language School Rocío Ruiz')).toBeVisible()
  await expect(page.locator('.intro-orbit-globe-canvas canvas')).toBeVisible()
  await expect(page.getByRole('button', { name: 'ENTRAR' })).toBeVisible()

  await page.getByRole('button', { name: 'ENTRAR' }).click()
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  await expect.poll(() => page.evaluate((key) => window.sessionStorage.getItem(key), INTRO_SESSION_KEY)).toBe('true')

  await page.reload()
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  await expect(page.locator('.intro-orbit-globe-canvas')).toHaveCount(0)

  const loadedScripts = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((name) => name.includes('.js')),
  )

  expect(loadedScripts.some((name) => /\/IntroPage-[^/]+\.js(?:\?|$)/.test(name))).toBe(false)
})
