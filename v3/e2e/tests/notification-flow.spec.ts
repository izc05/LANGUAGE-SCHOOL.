import { expect, test } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

async function login(page: import('@playwright/test').Page, email: string, password: string, expected: RegExp) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(expected)
}

test('ADMIN envía un aviso y el alumno lo recibe en su portal', async ({ page }) => {
  const title = 'E2E Aviso de academia'
  const body = 'La clase de prueba ha quedado confirmada para mañana.'

  await login(page, requiredEnv('E2E_ADMIN_EMAIL'), requiredEnv('E2E_ADMIN_PASSWORD'), /\/admin$/)
  const adminNav = page.getByRole('navigation', { name: 'Menú de Administrador' })
  await adminNav.getByRole('link', { name: 'Avisos' }).click()
  await expect(page).toHaveURL(/\/admin\/avisos$/)
  await expect(page.getByRole('heading', { name: 'Centro de avisos' })).toBeVisible()

  // Do not depend on recipient ordering: the Campus E2E dataset deliberately contains
  // another active STUDENT without enrollment to verify authorization boundaries.
  await page.getByRole('combobox', { name: 'Alumno', exact: true }).selectOption({ label: 'E2E Student' })
  await page.getByLabel('Título').fill(title)
  await page.getByLabel('Mensaje').fill(body)
  await page.getByRole('button', { name: 'Enviar aviso' }).click()
  await expect(page.getByText('Aviso enviado a 1 alumno.')).toBeVisible()
  await expect(page.getByText(title).first()).toBeVisible()

  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/acceso$/)

  await login(page, requiredEnv('E2E_STUDENT_EMAIL'), requiredEnv('E2E_STUDENT_PASSWORD'), /\/alumno$/)
  const studentNav = page.getByRole('navigation', { name: 'Menú de Alumno' })
  await studentNav.getByRole('link', { name: 'Avisos' }).click()
  await expect(page).toHaveURL(/\/alumno\/avisos$/)
  await expect(page.getByRole('heading', { name: 'Avisos', exact: true })).toBeVisible()
  await expect(page.getByText(title)).toBeVisible()
  await expect(page.getByText(body)).toBeVisible()
})

test('ADMIN envía un aviso y el profesor lo recibe en su portal', async ({ page }) => {
  const title = 'E2E Coordinación docente'
  const body = 'Recuerda revisar el material preparado para la próxima clase.'

  await login(page, requiredEnv('E2E_ADMIN_EMAIL'), requiredEnv('E2E_ADMIN_PASSWORD'), /\/admin$/)
  await page.goto('/admin/avisos')
  await page.getByRole('radio', { name: 'Profesorado', exact: true }).check()
  await page.getByRole('combobox', { name: 'Profesor', exact: true }).selectOption({ label: 'E2E Teacher' })
  await page.getByLabel('Título').fill(title)
  await page.getByLabel('Mensaje').fill(body)
  await page.getByRole('button', { name: 'Enviar aviso' }).click()
  await expect(page.getByText('Aviso enviado a 1 profesor.')).toBeVisible()
  await expect(page.getByText(title).first()).toBeVisible()

  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/acceso$/)

  await login(page, requiredEnv('E2E_TEACHER_EMAIL'), requiredEnv('E2E_TEACHER_PASSWORD'), /\/profesor$/)
  const teacherNav = page.getByRole('navigation', { name: 'Menú de Profesor' })
  await teacherNav.getByRole('link', { name: 'Avisos' }).click()
  await expect(page).toHaveURL(/\/profesor\/avisos$/)
  await expect(page.getByRole('heading', { name: 'Avisos', exact: true })).toBeVisible()
  await expect(page.getByText(title)).toBeVisible()
  await expect(page.getByText(body)).toBeVisible()
})
