import { expect, test, type Page } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

const student = {
  email: requiredEnv('E2E_STUDENT_EMAIL'),
  password: requiredEnv('E2E_STUDENT_PASSWORD'),
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

test('10.5: Mi nivel separa referencia, estimación automática y validación académica', async ({ page }) => {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(student.email)
  await page.getByLabel('Contraseña').fill(student.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/alumno$/)

  await page.getByRole('navigation', { name: 'Menú de Alumno' }).getByRole('link', { name: 'Mi nivel' }).click()
  await expect(page).toHaveURL(/\/alumno\/nivel$/)
  await expect(page.getByRole('heading', { name: /Tu evolución en inglés/ })).toBeVisible()

  const reference = page.locator('.student-level-reference10')
  await expect(reference).toBeVisible()
  await expect(reference.getByText('REFERENCIA ACTUAL', { exact: true })).toBeVisible()
  await expect(reference.getByText('ÚLTIMO TEST', { exact: true })).toBeVisible()
  await expect(reference.getByText('VALIDADO POR LA ACADEMIA', { exact: true })).toBeVisible()
  await expect(page.getByText('NIVEL DEL CURSO', { exact: true })).toHaveCount(0)

  const source = (await page.locator('.student-level-current10 small').textContent())?.trim() || ''
  expect(['Nivel validado por la academia', 'Última estimación automática', 'Pendiente de evaluación']).toContain(source)

  await expect(page.getByText('30 preguntas', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('A1–C2', { exact: true })).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoHorizontalOverflow(page)
})
