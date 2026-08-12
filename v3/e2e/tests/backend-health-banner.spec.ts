import { expect, test } from '@playwright/test'

test('avisa de caída temporal y se recupera al reintentar', async ({ page }) => {
  let healthAvailable = false

  await page.route('**/api/health', async (route) => {
    if (!healthAvailable) {
      await route.abort('failed')
      return
    }
    await route.continue()
  })

  await page.goto('/')
  const banner = page.getByText('Conexión temporalmente no disponible')
  await expect(banner).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  healthAvailable = true
  await page.getByRole('button', { name: 'Reintentar' }).click()
  await expect(banner).toHaveCount(0)
})
