import { expect, test, type Page } from '@playwright/test'
import { createPrivilegedUser } from '../helpers/privileged-users'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

const admin = { email: requiredEnv('E2E_ADMIN_EMAIL'), password: requiredEnv('E2E_ADMIN_PASSWORD') }

async function loginAdmin(page: Page) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(admin.email)
  await page.getByLabel('Contraseña').fill(admin.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

async function api(page: Page, path: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET', body?: Record<string, unknown>) {
  return page.evaluate(async ({ path, method, body }) => {
    const stored = JSON.parse(localStorage.getItem('pocketbase_auth') || '{}') as { token?: string }
    const response = await fetch(`http://127.0.0.1:8090${path}`, {
      method,
      headers: { ...(stored.token ? { Authorization: stored.token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    let payload: any = null
    try { payload = await response.json() } catch { payload = null }
    return { status: response.status, body: payload }
  }, { path, method, body })
}

function recordsPath(collection: string, filter: string, perPage = 1) {
  return `/api/collections/${collection}/records?perPage=${perPage}&filter=${encodeURIComponent(filter)}`
}

test('15B: matrículas finalizadas y canceladas son histórico terminal', async ({ page }) => {
  await loginAdmin(page)
  const suffix = `${Date.now()}`
  const cleanup: Array<() => Promise<void>> = []

  try {
    const groups = await api(page, recordsPath('groups', 'status = "ACTIVE"'))
    expect(groups.status).toBe(200)
    const group = groups.body.items[0]
    expect(group?.id).toBeTruthy()

    const student = await createPrivilegedUser<{ id: string }>(page.request, {
      email: `terminal-student-${suffix}@example.com`, password: 'TerminalStudentPass123!',
      name: 'Terminal', surname: 'Student', role: 'STUDENT', status: 'ACTIVE', phone: '',
    })
    expect(student.status).toBe(200)
    const studentId = student.body.id
    cleanup.push(async () => { await api(page, `/api/collections/users/records/${studentId}`, 'DELETE') })

    const profile = await api(page, '/api/collections/student_profiles/records', 'POST', {
      user: studentId, birth_date: '', guardian_name: '', guardian_phone: '', notes_private: '', active: true,
    })
    expect(profile.status).toBe(200)

    const first = await api(page, '/api/collections/enrollments/records', 'POST', {
      student: studentId, group: group.id, status: 'ACTIVE', joined_at: new Date().toISOString(), ended_at: '',
    })
    expect(first.status).toBe(200)
    cleanup.push(async () => { await api(page, `/api/collections/enrollments/records/${first.body.id}`, 'DELETE') })

    const finishedAt = new Date().toISOString()
    const finish = await api(page, `/api/collections/enrollments/records/${first.body.id}`, 'PATCH', { status: 'FINISHED', ended_at: finishedAt })
    expect(finish.status).toBe(200)
    expect(finish.body.status).toBe('FINISHED')

    const finishedToPaused = await api(page, `/api/collections/enrollments/records/${first.body.id}`, 'PATCH', { status: 'PAUSED', ended_at: '' })
    expect(finishedToPaused.status).toBe(400)
    const finishedAfterReject = await api(page, `/api/collections/enrollments/records/${first.body.id}`)
    expect(finishedAfterReject.status).toBe(200)
    expect(finishedAfterReject.body.status).toBe('FINISHED')
    expect(finishedAfterReject.body.ended_at).toBeTruthy()

    const second = await api(page, '/api/collections/enrollments/records', 'POST', {
      student: studentId, group: group.id, status: 'ACTIVE', joined_at: new Date().toISOString(), ended_at: '',
    })
    expect(second.status).toBe(200)
    cleanup.push(async () => { await api(page, `/api/collections/enrollments/records/${second.body.id}`, 'DELETE') })

    const cancel = await api(page, `/api/collections/enrollments/records/${second.body.id}`, 'PATCH', { status: 'CANCELLED', ended_at: new Date().toISOString() })
    expect(cancel.status).toBe(200)
    expect(cancel.body.status).toBe('CANCELLED')
    const cancelledToPaused = await api(page, `/api/collections/enrollments/records/${second.body.id}`, 'PATCH', { status: 'PAUSED', ended_at: '' })
    expect(cancelledToPaused.status).toBe(400)
    const cancelledAfterReject = await api(page, `/api/collections/enrollments/records/${second.body.id}`)
    expect(cancelledAfterReject.status).toBe(200)
    expect(cancelledAfterReject.body.status).toBe('CANCELLED')
    expect(cancelledAfterReject.body.ended_at).toBeTruthy()

    await page.goto('/admin/cursos')
    await expect(page.getByRole('heading', { name: 'Cursos, grupos y matrículas' })).toBeVisible()
    await page.locator('.admin-group-row').filter({ hasText: group.name }).click()
    const terminalRows = page.locator('.admin-enrollment-row').filter({ hasText: 'Terminal Student' })
    await expect(terminalRows).toHaveCount(2)
    await expect(terminalRows.getByText('Histórico cerrado')).toHaveCount(2)
    await expect(terminalRows.locator('select')).toHaveCount(0)
  } finally {
    for (const remove of cleanup.reverse()) {
      try { await remove() } catch { /* best-effort cleanup */ }
    }
  }
})
