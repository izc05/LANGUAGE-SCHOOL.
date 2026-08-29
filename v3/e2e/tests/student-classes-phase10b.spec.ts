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

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

test('10.2: Mis clases prioriza la próxima sesión y mantiene el aula interna protegida', async ({ page }) => {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(student.email)
  await page.getByLabel('Contraseña').fill(student.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/alumno$/)

  await page.getByRole('navigation', { name: 'Menú de Alumno' }).getByRole('link', { name: 'Mis clases' }).click()
  await expect(page).toHaveURL(/\/alumno\/clases$/)
  await expect(page.getByRole('heading', { name: 'Mis clases' })).toBeVisible()

  const nextSession = page.locator('.student-next-session')
  await expect(nextSession).toBeVisible()
  await expect(nextSession.getByText('PRÓXIMA SESIÓN', { exact: true })).toBeVisible()
  await expect(nextSession.getByRole('heading', { name: 'E2E Speaking class' })).toBeVisible()
  await expect(nextSession.locator('a[href^="http"]')).toHaveCount(0)

  const classroomLink = nextSession.getByRole('link', { name: /Entrar en clase/ })
  await expect(classroomLink).toHaveAttribute('href', /\/alumno\/aula\//)
  await classroomLink.click()

  await expect(page).toHaveURL(/\/alumno\/aula\//)
  await expect(page.getByText('AULA ONLINE', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'E2E Speaking class', level: 1 })).toBeVisible()
  await expect(page.locator('.student-online-session10')).toBeVisible()
  await expect(page.getByText('Acceso protegido', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Entrar en clase' })).toBeEnabled()
  await expect(page.locator('script[data-language-school-zoom-src]')).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Abrir en otra pestaña/ })).toHaveAttribute('href', /^https:\/\//)

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoHorizontalOverflow(page)
  await page.getByRole('link', { name: /Volver a Mis clases/ }).click()
  await expect(page).toHaveURL(/\/alumno\/clases$/)
  await expectNoHorizontalOverflow(page)
})
