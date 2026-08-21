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

test('15B.3C.3: alta guiada completa cuenta, nivel, matrícula e invitación sin estado parcial', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(page)
  await page.goto('/admin/alumnos')

  await page.getByRole('button', { name: '+ Nuevo alumno' }).click()
  const wizard = page.locator('.student-onboarding-card')
  await expect(wizard.getByRole('heading', { name: 'Nuevo alumno' })).toBeVisible()

  await wizard.getByLabel('Nombre', { exact: true }).fill('Atomic')
  await wizard.getByLabel('Apellidos').fill('Student')
  await wizard.getByLabel('Email').fill('e2e-atomic-onboarding@example.com')
  await wizard.getByLabel('Teléfono', { exact: true }).fill('600123123')
  await wizard.getByRole('button', { name: /Continuar/ }).click()

  await expect(wizard.getByRole('heading', { name: '¿Cómo empezamos su evaluación?' })).toBeVisible()
  const initialLevelChoice = wizard.getByRole('radio', { name: /Nivel inicial de academia/ })
  await initialLevelChoice.focus()
  await page.keyboard.press('Space')
  await expect(initialLevelChoice).toBeChecked()
  await wizard.getByLabel('Nivel inicial').selectOption('B2')
  await wizard.getByLabel('Observación').fill('Entrevista inicial E2E · asignación pedagógica consciente')
  await wizard.getByRole('button', { name: /Continuar/ }).click()

  await expect(wizard.getByRole('heading', { name: 'Selecciona el programa' })).toBeVisible()
  await wizard.getByRole('button', { name: /E2E English B1/ }).click()
  await wizard.getByRole('button', { name: /Continuar/ }).click()

  await expect(wizard.getByRole('heading', { name: 'Grupo, horario y profesor' })).toBeVisible()
  const group = wizard.getByRole('button', { name: /E2E B1 Group/ })
  await expect(group).toContainText('E2E Teacher')
  await expect(group).toContainText('7 plazas')
  await group.click()
  await wizard.getByRole('button', { name: /Continuar/ }).click()

  await expect(wizard.getByRole('heading', { name: 'Confirma antes de crear la cuenta' })).toBeVisible()
  await expect(wizard).toContainText('E2E English B1')
  await expect(wizard).toContainText('E2E B1 Group')
  await expect(wizard).toContainText('E2E Teacher')
  await expect(wizard).toContainText('Nivel inicial de academia')
  const confirm = wizard.getByRole('button', { name: 'Confirmar alta e invitación' })
  const mismatch = wizard.getByRole('checkbox', { name: /Confirmar asignación con diferencia de nivel/ })
  await expect(mismatch).toBeVisible()
  await expect(confirm).toBeDisabled()
  await mismatch.focus()
  await page.keyboard.press('Space')
  await expect(mismatch).toBeChecked()
  await expect(confirm).toBeEnabled()
  await confirm.click()

  await expect(wizard.getByRole('heading', { name: 'Alumno matriculado e invitación preparada' })).toBeVisible()
  await expect(wizard).toContainText('Asignación pedagógica confirmada')
  await expect(wizard).toContainText('Pendiente de activación')
  await expect(wizard.getByLabel('Enlace de activación')).toHaveValue(/\/activar-cuenta\?token=/)

  await wizard.getByRole('link', { name: /Ver ficha del alumno/ }).click()
  await expect(page).toHaveURL(/\/admin\/alumnos\/[^/]+$/)
  const detail = page.locator('.phase14-profile-page')
  await expect(detail.getByRole('heading', { name: 'Matrícula y aprendizaje' })).toBeVisible()
  await expect(detail).toContainText('E2E English B1')
  await expect(detail).toContainText('E2E B1 Group')
  await expect(detail).toContainText('E2E Teacher')
  await expect(detail.getByText('B2', { exact: true })).toBeVisible()
  await expect(detail.getByRole('heading', { name: 'Cuenta e invitación' })).toBeVisible()
  await expect(detail).toContainText('Pendiente de activación')

  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
})
