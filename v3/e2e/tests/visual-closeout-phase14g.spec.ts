import { expect, test, type Locator, type Page } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

const admin = {
  email: requiredEnv('E2E_ADMIN_EMAIL'),
  password: requiredEnv('E2E_ADMIN_PASSWORD'),
}
const teacher = {
  email: requiredEnv('E2E_TEACHER_EMAIL'),
  password: requiredEnv('E2E_TEACHER_PASSWORD'),
}

const viewports = [
  { width: 1440, height: 1000 },
  { width: 1180, height: 900 },
  { width: 820, height: 900 },
  { width: 390, height: 844 },
] as const

async function login(page: Page, email: string, password: string, expected: RegExp) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(expected)
}

async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

async function expectLightSurface(locator: Locator) {
  await expect(locator).toBeVisible()
  const resolved = await locator.evaluate((element) => {
    let current: Element | null = element
    while (current) {
      const color = getComputedStyle(current).backgroundColor
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
      if (match) {
        const alpha = match[4] === undefined ? 1 : Number.parseFloat(match[4])
        if (alpha > 0.05) {
          return { color, channels: match.slice(1, 4).map(Number), alpha }
        }
      }
      current = current.parentElement
    }
    return null
  })
  expect(resolved, 'La superficie visible debe resolver un fondo real en ella o en su contenedor').not.toBeNull()
  expect(Math.min(...resolved!.channels)).toBeGreaterThanOrEqual(245)
}

async function expectExactActiveNav(page: Page, ariaLabel: string, href: string) {
  const nav = page.getByRole('navigation', { name: ariaLabel })
  const active = nav.locator('a[aria-current="page"]')
  await expect(active).toHaveCount(1)
  await expect(active).toHaveAttribute('href', href)
}

test('14G: Admin mantiene nitidez, jerarquía y cero overflow en sus pantallas críticas', async ({ page }) => {
  test.setTimeout(180_000)
  await page.setViewportSize(viewports[0])
  await login(page, admin.email, admin.password, /\/admin$/)

  await page.goto('/admin/alumnos')
  const studentHref = await page.locator('.phase14-student-row:not(.phase14-student-header)').first().getAttribute('href')
  expect(studentHref).toMatch(/^\/admin\/alumnos\//)

  await page.goto('/admin/profesores')
  const teacherHref = await page.locator('.phase14-teacher-card').first().getAttribute('href')
  expect(teacherHref).toMatch(/^\/admin\/profesores\//)

  const routes = [
    { path: '/admin', nav: '/admin', surface: '.admin-dashboard-phase12a .admin-columns > .panel' },
    { path: '/admin/alumnos', nav: '/admin/alumnos', surface: '.phase14-student-table' },
    { path: studentHref!, nav: '/admin/alumnos', surface: '.phase14-profile-card' },
    { path: '/admin/profesores', nav: '/admin/profesores', surface: '.phase14-teacher-card' },
    { path: teacherHref!, nav: '/admin/profesores', surface: '.phase14-profile-card' },
    { path: '/admin/cursos', nav: '/admin/cursos', surface: '.course-admin-card' },
    { path: '/admin/clases', nav: '/admin/clases', surface: '.admin-class-attendance' },
    { path: '/admin/avisos', nav: '/admin/avisos', surface: '.notifications-admin-page .panel' },
    { path: '/admin/pagos', nav: '/admin/pagos', surface: '.payment-ledger' },
  ] as const

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    for (const route of routes) {
      await page.goto(route.path)
      await expect(page.locator('.dashboard-shell-admin')).toBeVisible()
      await expect(page.locator('#main-content .dashboard-content')).toBeVisible()
      await expectExactActiveNav(page, 'Menú de Administrador', route.nav)
      await expectLightSurface(page.locator(route.surface).first())
      await expectNoOverflow(page)
    }
  }
})

test('14G: Profesor conserva formularios amplios y lectura limpia en los cuatro viewports', async ({ page }) => {
  test.setTimeout(150_000)
  await page.setViewportSize(viewports[0])
  await login(page, teacher.email, teacher.password, /\/profesor$/)

  const routes = [
    { path: '/profesor/clases', surface: '.teacher-class-create' },
    { path: '/profesor/material', surface: '.teacher-material-form' },
    { path: '/profesor/tareas', surface: '.teacher-assignment-form' },
    { path: '/profesor/correcciones', surface: '.teacher-corrections-workspace' },
    { path: '/profesor/alumnos', surface: '.teacher-students-grid' },
    { path: '/profesor/niveles', surface: '.teacher-levels-grid' },
    { path: '/profesor/agenda', surface: '.monthly-class-calendar' },
  ] as const

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    for (const route of routes) {
      await page.goto(route.path)
      await expect(page.locator('.dashboard-shell-teacher')).toBeVisible()
      const surface = page.locator(route.surface).first()
      await expect(surface).toBeVisible()
      await expectNoOverflow(page)

      if (viewport.width >= 1180 && ['/profesor/clases', '/profesor/material', '/profesor/tareas'].includes(route.path)) {
        const width = await surface.evaluate((element) => element.getBoundingClientRect().width)
        expect(width).toBeGreaterThan(430)
      }
    }
  }
})

test('14G: foco visible y movimiento reducido siguen protegidos tras la pasada visual', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await login(page, admin.email, admin.password, /\/admin$/)
  await page.goto('/admin/cursos')

  const active = page.getByRole('navigation', { name: 'Menú de Administrador' }).locator('a[aria-current="page"]')
  await active.focus()
  const focus = await active.evaluate((element) => {
    const style = getComputedStyle(element)
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth }
  })
  expect(focus.outlineStyle).not.toBe('none')
  expect(focus.outlineWidth).not.toBe('0px')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  const courseCard = page.locator('.course-admin-card').first()
  const transition = await courseCard.evaluate((element) => getComputedStyle(element).transitionDuration)
  const durations = transition.split(',').map((value) => {
    const normalized = value.trim()
    const amount = Number.parseFloat(normalized) || 0
    return normalized.endsWith('ms') ? amount : amount * 1000
  })
  expect(Math.max(...durations)).toBeLessThanOrEqual(1)
  await expectNoOverflow(page)
})
