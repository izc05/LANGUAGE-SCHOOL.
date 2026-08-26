import { expect, test, type Page } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

const student = {
  email: requiredEnv('E2E_STUDENT_EMAIL'),
  password: requiredEnv('E2E_STUDENT_PASSWORD'),
}

const routes = [
  '/alumno',
  '/alumno/nivel',
  '/alumno/clases',
  '/alumno/material',
  '/alumno/tareas',
  '/alumno/avisos',
  '/alumno/archivos',
  '/alumno/perfil',
] as const

const viewports = [
  { width: 1440, height: 1000 },
  { width: 1180, height: 900 },
  { width: 820, height: 900 },
  { width: 390, height: 844 },
] as const

async function login(page: Page) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(student.email)
  await page.getByLabel('Contraseña').fill(student.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/alumno$/)
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

test('10.7: Campus Alumno mantiene todas sus rutas dentro de 1440, 1180, 820 y 390', async ({ page }) => {
  test.setTimeout(60_000)
  await login(page)

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)

    for (const route of routes) {
      await page.goto(route)
      await expect(page.locator('.dashboard-shell-student')).toBeVisible()
      await expect(page.locator('.dashboard-content').first()).toBeVisible()
      await expect(page.getByRole('navigation', { name: 'Menú de Alumno' })).toBeVisible()
      await expectNoHorizontalOverflow(page)
    }
  }
})

test('10.7: tablet conserva navegación legible y móvil ofrece carril táctil accesible', async ({ page }) => {
  await login(page)

  await page.setViewportSize({ width: 820, height: 900 })
  await page.goto('/alumno')
  const tabletNav = page.getByRole('navigation', { name: 'Menú de Alumno' })
  await expect(tabletNav).toBeVisible()
  const tabletGeometry = await page.evaluate(() => {
    const sidebar = document.querySelector('.dashboard-shell-student .dashboard-sidebar') as HTMLElement | null
    const links = [...document.querySelectorAll('.dashboard-shell-student .dashboard-nav a')] as HTMLElement[]
    return {
      sidebarWidth: sidebar?.getBoundingClientRect().width || 0,
      clippedLabels: links.filter((link) => link.scrollWidth > link.clientWidth + 1).length,
    }
  })
  expect(tabletGeometry.sidebarWidth).toBeGreaterThanOrEqual(190)
  expect(tabletGeometry.clippedLabels).toBe(0)
  await expectNoHorizontalOverflow(page)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/alumno')
  const mobileNav = page.getByRole('navigation', { name: 'Menú de Alumno' })
  await expect(mobileNav).toBeVisible()

  const mobileGeometry = await page.evaluate(() => {
    const nav = document.querySelector('.dashboard-shell-student .dashboard-nav') as HTMLElement | null
    const links = [...document.querySelectorAll('.dashboard-shell-student .dashboard-nav a')] as HTMLElement[]
    return {
      display: nav ? getComputedStyle(nav).display : '',
      overflowX: nav ? getComputedStyle(nav).overflowX : '',
      minLinkHeight: links.length ? Math.min(...links.map((link) => link.getBoundingClientRect().height)) : 0,
      linkCount: links.length,
    }
  })

  expect(mobileGeometry.display).toBe('flex')
  expect(['auto', 'scroll']).toContain(mobileGeometry.overflowX)
  expect(mobileGeometry.linkCount).toBeGreaterThanOrEqual(8)
  expect(mobileGeometry.minLinkHeight).toBeGreaterThanOrEqual(40)

  const profileLink = mobileNav.getByRole('link', { name: 'Mi perfil' })
  await profileLink.focus()
  const focusStyle = await profileLink.evaluate((element) => {
    const style = getComputedStyle(element)
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth }
  })
  expect(focusStyle.outlineStyle).not.toBe('none')
  expect(focusStyle.outlineWidth).not.toBe('0px')

  await profileLink.click()
  await expect(page).toHaveURL(/\/alumno\/perfil$/)
  await expectNoHorizontalOverflow(page)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/alumno/avisos')
  const reducedLink = page.getByRole('navigation', { name: 'Menú de Alumno' }).getByRole('link', { name: 'Avisos' })
  const transitionDurationSeconds = await reducedLink.evaluate((element) => {
    const raw = getComputedStyle(element).transitionDuration.split(',')[0]?.trim() || '0s'
    if (raw.endsWith('ms')) return Number.parseFloat(raw) / 1000
    return Number.parseFloat(raw)
  })
  expect(transitionDurationSeconds).toBeLessThanOrEqual(0.001)
})
