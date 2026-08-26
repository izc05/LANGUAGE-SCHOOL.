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

test('9.7C: returning session no solicita CSS ni fuentes exclusivas de la intro', async ({ page }) => {
  await page.addInitScript((key) => {
    window.sessionStorage.setItem(key, 'true')
  }, INTRO_SESSION_KEY)

  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  await expect(page.locator('.intro-orbit-globe-canvas')).toHaveCount(0)
  await page.evaluate(() => document.fonts.ready)

  const resources = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((entry) => entry.name),
  )

  expect(resources.some((name) => /\/IntroPage-[^/]+\.js(?:\?|$)/.test(name))).toBe(false)
  expect(resources.some((name) => /\/IntroPage-[^/]+\.css(?:\?|$)/.test(name))).toBe(false)
  expect(resources.some((name) => name.includes('fonts.googleapis.com') && /Montserrat|Playball/i.test(name))).toBe(false)
})
