import { expect, test, type Page } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

async function login(page: Page, email: string, password: string, expected: RegExp) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(expected)
}

test('STUDENT actualiza teléfono y conserva email/rol protegidos', async ({ page }) => {
  await login(page, requiredEnv('E2E_STUDENT_EMAIL'), requiredEnv('E2E_STUDENT_PASSWORD'), /\/alumno$/)

  const nav = page.getByRole('navigation', { name: 'Menú de Alumno' })
  await nav.getByRole('link', { name: 'Mi perfil' }).click()
  await expect(page).toHaveURL(/\/alumno\/perfil$/)
  await expect(page.getByRole('heading', { name: 'Tu información personal' })).toBeVisible()

  const email = page.getByLabel('Email')
  await expect(email).toHaveValue(requiredEnv('E2E_STUDENT_EMAIL'))
  await expect(email).toHaveAttribute('readonly', '')

  await page.getByLabel('Teléfono').fill('622222222')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('Perfil actualizado correctamente.')).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Teléfono')).toHaveValue('622222222')
  await expect(page.getByLabel('Email')).toHaveValue(requiredEnv('E2E_STUDENT_EMAIL'))

  await page.goto('/admin')
  await expect(page).toHaveURL(/\/alumno$/)
})

test('TEACHER dispone de perfil propio y mantiene identidad protegida', async ({ page }) => {
  await login(page, requiredEnv('E2E_TEACHER_EMAIL'), requiredEnv('E2E_TEACHER_PASSWORD'), /\/profesor$/)

  const nav = page.getByRole('navigation', { name: 'Menú de Profesor' })
  await nav.getByRole('link', { name: 'Mi perfil' }).click()
  await expect(page).toHaveURL(/\/profesor\/perfil$/)
  await expect(page.getByRole('heading', { name: 'Tu información personal' })).toBeVisible()
  await expect(page.locator('.account-profile-teacher11')).toBeVisible()
  await expect(page.getByText('Datos protegidos')).toBeVisible()

  const email = page.getByLabel('Email')
  await expect(email).toHaveValue(requiredEnv('E2E_TEACHER_EMAIL'))
  await expect(email).toHaveAttribute('readonly', '')
})
