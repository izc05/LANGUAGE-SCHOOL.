import { expect, test } from '@playwright/test'
import { enterHome } from '../helpers/intro'

test('Home incorpora razones editoriales verificables sin overflow', async ({ page }) => {
  for (const width of [1440, 820, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    await enterHome(page)

    const section = page.locator('.home-reasons')
    await expect(section).toBeVisible()
    await expect(section.getByRole('heading', { name: /Lo que importa no es solo dar clase/ })).toBeVisible()
    await expect(section.locator('.home-reasons-list article')).toHaveCount(6)
    await expect(section).toContainText('Grupos reducidos')
    await expect(section).toContainText('Seguimiento personal')
    await expect(section).toContainText('Cercanía de verdad')

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1)
  }
})

test('el lienzo público es blanco y el rosa queda como luz localizada', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await enterHome(page)

  const bodyBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(bodyBackground).toBe('rgb(255, 255, 255)')

  const heroBackground = await page.locator('.hero-v3').evaluate((element) => getComputedStyle(element).backgroundImage)
  expect(heroBackground).toContain('radial-gradient')
  expect(heroBackground).toContain('linear-gradient')

  const reasonsBackground = await page.locator('.home-reasons').evaluate((element) => getComputedStyle(element).backgroundImage)
  expect(reasonsBackground).toContain('radial-gradient')
})
