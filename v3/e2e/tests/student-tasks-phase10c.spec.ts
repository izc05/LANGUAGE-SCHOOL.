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

test('10.3: Tareas prioriza acción, seguimiento y correcciones sin romper estados vacíos', async ({ page }) => {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(student.email)
  await page.getByLabel('Contraseña').fill(student.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/alumno$/)

  await page.getByRole('navigation', { name: 'Menú de Alumno' }).getByRole('link', { name: 'Tareas' }).click()
  await expect(page).toHaveURL(/\/alumno\/tareas$/)
  await expect(page.getByRole('heading', { name: 'Tareas y correcciones' })).toBeVisible()

  const overview = page.locator('.student-task-overview10')
  await expect(overview).toBeVisible()
  await expect(overview.getByText('POR HACER / REVISAR', { exact: true })).toBeVisible()
  await expect(overview.getByText('EN REVISIÓN', { exact: true })).toBeVisible()
  await expect(overview.getByText('CORREGIDAS', { exact: true })).toBeVisible()

  const taskButtons = page.locator('.student-task-list10 > button')
  if (await taskButtons.count()) {
    await expect(taskButtons.first()).toBeVisible()
    await expect(page.locator('.student-task-detail10 h3')).toBeVisible()
  } else {
    await expect(page.getByText('Todo al día', { exact: true })).toBeVisible()
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoHorizontalOverflow(page)
})
