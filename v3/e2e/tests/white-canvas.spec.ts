import { expect, test } from '@playwright/test'
import { enterHome } from '../helpers/intro'

async function expectWhiteBackground(page: import('@playwright/test').Page, selector: string) {
  const background = await page.locator(selector).evaluate((element) => getComputedStyle(element).backgroundColor)
  expect(background).toBe('rgb(255, 255, 255)')
}

test('la Home usa blanco como lienzo dominante y conserva una única sección oscura de contraste', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await enterHome(page)

  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 255, 255)')
  for (const selector of ['.programs-premium', '.academy-real-premium', '.method-premium', '.blog-premium', '.home-final-cta']) {
    await expectWhiteBackground(page, selector)
  }

  const platformBackground = await page.locator('.platform-premium').evaluate((element) => getComputedStyle(element).backgroundColor)
  expect(platformBackground).not.toBe('rgb(255, 255, 255)')

  const heroBackgroundImage = await page.locator('.hero-v3').evaluate((element) => getComputedStyle(element).backgroundImage)
  expect(heroBackgroundImage).toContain('radial-gradient')
})

test('las páginas públicas interiores comparten el lienzo blanco con luz de marca localizada', async ({ page }) => {
  for (const [path, root, hero] of [
    ['/programas', '.programs-premium-v2', '.programs-v2-hero-editorial'],
    ['/profesores', '.teachers-premium-v2', '.teachers-v2-hero-editorial'],
    ['/sobre-nosotros', '.about-premium-v2', '.about-v2-hero-editorial'],
    ['/tarifas', '.pricing-premium-v2', '.pricing-v2-hero-editorial'],
    ['/blog', '.blog-premium-v2', '.blog-v2-hero-editorial'],
    ['/contacto', '.contact-premium-v2', '.contact-v2-hero-editorial'],
  ] as const) {
    await page.goto(path)
    await expectWhiteBackground(page, root)
    await expectWhiteBackground(page, hero)
    const image = await page.locator(hero).evaluate((element) => getComputedStyle(element).backgroundImage)
    expect(image, `${path} debe conservar un difuminado localizado`).toContain('radial-gradient')
  }
})
