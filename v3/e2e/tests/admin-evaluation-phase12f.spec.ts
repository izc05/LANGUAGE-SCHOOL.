import { expect, test } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

function columnCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length
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

async function expectNoPageOverflow(page: import('@playwright/test').Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
}

test('12.6: Test de nivel y Resultados conservan trazabilidad con una interfaz responsive', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(page)

  await page.goto('/admin/test-de-nivel')
  await expect(page.getByRole('heading', { name: 'Test de nivel' })).toBeVisible()
  const placementPage = page.locator('.placement-admin-page')
  await expect(placementPage.locator('.placement-admin-new-version')).toBeVisible()
  await expect(placementPage.locator('.placement-listening-setup')).toBeVisible()
  await expect(placementPage.locator('.placement-admin-versions')).toBeVisible()
  await expect(placementPage.locator('.placement-version-list button').first()).toBeVisible()

  const desktopLayout = await placementPage.locator('.placement-admin-layout').evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns,
  )
  expect(columnCount(desktopLayout)).toBeGreaterThan(1)

  const versionButton = placementPage.locator('.placement-version-list button').first()
  await versionButton.focus()
  const versionFocus = await versionButton.evaluate((element) => {
    const style = getComputedStyle(element)
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth }
  })
  expect(versionFocus.outlineStyle).not.toBe('none')
  expect(versionFocus.outlineWidth).not.toBe('0px')

  await page.setViewportSize({ width: 820, height: 900 })
  await expectNoPageOverflow(page)
  const tabletLayout = await placementPage.locator('.placement-admin-layout').evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns,
  )
  expect(columnCount(tabletLayout)).toBe(1)

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoPageOverflow(page)
  const mobileVersions = await placementPage.locator('.placement-version-list').evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns,
  )
  expect(columnCount(mobileVersions)).toBe(1)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  const reducedTransition = await versionButton.evaluate((element) => getComputedStyle(element).transitionDuration)
  expect(reducedTransition.split(',').every((value) => durationInMs(value) <= 0.01)).toBe(true)

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/admin/test-de-nivel/resultados')
  await expect(page.getByRole('heading', { name: 'Resultados de nivel' })).toBeVisible()
  const resultsPage = page.locator('.placement-results-page')
  await expect(resultsPage.locator('.placement-results-metrics article')).toHaveCount(4)
  await expect(resultsPage.locator('.placement-results-students')).toBeVisible()
  await expect(resultsPage.locator('.placement-results-attempts')).toBeVisible()
  await expect(page.getByPlaceholder('Buscar alumno o nivel…')).toBeVisible()

  const resultMetricColumns = await resultsPage.locator('.placement-results-metrics').evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns,
  )
  expect(columnCount(resultMetricColumns)).toBe(4)

  const studentResult = resultsPage.locator('.placement-results-student-list article').first()
  if (await studentResult.count()) {
    await expect(studentResult.locator('.placement-result-level')).toBeVisible()
    await expect(studentResult.locator('.placement-result-evidence')).toContainText('Automático:')
    await expect(studentResult.locator('.placement-result-evidence')).toContainText('Speaking:')
    await expect(studentResult.locator('.placement-result-evidence')).toContainText('Validado:')
  }

  await page.setViewportSize({ width: 820, height: 900 })
  await expectNoPageOverflow(page)
  const tabletMetricColumns = await resultsPage.locator('.placement-results-metrics').evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns,
  )
  expect(columnCount(tabletMetricColumns)).toBe(2)

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoPageOverflow(page)
  const mobileMetricColumns = await resultsPage.locator('.placement-results-metrics').evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns,
  )
  expect(columnCount(mobileMetricColumns)).toBe(1)

  const search = page.getByPlaceholder('Buscar alumno o nivel…')
  const searchWidth = await search.evaluate((element) => element.getBoundingClientRect().width)
  expect(searchWidth).toBeLessThanOrEqual(390)
})
