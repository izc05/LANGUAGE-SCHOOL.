import { expect, test, type Page } from '@playwright/test'

const PB_URL = 'http://127.0.0.1:8090'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

const credentials = {
  admin: { email: requiredEnv('E2E_ADMIN_EMAIL'), password: requiredEnv('E2E_ADMIN_PASSWORD') },
  student: { email: requiredEnv('E2E_STUDENT_EMAIL'), password: requiredEnv('E2E_STUDENT_PASSWORD') },
}

async function login(page: Page, email: string, password: string, expectedPath: RegExp) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(expectedPath)
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/acceso$/)
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

test('10.6: avisos explícitos, archivos privados y perfil del alumno mantienen sus contratos', async ({ page }, testInfo) => {
  const noticeTitle = `Phase 10 · Material disponible R${testInfo.retry}`
  const fileTitle = `phase-10-notes-r${testInfo.retry}.txt`

  await login(page, credentials.admin.email, credentials.admin.password, /\/admin$/)

  const notification = await page.evaluate(async ({ pbUrl, studentEmail, noticeTitle }) => {
    const auth = JSON.parse(localStorage.getItem('pocketbase_auth') || '{}') as { token?: string; record?: { id?: string } }
    const token = auth.token || ''
    const filter = encodeURIComponent(`email="${studentEmail}"`)
    const studentsResponse = await fetch(`${pbUrl}/api/collections/users/records?perPage=1&filter=${filter}`, {
      headers: { Authorization: token },
    })
    const students = await studentsResponse.json() as { items?: Array<{ id: string }> }
    const recipient = students.items?.[0]?.id || ''
    if (!recipient) return { status: 404, id: '' }

    const response = await fetch(`${pbUrl}/api/collections/notifications/records`, {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient,
        title: noticeTitle,
        body: 'Tienes nuevo material disponible en tu biblioteca del Campus.',
        type: 'MATERIAL',
        created_by: auth.record?.id || '',
      }),
    })
    const payload = await response.json().catch(() => ({})) as { id?: string }
    return { status: response.status, id: payload.id || '' }
  }, { pbUrl: PB_URL, studentEmail: credentials.student.email, noticeTitle })

  expect(notification.status).toBe(200)
  expect(notification.id).toBeTruthy()
  await logout(page)

  await login(page, credentials.student.email, credentials.student.password, /\/alumno$/)
  const nav = page.getByRole('navigation', { name: 'Menú de Alumno' })

  await nav.getByRole('link', { name: 'Avisos' }).click()
  await expect(page).toHaveURL(/\/alumno\/avisos$/)
  const notice = page.locator('.student-notice-list10 article').filter({ hasText: noticeTitle }).first()
  await expect(notice).toBeVisible()
  await expect(notice.getByText('Nuevo', { exact: true })).toBeVisible()
  await expect(notice.getByRole('link', { name: /Abrir Material/ })).toHaveAttribute('href', '/alumno/material')
  await expect(notice.getByRole('button', { name: 'Marcar como leído' })).toBeVisible()
  await notice.getByRole('button', { name: 'Marcar como leído' }).click()
  await expect(notice.getByText('Leído', { exact: true })).toBeVisible()
  await expect(notice.getByRole('button', { name: 'Marcar como leído' })).toHaveCount(0)

  await nav.getByRole('link', { name: 'Mis archivos' }).click()
  await expect(page).toHaveURL(/\/alumno\/archivos$/)
  await expect(page.locator('.student-files-overview10')).toBeVisible()
  const upload = page.locator('.student-upload-panel10')
  await upload.locator('input[type="file"]').setInputFiles({ name: fileTitle, mimeType: 'text/plain', buffer: Buffer.from('Phase 10 private student file') })
  await upload.getByLabel('Categoría').selectOption('HOMEWORK')
  await upload.getByLabel('Descripción').fill('Notas privadas de la fase 10.')
  await upload.getByRole('button', { name: 'Guardar en mi espacio' }).click()
  await expect(page.getByText('Archivo guardado correctamente en tu espacio privado.')).toBeVisible()
  const privateFile = page.locator('.student-private-file-list10 article').filter({ hasText: fileTitle }).first()
  await expect(privateFile).toBeVisible()
  await expect(privateFile).toContainText('Tarea')
  await expect(privateFile).not.toContainText('HOMEWORK')

  await nav.getByRole('link', { name: 'Mi perfil' }).click()
  await expect(page).toHaveURL(/\/alumno\/perfil$/)
  await expect(page.locator('.account-profile-student10')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tu información personal' })).toBeVisible()
  await expect(page.getByLabel('Email')).toHaveAttribute('readonly', '')
  await expect(page.getByText('Datos protegidos', { exact: true })).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoHorizontalOverflow(page)
})
