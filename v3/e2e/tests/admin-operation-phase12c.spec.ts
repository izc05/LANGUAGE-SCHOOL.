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

test('12.3: Operación mantiene Contactos y Avisos utilizables en escritorio y móvil', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(page)

  const nav = page.getByRole('navigation', { name: 'Menú de Administrador' })
  await nav.getByRole('link', { name: 'Contactos' }).click()
  await expect(page).toHaveURL(/\/admin\/contactos$/)
  await expect(page.getByRole('heading', { name: 'Solicitudes de información' })).toBeVisible()

  const filters = page.locator('.contacts-admin-page .contact-filter')
  await expect(filters).toHaveCount(4)
  await expect(filters).toHaveText([/Todas/, /Nuevas/, /Contactadas/, /Cerradas/])

  const filterBarDisplay = await page.locator('.contacts-admin-page .contact-filter-bar').evaluate(
    (element) => getComputedStyle(element).display,
  )
  expect(filterBarDisplay).toBe('grid')

  await page.setViewportSize({ width: 390, height: 844 })
  const firstFilterHeight = await filters.first().evaluate((element) => element.getBoundingClientRect().height)
  expect(firstFilterHeight).toBeGreaterThanOrEqual(52)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)

  await page.setViewportSize({ width: 1440, height: 1000 })
  await nav.getByRole('link', { name: 'Avisos' }).click()
  await expect(page).toHaveURL(/\/admin\/avisos$/)
  await expect(page.getByRole('heading', { name: 'Centro de avisos' })).toBeVisible()
  await expect(page.getByLabel('Un alumno')).toBeVisible()
  await expect(page.getByLabel('Todos los alumnos activos')).toBeVisible()

  const operationGrid = page.locator('.notifications-admin-page .notification-admin-grid')
  expect(await operationGrid.evaluate((element) => getComputedStyle(element).display)).toBe('grid')

  const titleInput = page.getByLabel('Título')
  await titleInput.focus()
  const focusStyle = await titleInput.evaluate((element) => {
    const style = getComputedStyle(element)
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth }
  })
  expect(focusStyle.outlineStyle).not.toBe('none')
  expect(focusStyle.outlineWidth).not.toBe('0px')

  await page.setViewportSize({ width: 390, height: 844 })
  const mobileColumns = await operationGrid.evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(mobileColumns.trim().split(/\s+/)).toHaveLength(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  const navTransition = await nav.getByRole('link', { name: 'Avisos' }).evaluate(
    (element) => getComputedStyle(element).transitionDuration,
  )
  expect(navTransition.split(',').every((value) => durationInMs(value) <= 0.01)).toBe(true)
})
