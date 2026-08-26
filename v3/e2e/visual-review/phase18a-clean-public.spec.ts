import { expect, test, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const INTRO_SESSION_KEY = 'language-school:intro-completed'
const COOKIE_STORAGE_KEY = 'language-school-cookie-consent-v1'
const outputRoot = path.resolve('visual-review-artifacts/phase18a/clean-public')
mkdirSync(outputRoot, { recursive: true })

type EvidenceRow = {
  route: string
  viewport: string
  file: string
  title: string
  scrollWidth: number
  clientWidth: number
  scrollHeight: number
  overflowX: number
  state: string
}

const evidence: EvidenceRow[] = []
const desktop = { width: 1440, height: 900 }
const tabletWide = { width: 1180, height: 900 }
const tablet = { width: 820, height: 900 }
const mobile = { width: 390, height: 844 }

function safeName(value: string) {
  return value.replace(/^\/+/, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'home'
}

function flushManifest() {
  writeFileSync(
    path.join(outputRoot, 'manifest.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), evidence }, null, 2),
    'utf8',
  )
}

async function gotoDom(page: Page, route: string) {
  await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 15_000 })
}

async function settle(page: Page) {
  await page.locator('.route-loading').waitFor({ state: 'hidden', timeout: 7000 }).catch(() => undefined)
  await page.waitForTimeout(300)
}

async function primeFullPage(page: Page) {
  await page.evaluate(async () => {
    const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
    const step = Math.max(700, Math.floor(window.innerHeight * 0.9))
    for (let y = 0; y <= maxScroll; y += step) {
      window.scrollTo(0, y)
      await sleep(30)
    }
    window.scrollTo(0, maxScroll)
    await sleep(60)
    window.scrollTo(0, 0)
    await sleep(90)
  })
}

async function capture(page: Page, route: string, viewport: { width: number; height: number }, state: string, fullPage = true) {
  await page.setViewportSize(viewport)
  await settle(page)
  if (fullPage) await primeFullPage(page)
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    title: document.title,
  }))
  const file = `${safeName(route)}-${state}-${viewport.width}.jpg`
  await page.screenshot({ path: path.join(outputRoot, file), fullPage, type: 'jpeg', quality: 72 })
  evidence.push({
    route,
    viewport: `${viewport.width}x${viewport.height}`,
    file,
    title: metrics.title,
    scrollWidth: metrics.scrollWidth,
    clientWidth: metrics.clientWidth,
    scrollHeight: metrics.scrollHeight,
    overflowX: Math.max(0, metrics.scrollWidth - metrics.clientWidth),
    state,
  })
  flushManifest()
}

async function rejectOptionalCookies(page: Page) {
  const hasStoredConsent = await page.evaluate((storageKey) => Boolean(localStorage.getItem(storageKey)), COOKIE_STORAGE_KEY).catch(() => false)
  if (hasStoredConsent) return

  const reject = page.getByRole('button', { name: 'Rechazar opcionales' })
  await reject.waitFor({ state: 'visible', timeout: 3000 }).catch(() => undefined)
  if (await reject.isVisible().catch(() => false)) {
    await reject.click()
    await expect(reject).toBeHidden({ timeout: 5000 })
  }
}

async function optionalHref(page: Page, selector: string): Promise<string | null> {
  const links = page.locator(selector)
  if (await links.count() === 0) return null
  return links.first().getAttribute('href', { timeout: 2000 }).catch(() => null)
}

async function prepareHomeWithFreshConsent(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport)
  await gotoDom(page, '/')
  await page.evaluate(({ introKey, cookieKey }) => {
    sessionStorage.setItem(introKey, 'true')
    localStorage.removeItem(cookieKey)
  }, { introKey: INTRO_SESSION_KEY, cookieKey: COOKIE_STORAGE_KEY })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15_000 })
  await expect(page.locator('.site-header')).toBeVisible({ timeout: 8000 })
  await expect(page.getByRole('button', { name: 'Rechazar opcionales' })).toBeVisible({ timeout: 8000 })
}

async function gotoClean(page: Page, route: string, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport)
  await gotoDom(page, route)
  await rejectOptionalCookies(page)
  await expect(page.locator('body')).toBeVisible()
  await capture(page, route, viewport, 'clean')
}

test.describe.configure({ mode: 'serial' })

test('18A clean · consentimiento y Home sin overlay', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })

  for (const viewport of [desktop, mobile]) {
    await prepareHomeWithFreshConsent(page, viewport)
    await capture(page, '/', viewport, 'cookie-consent', false)
    await rejectOptionalCookies(page)
    await capture(page, '/', viewport, 'clean-home')
  }
})

test('18A clean · páginas públicas desktop y móvil', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const routes = [
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

  for (const viewport of [desktop, mobile]) {
    for (const route of routes) await gotoClean(page, route, viewport)
  }
})

test('18A clean · tablet y detalles públicos dinámicos', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })

  for (const viewport of [tabletWide, tablet]) {
    for (const route of ['/', '/programas', '/test-de-nivel', '/acceso']) await gotoClean(page, route, viewport)
  }

  await page.setViewportSize(desktop)
  await gotoDom(page, '/programas')
  await rejectOptionalCookies(page)
  const courseHref = await optionalHref(page, 'a[href^="/programas/"]')
  if (courseHref) {
    await gotoClean(page, courseHref, desktop)
    await gotoClean(page, courseHref, mobile)
  }

  await gotoDom(page, '/blog')
  await rejectOptionalCookies(page)
  const postHref = await optionalHref(page, 'a[href^="/blog/"]')
  if (postHref) {
    await gotoClean(page, postHref, desktop)
    await gotoClean(page, postHref, mobile)
  }
})

test('18A clean · test de nivel pregunta y resultado sin overlay', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize(desktop)
  await gotoDom(page, '/test-de-nivel')
  await rejectOptionalCookies(page)
  await page.getByRole('button', { name: 'Empezar test' }).click()
  await expect(page.locator('input[name="placement-answer"]').first()).toBeVisible({ timeout: 8000 })
  await capture(page, '/test-de-nivel', desktop, 'question-clean')

  for (let step = 0; step < 20; step += 1) {
    if (await page.locator('.placement-test-result').isVisible().catch(() => false)) break
    const firstOption = page.locator('input[name="placement-answer"]').first()
    await expect(firstOption).toBeVisible({ timeout: 8000 })
    await firstOption.check()
    await page.getByRole('button', { name: /Confirmar respuesta|Ver mi resultado/ }).click()
    await page.waitForTimeout(120)
  }

  await expect(page.locator('.placement-test-result')).toBeVisible({ timeout: 10_000 })
  await capture(page, '/test-de-nivel', desktop, 'result-clean')
  await capture(page, '/test-de-nivel', mobile, 'result-clean')
})
