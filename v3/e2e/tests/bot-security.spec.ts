import { expect, test } from '@playwright/test'

const privatePaths = ['/acceso', '/admin', '/alumno', '/profesor']

test('robots.txt permite búsqueda y asistencia, pero bloquea entrenamiento y zonas privadas', async ({ request }) => {
  const response = await request.get('/robots.txt')
  expect(response.ok()).toBeTruthy()

  const robots = await response.text()
  expect(robots).toContain('Content-signal: search=yes, ai-input=yes, ai-train=no, use=reference')
  expect(robots).toContain('User-agent: GPTBot\nDisallow: /')
  expect(robots).toContain('User-agent: OAI-SearchBot')
  expect(robots).toContain('User-agent: ChatGPT-User')

  for (const path of privatePaths) {
    expect(robots).toContain(`Disallow: ${path}`)
  }
})

for (const path of privatePaths) {
  test(`${path} publica noindex y nofollow`, async ({ page }) => {
    await page.goto(path)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow, noarchive, nosnippet')
    await expect(page.locator('meta[name="googlebot"]')).toHaveAttribute('content', 'noindex, nofollow, noarchive, nosnippet')
  })
}

test('una ruta pública no hereda la directiva privada', async ({ page }) => {
  await page.goto('/acceso')
  await expect(page.locator('meta[name="robots"]')).toHaveCount(1)

  await page.goto('/contacto')
  await expect(page.locator('meta[data-language-school-route-seo]')).toHaveCount(0)
})
