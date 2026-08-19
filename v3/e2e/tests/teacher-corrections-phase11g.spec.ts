import { expect, test, type Page } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

const credentials = {
  teacher: { email: requiredEnv('E2E_TEACHER_EMAIL'), password: requiredEnv('E2E_TEACHER_PASSWORD') },
  student: { email: requiredEnv('E2E_STUDENT_EMAIL'), password: requiredEnv('E2E_STUDENT_PASSWORD') },
}

async function login(page: Page, role: 'teacher' | 'student') {
  const account = credentials[role]
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Contraseña').fill(account.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(role === 'teacher' ? /\/profesor$/ : /\/alumno$/)
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/acceso$/)
}

test('11.7: tarea, entrega y corrección completan el recorrido Profesor → Alumno → Profesor → Alumno', async ({ page }) => {
  const suffix = Date.now()
  const title = `E2E Corrección 11.7 ${suffix}`
  const instructions = 'Escribe una respuesta breve para validar el flujo completo de corrección.'
  const studentAnswer = `Respuesta del alumno ${suffix}`
  const feedback = `Buen trabajo en la actividad ${suffix}. Revisa únicamente el último detalle.`
  const grade = 'Muy bien · 9/10'

  await login(page, 'teacher')
  await page.goto('/profesor/tareas')
  await expect(page.getByRole('heading', { name: 'Tareas', level: 2 })).toBeVisible()

  const destination = page.getByLabel('Destino')
  await expect(destination).toBeEnabled()
  const groupOption = destination.locator('option').filter({ hasText: 'Grupo ·' }).first()
  const groupValue = await groupOption.getAttribute('value')
  expect(groupValue).toBeTruthy()
  await destination.selectOption(String(groupValue))

  await page.getByLabel('Título').fill(title)
  await page.getByLabel('Instrucciones').fill(instructions)
  await page.getByRole('button', { name: 'Publicar tarea' }).click()
  await expect(page.locator('.cms-notice.success-notice').filter({ hasText: 'Tarea publicada correctamente.' })).toBeVisible()
  await expect(page.locator('.teacher-assignment-record').filter({ hasText: title })).toBeVisible()
  await logout(page)

  await login(page, 'student')
  await page.goto('/alumno/tareas')
  const studentTask = page.locator('.student-task-list10 button').filter({ hasText: title })
  await expect(studentTask).toBeVisible()
  await studentTask.click()
  await expect(page.locator('.student-task-detail10')).toContainText(instructions)
  await page.getByLabel('Respuesta').fill(studentAnswer)
  await page.locator('.student-file-dropzone input[type="file"]').setInputFiles({
    name: 'entrega-fase11g.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% Language School teacher corrections E2E\n'),
  })
  await page.getByRole('button', { name: 'Entregar tarea' }).click()
  await expect(page.locator('.cms-notice.success-notice').filter({ hasText: 'Tarea entregada correctamente.' })).toBeVisible()
  await logout(page)

  await login(page, 'teacher')
  await page.goto('/profesor/correcciones')
  await expect(page.getByRole('heading', { name: 'Correcciones', level: 2 })).toBeVisible()

  const correction = page.locator('.teacher-correction-items > button').filter({ hasText: title })
  await expect(correction).toBeVisible()
  await expect(correction).toContainText('Pendiente')
  await correction.click()

  const detail = page.locator('.teacher-correction-detail')
  await expect(detail).toContainText(studentAnswer)
  await expect(detail.getByRole('button', { name: 'Abrir archivo entregado' })).toBeVisible()
  await page.getByLabel('Feedback').fill(feedback)
  await page.getByLabel('Calificación / valoración').fill(grade)
  await page.getByRole('button', { name: 'Marcar revisada' }).click()
  await expect(page.locator('.cms-notice.success-notice').filter({ hasText: 'Corrección guardada.' })).toBeVisible()
  await expect(detail.getByText('Revisada', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Devolver al alumno' }).click()
  await expect(page.locator('.cms-notice.success-notice').filter({ hasText: 'Entrega devuelta al alumno.' })).toBeVisible()
  await expect(detail.getByText('Devuelta', { exact: true })).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  const teacherOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(teacherOverflow).toBeLessThanOrEqual(1)
  await logout(page)

  await login(page, 'student')
  await page.goto('/alumno/tareas')
  const reviewedTask = page.locator('.student-task-list10 button').filter({ hasText: title })
  await expect(reviewedTask).toBeVisible()
  await reviewedTask.click()
  const feedbackBox = page.locator('.student-feedback-box10')
  await expect(feedbackBox).toContainText('Devuelta')
  await expect(feedbackBox).toContainText(feedback)
  await expect(feedbackBox).toContainText(grade)

  const studentOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(studentOverflow).toBeLessThanOrEqual(1)
})
