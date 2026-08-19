import { expect, test } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
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

function columnCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length
}

test('12.5: Cursos, Clases, Aula online y Zoom forman un espacio académico coherente y responsive', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(page)

  await page.goto('/admin/cursos')
  await expect(page.getByRole('heading', { name: 'Cursos, grupos y matrículas' })).toBeVisible()
  const coursesPage = page.locator('.cms-page').filter({ has: page.locator('.course-admin-grid') })
  await expect(coursesPage.locator(':scope > .metric-grid article')).toHaveCount(4)
  await expect(coursesPage.locator('.course-admin-grid')).toBeVisible()
  await expect(coursesPage.locator('.groups-overview-panel')).toBeVisible()
  const courseMetricsColumns = await coursesPage.locator(':scope > .metric-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(columnCount(courseMetricsColumns)).toBe(4)

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoPageOverflow(page)
  const mobileCourseColumns = await coursesPage.locator('.course-admin-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(columnCount(mobileCourseColumns)).toBe(1)

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/admin/clases')
  await expect(page.getByRole('heading', { name: 'Agenda y asistencia global' })).toBeVisible()
  const classesPage = page.locator('.cms-page').filter({ has: page.locator('.admin-real-calendar') })
  await expect(classesPage.locator(':scope > .metric-grid article')).toHaveCount(4)
  await expect(classesPage.locator('.admin-real-calendar')).toBeVisible()
  await expect(classesPage.locator('.admin-class-attendance')).toBeVisible()
  const classMetricsColumns = await classesPage.locator(':scope > .metric-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(columnCount(classMetricsColumns)).toBe(4)

  const weekCalendar = classesPage.locator('.week-calendar')
  await expect(weekCalendar).toBeVisible()
  await expect(weekCalendar.locator('.calendar-day')).toHaveCount(7)
  const desktopCalendarColumns = await weekCalendar.evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(columnCount(desktopCalendarColumns)).toBe(7)

  await page.setViewportSize({ width: 820, height: 900 })
  await expectNoPageOverflow(page)
  const tabletCalendarColumns = await weekCalendar.evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(columnCount(tabletCalendarColumns)).toBe(2)

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoPageOverflow(page)
  const mobileCalendarColumns = await weekCalendar.evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(columnCount(mobileCalendarColumns)).toBe(1)

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/admin/aula-online')
  await expect(page.getByRole('heading', { name: 'Modalidad de las clases' })).toBeVisible()
  const deliveryPage = page.locator('.class-delivery-admin-page')
  await expect(deliveryPage.locator('.class-delivery-metrics article')).toHaveCount(3)
  await expect(deliveryPage.locator('.class-delivery-admin-grid')).toBeVisible()
  await expect(deliveryPage.locator('.class-delivery-list-panel')).toBeVisible()
  const deliveryMetricColumns = await deliveryPage.locator('.class-delivery-metrics').evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(columnCount(deliveryMetricColumns)).toBe(3)

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoPageOverflow(page)
  const mobileDeliveryColumns = await deliveryPage.locator('.class-delivery-admin-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(columnCount(mobileDeliveryColumns)).toBe(1)

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/admin/zoom')
  await expect(page.getByRole('heading', { name: 'Integración con Zoom' })).toBeVisible()
  const zoomPage = page.locator('.zoom-integration-page')
  await expect(zoomPage.locator('.zoom-capability-grid article')).toHaveCount(4)
  await expect(zoomPage.locator('.zoom-connection-card')).toBeVisible()
  await expect(zoomPage).toContainText('Los secretos no se muestran en el navegador')

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoPageOverflow(page)
  const mobileZoomColumns = await zoomPage.locator('.zoom-capability-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(columnCount(mobileZoomColumns)).toBe(1)
})