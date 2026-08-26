import { expect, test } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

const student = {
  email: requiredEnv('E2E_STUDENT_EMAIL'),
  password: requiredEnv('E2E_STUDENT_PASSWORD'),
}

test('10.1: el inicio del alumno prioriza próxima acción y contexto académico', async ({ page }) => {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(student.email)
  await page.getByLabel('Contraseña').fill(student.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/alumno$/)

  await expect(page.getByRole('heading', { name: /Hoy, empieza por aquí/i })).toBeVisible()

  const context = page.locator('.campus10-context')
  await expect(context).toContainText('CURSO')
  await expect(context).toContainText('GRUPO')
  await expect(context).toContainText('NIVEL DEL CURSO')
  await expect(context.getByRole('link')).toHaveAttribute('href', '/alumno/nivel')

  await expect(page.getByRole('heading', { name: 'Lo que necesita tu atención' })).toBeVisible()
  const actions = page.locator('.campus10-action-grid')
  await expect(actions.getByRole('link', { name: /SIGUIENTE TAREA/i })).toHaveAttribute('href', '/alumno/tareas')
  await expect(actions.getByRole('link', { name: /MATERIAL RECIENTE/i })).toHaveAttribute('href', '/alumno/material')
  await expect(actions.getByRole('link', { name: /AVISOS/i })).toHaveAttribute('href', '/alumno/avisos')

  const nextClass = page.locator('.campus10-next-class')
  await expect(nextClass).toBeVisible()
  await expect(nextClass.locator('a[href^="http"]')).toHaveCount(0)
})
