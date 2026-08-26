import { expect, test, type Page } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

async function login(page: Page) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(requiredEnv('E2E_TEACHER_EMAIL'))
  await page.getByLabel('Contraseña').fill(requiredEnv('E2E_TEACHER_PASSWORD'))
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/profesor$/)
}

test('11.8: perfil docente persiste datos editables y mantiene identidad protegida', async ({ page }) => {
  await login(page)
  await page.goto('/profesor/perfil')

  await expect(page.getByRole('heading', { name: 'Tu información personal', level: 2 })).toBeVisible()
  await expect(page.locator('.account-profile-teacher11')).toBeVisible()
  await expect(page.locator('.account-profile-heading-teacher11')).toBeVisible()
  await expect(page.getByText('Datos protegidos')).toBeVisible()

  const email = page.getByLabel('Email')
  await expect(email).toHaveValue(requiredEnv('E2E_TEACHER_EMAIL'))
  await expect(email).toHaveAttribute('readonly', '')

  const phone = `633${String(Date.now()).slice(-6)}`
  await page.getByLabel('Teléfono').fill(phone)
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.locator('.cms-notice.success-notice').filter({ hasText: 'Perfil actualizado correctamente.' })).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Teléfono')).toHaveValue(phone)
  await expect(page.getByLabel('Email')).toHaveValue(requiredEnv('E2E_TEACHER_EMAIL'))
  await expect(page.getByLabel('Email')).toHaveAttribute('readonly', '')

  await page.setViewportSize({ width: 390, height: 844 })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)

  const saveButton = page.getByRole('button', { name: 'Guardar cambios' })
  const box = await saveButton.boundingBox()
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(40)

  await page.goto('/admin')
  await expect(page).toHaveURL(/\/profesor$/)
})
