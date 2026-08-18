import { expect, test } from '@playwright/test'

test('Programas utiliza una experiencia fotográfica incluso sin portada CMS', async ({ page }) => {
  await page.goto('/programas')

  await expect(page.locator('.programs-v2-hero-visual.has-photo')).toBeVisible()
  const courseVisuals = page.locator('.programs-v2-course-visual.has-image')
  await expect(courseVisuals.first()).toBeVisible()
  expect(await courseVisuals.count()).toBeGreaterThan(0)
  await expect(page.locator('.programs-v2-course-visual.has-local-fallback')).toHaveCount(0)
})

test('cambiar de página reinicia la navegación desde arriba', async ({ page }) => {
  await page.goto('/programas')
  const guidance = page.locator('.programs-v2-guidance')
  await expect(guidance).toBeVisible()

  const reject = page.getByRole('button', { name: 'Rechazar opcionales' })
  if (await reject.isVisible().catch(() => false)) await reject.click()

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300)

  await guidance.getByRole('link', { name: 'Quiero orientación' }).click()
  await expect(page).toHaveURL(/\/contacto$/)
  await expect(page.getByRole('heading', { name: 'Cuéntanos qué quieres conseguir.' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(2)
  await expect(page.getByRole('heading', { name: 'Cuéntanos qué quieres conseguir.' })).toBeInViewport()
})
