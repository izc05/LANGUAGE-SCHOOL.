import { expect, test, type Page } from '@playwright/test'
import { enterHome } from '../helpers/intro'

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1)
}

async function expectMenuInsideViewport(page: Page, viewportWidth: number) {
  const box = await page.locator('#public-main-navigation').boundingBox()
  expect(box).not.toBeNull()
  if (!box) return
  expect(box.x).toBeGreaterThanOrEqual(-1)
  expect(box.x + box.width).toBeLessThanOrEqual(viewportWidth + 1)
}

async function expectShell(page: Page) {
  await expect(page.locator('.site-header')).toBeVisible()
  await expect(page.locator('.site-footer')).toBeVisible()
  await expectNoHorizontalOverflow(page)
}

test('el shell desktop mantiene marca, navegación y acceso sin compresión en 1440 y 1180', async ({ page }) => {
  for (const width of [1440, 1180]) {
    await page.setViewportSize({ width, height: 900 })
    await enterHome(page)

    await expect(page.locator('.academy-topbar')).toBeVisible()
    await expect(page.locator('.site-header .brand-logo-image')).toBeVisible()
    await expect(page.locator('.site-header .brand-copy')).toBeVisible()
    await expect(page.locator('.main-nav')).toBeVisible()
    await expect(page.locator('.nav-toggle')).toBeHidden()
    await expect(page.locator('.header-access')).toBeVisible()
    await expect(page.locator('.main-nav .nav-links a')).toHaveCount(7)
    await expectShell(page)
  }
})

test('el menú compacto funciona con teclado, Escape y cierre tras navegación en 820', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 900 })
  await enterHome(page)

  const toggle = page.locator('.nav-toggle')
  const navigation = page.locator('#public-main-navigation')
  await expect(page.locator('.academy-topbar')).toBeHidden()
  await expect(toggle).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(navigation).toBeHidden()

  const toggleBox = await toggle.boundingBox()
  expect(toggleBox?.height ?? 0).toBeGreaterThanOrEqual(44)

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(navigation).toBeVisible()
  await expectMenuInsideViewport(page, 820)
  await expect(page.locator('.nav-backdrop')).toBeVisible()
  await expect(page.locator('.nav-panel-close')).toBeInViewport()
  await expect(page.locator('.nav-links a').first()).toBeFocused()
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')

  await page.keyboard.press('Escape')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(navigation).toBeHidden()
  await expect(toggle).toBeFocused()
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')

  await toggle.click()
  await page.locator('.nav-links a', { hasText: 'Programas' }).click()
  await expect(page).toHaveURL(/\/programas$/)
  await expect(navigation).toBeHidden()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expectShell(page)
})

test('el shell móvil a 390 mantiene controles táctiles y cero overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await enterHome(page)

  const toggle = page.locator('.nav-toggle')
  await expect(toggle).toBeVisible()
  await toggle.click()

  const navigation = page.locator('#public-main-navigation')
  await expect(navigation).toBeVisible()
  await expectMenuInsideViewport(page, 390)
  const navBox = await navigation.boundingBox()
  expect(navBox?.width ?? 9999).toBeLessThanOrEqual(390)

  const close = page.locator('.nav-panel-close')
  await expect(close).toBeInViewport()
  const closeBox = await close.boundingBox()
  expect(closeBox?.width ?? 0).toBeGreaterThanOrEqual(44)
  expect(closeBox?.height ?? 0).toBeGreaterThanOrEqual(44)

  await expect(page.locator('.nav-mobile-meta .button')).toBeVisible()
  await close.click()
  await expect(navigation).toBeHidden()
  await expectShell(page)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await toggle.click()
  const transitionDuration = await navigation.evaluate((element) => getComputedStyle(element).transitionDuration)
  expect(Number.parseFloat(transitionDuration)).toBeLessThanOrEqual(0.001)
})

test('el shell se mantiene íntegro en todas las rutas públicas actuales', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 900 })
  await enterHome(page)

  for (const path of ['/', '/programas', '/tarifas', '/profesores', '/sobre-nosotros', '/blog', '/contacto', '/acceso']) {
    await page.goto(path)
    if (path === '/acceso') {
      await expect(page.getByText('Acceso seguro a tu espacio privado.')).toBeVisible()
      await expectNoHorizontalOverflow(page)
      continue
    }
    await expectShell(page)
  }
})
