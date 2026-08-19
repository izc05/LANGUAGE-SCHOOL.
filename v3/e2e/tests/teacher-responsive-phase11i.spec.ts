import { expect, test, type Page } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

const teacher = {
  email: requiredEnv('E2E_TEACHER_EMAIL'),
  password: requiredEnv('E2E_TEACHER_PASSWORD'),
}

const routes = [
  { label: 'Resumen', to: '/profesor' },
  { label: 'Mis alumnos', to: '/profesor/alumnos' },
  { label: 'Niveles', to: '/profesor/niveles' },
  { label: 'Clases', to: '/profesor/clases' },
  { label: 'Agenda', to: '/profesor/agenda' },
  { label: 'Material', to: '/profesor/material' },
  { label: 'Tareas', to: '/profesor/tareas' },
  { label: 'Correcciones', to: '/profesor/correcciones' },
  { label: 'Mi perfil', to: '/profesor/perfil' },
] as const

const viewports = [
  { width: 1440, height: 1000 },
  { width: 1180, height: 900 },
  { width: 820, height: 900 },
  { width: 390, height: 844 },
] as const

async function login(page: Page) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(teacher.email)
  await page.getByLabel('Contraseña').fill(teacher.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/profesor$/)
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

test('11.9: Portal Profesor mantiene sus nueve rutas dentro de 1440, 1180, 820 y 390', async ({ page }) => {
  await login(page)

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)

    for (const route of routes) {
      await page.goto(route.to)
      await expect(page).toHaveURL(new RegExp(`${route.to.replaceAll('/', '\\/')}$`))
      await expect(page.locator('.dashboard-shell-teacher')).toBeVisible()
      await expect(page.locator('.dashboard-content').first()).toBeVisible()
      const nav = page.getByRole('navigation', { name: 'Menú de Profesor' })
      await expect(nav).toBeVisible()
      await expect(nav.getByRole('link', { name: route.label })).toHaveClass(/active/)
      await expect(nav.locator('a.active')).toHaveCount(1)
      await expectNoHorizontalOverflow(page)
    }
  }
})

test('11.9: tablet conserva etiquetas y móvil ofrece navegación táctil, foco y reduced motion', async ({ page }) => {
  await login(page)

  await page.setViewportSize({ width: 820, height: 900 })
  await page.goto('/profesor')
  const tabletNav = page.getByRole('navigation', { name: 'Menú de Profesor' })
  await expect(tabletNav).toBeVisible()

  const tabletGeometry = await page.evaluate(() => {
    const sidebar = document.querySelector('.dashboard-shell-teacher .dashboard-sidebar') as HTMLElement | null
    const links = [...document.querySelectorAll('.dashboard-shell-teacher .dashboard-nav a')] as HTMLElement[]
    return {
      sidebarWidth: sidebar?.getBoundingClientRect().width || 0,
      clippedLabels: links.filter((link) => link.scrollWidth > link.clientWidth + 1).length,
      linkCount: links.length,
    }
  })
  expect(tabletGeometry.sidebarWidth).toBeGreaterThanOrEqual(195)
  expect(tabletGeometry.clippedLabels).toBe(0)
  expect(tabletGeometry.linkCount).toBe(9)
  await expectNoHorizontalOverflow(page)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/profesor')
  let mobileNav = page.getByRole('navigation', { name: 'Menú de Profesor' })
  await expect(mobileNav).toBeVisible()

  const mobileGeometry = await page.evaluate(() => {
    const nav = document.querySelector('.dashboard-shell-teacher .dashboard-nav') as HTMLElement | null
    const links = [...document.querySelectorAll('.dashboard-shell-teacher .dashboard-nav a')] as HTMLElement[]
    return {
      display: nav ? getComputedStyle(nav).display : '',
      overflowX: nav ? getComputedStyle(nav).overflowX : '',
      minLinkHeight: links.length ? Math.min(...links.map((link) => link.getBoundingClientRect().height)) : 0,
      linkCount: links.length,
    }
  })

  expect(mobileGeometry.display).toBe('flex')
  expect(['auto', 'scroll']).toContain(mobileGeometry.overflowX)
  expect(mobileGeometry.linkCount).toBe(9)
  expect(mobileGeometry.minLinkHeight).toBeGreaterThanOrEqual(40)
  await expectNoHorizontalOverflow(page)

  for (const route of routes) {
    mobileNav = page.getByRole('navigation', { name: 'Menú de Profesor' })
    const link = mobileNav.getByRole('link', { name: route.label })
    await link.click()
    await expect(page).toHaveURL(new RegExp(`${route.to.replaceAll('/', '\\/')}$`))
    await expect(page.getByRole('navigation', { name: 'Menú de Profesor' }).locator('a.active')).toHaveCount(1)
    await expectNoHorizontalOverflow(page)
  }

  mobileNav = page.getByRole('navigation', { name: 'Menú de Profesor' })
  const profileLink = mobileNav.getByRole('link', { name: 'Mi perfil' })
  await profileLink.focus()
  const focusStyle = await profileLink.evaluate((element) => {
    const style = getComputedStyle(element)
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth }
  })
  expect(focusStyle.outlineStyle).not.toBe('none')
  expect(focusStyle.outlineWidth).not.toBe('0px')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/profesor/correcciones')
  const reducedLink = page.getByRole('navigation', { name: 'Menú de Profesor' }).getByRole('link', { name: 'Correcciones' })
  const transitionDurationSeconds = await reducedLink.evaluate((element) => {
    const raw = getComputedStyle(element).transitionDuration.split(',')[0]?.trim() || '0s'
    if (raw.endsWith('ms')) return Number.parseFloat(raw) / 1000
    return Number.parseFloat(raw)
  })
  expect(transitionDurationSeconds).toBeLessThanOrEqual(0.001)
})
