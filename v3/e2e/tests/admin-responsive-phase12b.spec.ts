import { expect, test } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

function durationInMs(value: string): number {
  const normalized = value.trim()
  const amount = Number.parseFloat(normalized)
  return normalized.endsWith('ms') ? amount : amount * 1000
}

const admin = {
  email: requiredEnv('E2E_ADMIN_EMAIL'),
  password: requiredEnv('E2E_ADMIN_PASSWORD'),
}

async function login(page: import('@playwright/test').Page) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(admin.email)
  await page.getByLabel('Contraseña').fill(admin.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

test('12.2: Admin agrupa sus 19 rutas y mantiene navegación completa en tablet y móvil', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(page)

  const nav = page.getByRole('navigation', { name: 'Menú de Administrador' })
  await expect(nav.getByRole('link')).toHaveCount(19)
  await expect(page.locator('.dashboard-shell-admin .dashboard-nav-section')).toHaveText([
    'Operación',
    'Academia',
    'Web y contenido',
    'Sistema',
  ])

  await page.setViewportSize({ width: 820, height: 900 })
  await expect(nav.getByRole('link', { name: 'Dashboard' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Resultados nivel' })).toBeVisible()
  const tabletSidebar = await page.locator('.dashboard-shell-admin .dashboard-sidebar').evaluate((element) => element.getBoundingClientRect().width)
  expect(tabletSidebar).toBeGreaterThanOrEqual(220)

  await page.setViewportSize({ width: 390, height: 844 })
  const mobileNav = page.locator('.dashboard-shell-admin .dashboard-nav')
  await expect(mobileNav).toBeVisible()
  const navStyle = await mobileNav.evaluate((element) => {
    const style = getComputedStyle(element)
    return { display: style.display, overflowX: style.overflowX }
  })
  expect(navStyle.display).toBe('flex')
  expect(['auto', 'scroll']).toContain(navStyle.overflowX)

  const dashboardLink = nav.getByRole('link', { name: 'Dashboard' })
  const touchHeight = await dashboardLink.evaluate((element) => element.getBoundingClientRect().height)
  expect(touchHeight).toBeGreaterThanOrEqual(40)

  await dashboardLink.focus()
  const focusStyle = await dashboardLink.evaluate((element) => {
    const style = getComputedStyle(element)
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth }
  })
  expect(focusStyle.outlineStyle).not.toBe('none')
  expect(focusStyle.outlineWidth).not.toBe('0px')

  const pageFits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  expect(pageFits).toBe(true)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  const transitionDuration = await dashboardLink.evaluate((element) => getComputedStyle(element).transitionDuration)
  expect(transitionDuration.split(',').every((value) => durationInMs(value) <= 0.01)).toBe(true)
})