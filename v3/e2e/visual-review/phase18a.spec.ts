import { expect, test, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const INTRO_SESSION_KEY = 'language-school:intro-completed'
const outputRoot = path.resolve('visual-review-artifacts/phase18a')
mkdirSync(outputRoot, { recursive: true })

type EvidenceRow = {
  area: string
  route: string
  viewport: string
  file?: string
  url?: string
  title?: string
  scrollWidth?: number
  clientWidth?: number
  scrollHeight?: number
  overflowX?: number
  status: 'captured' | 'skipped'
  note?: string
}

const evidence: EvidenceRow[] = []

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

function safeName(value: string): string {
  return value
    .replace(/^\/+/, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'home'
}

function flushManifest() {
  writeFileSync(
    path.join(outputRoot, 'manifest.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), evidence }, null, 2),
    'utf8',
  )
}

async function settle(page: Page) {
  await page.locator('.route-loading').waitFor({ state: 'hidden', timeout: 7000 }).catch(() => undefined)
  await page.waitForTimeout(350)
}

async function capture(
  page: Page,
  area: string,
  route: string,
  viewport: { width: number; height: number },
  label?: string,
) {
  await page.setViewportSize(viewport)
  await settle(page)
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    title: document.title,
  }))
  const viewportLabel = `${viewport.width}x${viewport.height}`
  const file = `${area}-${label || safeName(route)}-${viewport.width}.jpg`
  await page.screenshot({
    path: path.join(outputRoot, file),
    fullPage: true,
    type: 'jpeg',
    quality: 72,
  })
  evidence.push({
    area,
    route,
    viewport: viewportLabel,
    file,
    url: page.url(),
    title: metrics.title,
    scrollWidth: metrics.scrollWidth,
    clientWidth: metrics.clientWidth,
    scrollHeight: metrics.scrollHeight,
    overflowX: Math.max(0, metrics.scrollWidth - metrics.clientWidth),
    status: 'captured',
  })
  flushManifest()
}

function skipped(area: string, route: string, viewport: string, note: string) {
  evidence.push({ area, route, viewport, status: 'skipped', note })
  flushManifest()
}

async function gotoAndCapture(
  page: Page,
  area: string,
  route: string,
  viewport: { width: number; height: number },
) {
  await page.goto(route)
  await expect(page.locator('body')).toBeVisible()
  await capture(page, area, route, viewport)
}

async function login(page: Page, email: string, password: string, destination: string) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(new RegExp(`${destination.replace(/\//g, '\\/')}$`), { timeout: 8000 })
}

async function captureRouteMatrix(
  page: Page,
  area: string,
  routes: string[],
  viewports: { width: number; height: number }[],
) {
  for (const viewport of viewports) {
    for (const route of routes) {
      await gotoAndCapture(page, area, route, viewport)
    }
  }
}

const desktop = { width: 1440, height: 900 }
const tabletWide = { width: 1180, height: 900 }
const tablet = { width: 820, height: 900 }
const mobile = { width: 390, height: 844 }

test.describe.configure({ mode: 'serial' })

test('18A · web pública + intro + portal + test', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })

  for (const viewport of [desktop, mobile]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await page.evaluate((key) => sessionStorage.removeItem(key), INTRO_SESSION_KEY)
    await page.reload()
    await expect(page.getByRole('button', { name: 'ENTRAR' })).toBeVisible({ timeout: 8000 })
    await capture(page, 'public', '/', viewport, 'intro')

    await page.getByRole('button', { name: 'ENTRAR' }).click()
    const portal = page.locator('.cloud-portal-transition')
    await expect(portal).toBeVisible({ timeout: 5000 })
    await page.waitForTimeout(1200)
    await capture(page, 'public', '/', viewport, 'cloud-portal')
    await expect(portal).toHaveCount(0, { timeout: 6000 })
    await expect(page.locator('.site-header')).toBeVisible()
    await capture(page, 'public', '/', viewport, 'home')
  }

  await page.emulateMedia({ reducedMotion: 'reduce' })
  const publicRoutes = [
    '/programas',
    '/tarifas',
    '/profesores',
    '/sobre-nosotros',
    '/blog',
    '/contacto',
    '/test-de-nivel',
    '/acceso',
    '/privacidad',
    '/aviso-legal',
  ]
  await captureRouteMatrix(page, 'public', publicRoutes, [desktop, mobile])

  for (const viewport of [tabletWide, tablet]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await page.evaluate((key) => sessionStorage.setItem(key, 'true'), INTRO_SESSION_KEY)
    await page.reload()
    await expect(page.locator('.site-header')).toBeVisible()
    await capture(page, 'public', '/', viewport, 'home')
    await gotoAndCapture(page, 'public', '/programas', viewport)
    await gotoAndCapture(page, 'public', '/test-de-nivel', viewport)
    await gotoAndCapture(page, 'public', '/acceso', viewport)
  }

  await page.setViewportSize(desktop)
  await page.goto('/programas')
  const courseHref = await page.locator('a[href^="/programas/"]').first().getAttribute('href').catch(() => null)
  if (courseHref) {
    await gotoAndCapture(page, 'public-detail', courseHref, desktop)
    await gotoAndCapture(page, 'public-detail', courseHref, mobile)
  } else {
    skipped('public-detail', '/programas/:slug', '1440/390', 'No published course detail link was available in the E2E seed.')
  }

  await page.goto('/blog')
  const postHref = await page.locator('a[href^="/blog/"]').first().getAttribute('href').catch(() => null)
  if (postHref) {
    await gotoAndCapture(page, 'public-detail', postHref, desktop)
    await gotoAndCapture(page, 'public-detail', postHref, mobile)
  } else {
    skipped('public-detail', '/blog/:slug', '1440/390', 'No published blog detail link was available in the E2E seed.')
  }

  await page.setViewportSize(desktop)
  await page.goto('/test-de-nivel')
  await page.getByRole('button', { name: 'Empezar test' }).click()
  await expect(page.locator('input[name="placement-answer"]').first()).toBeVisible({ timeout: 8000 })
  await capture(page, 'placement', '/test-de-nivel', desktop, 'question')

  for (let step = 0; step < 20; step += 1) {
    if (await page.locator('.placement-test-result').isVisible().catch(() => false)) break
    const firstOption = page.locator('input[name="placement-answer"]').first()
    await expect(firstOption).toBeVisible({ timeout: 8000 })
    await firstOption.check()
    await page.getByRole('button', { name: /Confirmar respuesta|Ver mi resultado/ }).click()
    await page.waitForTimeout(120)
  }
  await expect(page.locator('.placement-test-result')).toBeVisible({ timeout: 10_000 })
  await capture(page, 'placement', '/test-de-nivel', desktop, 'result')
  await capture(page, 'placement', '/test-de-nivel', mobile, 'result')
})

test('18A · Campus Alumno completo', async ({ page }) => {
  await login(page, requiredEnv('E2E_STUDENT_EMAIL'), requiredEnv('E2E_STUDENT_PASSWORD'), '/alumno')
  const routes = [
    '/alumno',
    '/alumno/clases',
    '/alumno/tareas',
    '/alumno/material',
    '/alumno/nivel',
    '/alumno/avisos',
    '/alumno/archivos',
    '/alumno/perfil',
  ]
  await captureRouteMatrix(page, 'student', routes, [desktop, mobile])
  await gotoAndCapture(page, 'student', '/alumno', tabletWide)
  await gotoAndCapture(page, 'student', '/alumno', tablet)
  await gotoAndCapture(page, 'student', '/alumno/clases', tablet)

  await page.goto('/alumno')
  const classroomHref = await page.locator('.campus-online-entry').first().getAttribute('href').catch(() => null)
  if (classroomHref) {
    await gotoAndCapture(page, 'student', classroomHref, desktop)
    await gotoAndCapture(page, 'student', classroomHref, mobile)
  } else {
    skipped('student', '/alumno/aula/:classId', '1440/390', 'No online classroom entry was available in the E2E seed.')
  }
})

test('18A · Portal Profesor completo', async ({ page }) => {
  await login(page, requiredEnv('E2E_TEACHER_EMAIL'), requiredEnv('E2E_TEACHER_PASSWORD'), '/profesor')
  const routes = [
    '/profesor',
    '/profesor/alumnos',
    '/profesor/niveles',
    '/profesor/clases',
    '/profesor/agenda',
    '/profesor/material',
    '/profesor/tareas',
    '/profesor/correcciones',
    '/profesor/perfil',
  ]
  await captureRouteMatrix(page, 'teacher', routes, [desktop, mobile])
  await gotoAndCapture(page, 'teacher', '/profesor', tabletWide)
  await gotoAndCapture(page, 'teacher', '/profesor', tablet)
  await gotoAndCapture(page, 'teacher', '/profesor/clases', tablet)
})

test('18A · Admin completo', async ({ page }) => {
  await login(page, requiredEnv('E2E_ADMIN_EMAIL'), requiredEnv('E2E_ADMIN_PASSWORD'), '/admin')
  const routes = [
    '/admin',
    '/admin/web',
    '/admin/web/sobre-nosotros',
    '/admin/blog',
    '/admin/multimedia',
    '/admin/contactos',
    '/admin/avisos',
    '/admin/alumnos',
    '/admin/profesores',
    '/admin/profesores/publicos',
    '/admin/cursos',
    '/admin/clases',
    '/admin/agenda',
    '/admin/pagos',
    '/admin/aula-online',
    '/admin/zoom',
    '/admin/test-de-nivel',
    '/admin/test-de-nivel/resultados',
    '/admin/tarifas',
    '/admin/configuracion',
    '/admin/sistema',
  ]
  await captureRouteMatrix(page, 'admin', routes, [desktop, mobile])
  await gotoAndCapture(page, 'admin', '/admin', tabletWide)
  await gotoAndCapture(page, 'admin', '/admin', tablet)
  await gotoAndCapture(page, 'admin', '/admin/alumnos', tablet)
  await gotoAndCapture(page, 'admin', '/admin/cursos', tablet)
  await gotoAndCapture(page, 'admin', '/admin/clases', tablet)

  await page.goto('/admin/alumnos')
  const studentHref = await page.locator('a[href^="/admin/alumnos/"]').first().getAttribute('href').catch(() => null)
  if (studentHref) {
    await gotoAndCapture(page, 'admin-detail', studentHref, desktop)
    await gotoAndCapture(page, 'admin-detail', studentHref, mobile)
  } else {
    skipped('admin-detail', '/admin/alumnos/:studentId', '1440/390', 'No student detail link was available in the E2E seed.')
  }

  await page.goto('/admin/profesores')
  const teacherHref = await page.locator('a[href^="/admin/profesores/"]:not([href="/admin/profesores/publicos"])').first().getAttribute('href').catch(() => null)
  if (teacherHref) {
    await gotoAndCapture(page, 'admin-detail', teacherHref, desktop)
    await gotoAndCapture(page, 'admin-detail', teacherHref, mobile)
  } else {
    skipped('admin-detail', '/admin/profesores/:teacherId', '1440/390', 'No teacher detail link was available in the E2E seed.')
  }
})
