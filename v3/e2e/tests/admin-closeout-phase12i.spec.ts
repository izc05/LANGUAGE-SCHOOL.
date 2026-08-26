import { expect, test, type Page } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

const admin = {
  email: requiredEnv('E2E_ADMIN_EMAIL'),
  password: requiredEnv('E2E_ADMIN_PASSWORD'),
}

const adminRoutes = [
  { label: 'Dashboard', path: '/admin' },
  { label: 'Contactos', path: '/admin/contactos' },
  { label: 'Avisos', path: '/admin/avisos' },
  { label: 'Alumnos', path: '/admin/alumnos' },
  { label: 'Profesores', path: '/admin/profesores' },
  { label: 'Cursos', path: '/admin/cursos' },
  { label: 'Clases', path: '/admin/clases' },
  { label: 'Agenda', path: '/admin/agenda' },
  { label: 'Pagos', path: '/admin/pagos' },
  { label: 'Aula online', path: '/admin/aula-online' },
  { label: 'Zoom', path: '/admin/zoom' },
  { label: 'Test de nivel', path: '/admin/test-de-nivel' },
  { label: 'Resultados nivel', path: '/admin/test-de-nivel/resultados' },
  { label: 'Página web', path: '/admin/web' },
  { label: 'Sobre nosotros', path: '/admin/web/sobre-nosotros' },
  { label: 'Profesores web', path: '/admin/profesores/publicos' },
  { label: 'Blog', path: '/admin/blog' },
  { label: 'Multimedia', path: '/admin/multimedia' },
  { label: 'Tarifas', path: '/admin/tarifas' },
  { label: 'Administradores', path: '/admin/administradores' },
  { label: 'Configuración', path: '/admin/configuracion' },
  { label: 'Sistema', path: '/admin/sistema' },
] as const

const viewports = [
  { name: '1440', width: 1440, height: 1000 },
  { name: '1180', width: 1180, height: 900 },
  { name: '820', width: 820, height: 900 },
  { name: '390', width: 390, height: 844 },
] as const

async function login(page: Page) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(admin.email)
  await page.getByLabel('Contraseña').fill(admin.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

async function expectNoPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
}

for (const viewport of viewports) {
  test(`13+: las 22 rutas Admin cierran sin overflow y con navegación exacta en ${viewport.name}`, async ({ page }) => {
    test.setTimeout(135_000)
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await login(page)

    for (const route of adminRoutes) {
      await page.goto(route.path)
      await expect(page.locator('.dashboard-shell-admin')).toBeVisible()
      await expect(page.locator('#main-content .dashboard-content')).toBeVisible()
      await expect(page.locator('.route-loading')).toHaveCount(0)

      const nav = page.getByRole('navigation', { name: 'Menú de Administrador' })
      await expect(nav.getByRole('link')).toHaveCount(22)

      const activeLinks = nav.locator('a[aria-current="page"]')
      await expect(activeLinks).toHaveCount(1)
      await expect(activeLinks).toHaveAttribute('href', route.path)
      await expect(activeLinks).toContainText(route.label)

      await expectNoPageOverflow(page)
    }

    const nav = page.getByRole('navigation', { name: 'Menú de Administrador' })
    const activeLink = nav.locator('a[aria-current="page"]')
    await activeLink.focus()
    const focus = await activeLink.evaluate((element) => {
      const style = getComputedStyle(element)
      return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, backgroundImage: style.backgroundImage }
    })
    expect(focus.outlineStyle).not.toBe('none')
    expect(focus.outlineWidth).not.toBe('0px')
    expect(focus.backgroundImage).toContain('linear-gradient')

    const activeDot = activeLink.locator('.nav-dot')
    const dotColor = await activeDot.evaluate((element) => getComputedStyle(element).backgroundColor)
    expect(dotColor).not.toBe('rgb(142, 168, 145)')
  })
}
