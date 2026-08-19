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

test('12.8: Configuración y Sistema cierran el Admin sin exponer secretos', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(page)

  await page.goto('/admin/configuracion')
  await expect(page.getByRole('heading', { name: 'Identidad y contacto' })).toBeVisible()
  const settingsPage = page.locator('.admin-settings-page').filter({ has: page.locator('.admin-settings-submit-row') })
  await expect(settingsPage.locator('.cms-form')).toHaveCount(4)
  await expect(settingsPage.getByText('Identidad de la academia')).toBeVisible()
  await expect(settingsPage.getByText('Canales públicos')).toBeVisible()
  await expect(settingsPage.getByText('Consentimiento y servicios externos')).toBeVisible()
  await expect(settingsPage.getByText('Identificación y textos públicos')).toBeVisible()
  const saveSettings = page.getByRole('button', { name: 'Guardar configuración' })
  await expect(saveSettings).toBeVisible()

  const settingsDesktopColumns = await settingsPage.locator('.admin-settings-grid').evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns,
  )
  expect(columnCount(settingsDesktopColumns)).toBe(2)

  await saveSettings.focus()
  const settingsFocus = await saveSettings.evaluate((element) => {
    const style = getComputedStyle(element)
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth }
  })
  expect(settingsFocus.outlineStyle).not.toBe('none')
  expect(settingsFocus.outlineWidth).not.toBe('0px')

  await page.setViewportSize({ width: 820, height: 900 })
  await expectNoPageOverflow(page)
  const settingsTabletColumns = await settingsPage.locator('.admin-settings-grid').evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns,
  )
  expect(columnCount(settingsTabletColumns)).toBe(1)

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoPageOverflow(page)
  await expect(saveSettings).toBeVisible()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const settingsTransition = await saveSettings.evaluate((element) => getComputedStyle(element).transitionDuration)
  expect(settingsTransition.split(',').every((value) => durationInMs(value) <= 0.01)).toBe(true)

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/admin/sistema')
  await expect(page.getByRole('heading', { name: 'Estado de la plataforma' })).toBeVisible()
  const systemPage = page.locator('.system-status-page')
  await expect(systemPage.locator('.system-status-card')).toHaveCount(6)
  await expect(systemPage.getByTestId('system-zoom-status')).toBeVisible()
  await expect(systemPage.getByTestId('system-placement-status')).toBeVisible()
  await expect(systemPage.getByText('No se muestran en esta pantalla')).toBeVisible()

  const bodyText = await page.locator('body').innerText()
  expect(bodyText).not.toMatch(/ZOOM_CLIENT_SECRET|ZOOM_CLIENT_ID|ZOOM_ACCOUNT_ID|TURNSTILE_SECRET_KEY/i)

  const systemDesktopColumns = await systemPage.locator('.system-status-grid').evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns,
  )
  expect(columnCount(systemDesktopColumns)).toBe(4)

  await page.setViewportSize({ width: 820, height: 900 })
  await expectNoPageOverflow(page)
  const systemTabletColumns = await systemPage.locator('.system-status-grid').evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns,
  )
  expect(columnCount(systemTabletColumns)).toBe(2)

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoPageOverflow(page)
  const systemMobileColumns = await systemPage.locator('.system-status-grid').evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns,
  )
  expect(columnCount(systemMobileColumns)).toBe(1)
  await expect(page.getByRole('button', { name: 'Volver a comprobar' })).toBeVisible()
})
