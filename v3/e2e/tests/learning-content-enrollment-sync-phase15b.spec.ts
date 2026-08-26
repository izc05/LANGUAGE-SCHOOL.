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

async function adminRequest(page: Page, path: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET', body?: Record<string, unknown>) {
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

async function tokenRequest(page: Page, token: string, path: string, method: 'GET' | 'POST' = 'GET', body?: Record<string, unknown>) {
  return page.evaluate(async ({ token, path, method, body }) => {
    const response = await fetch(`http://127.0.0.1:8090${path}`, {
      method, headers: { Authorization: token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined,
    })
    let payload: any = null
    try { payload = await response.json() } catch { payload = null }
    return { status: response.status, body: payload }
  }, { token, path, method, body })
}

async function createGroupMaterial(page: Page, teacher: string, group: string, title: string) {
  return page.evaluate(async ({ teacher, group, title }) => {
    const stored = JSON.parse(localStorage.getItem('pocketbase_auth') || '{}') as { token?: string }
    const data = new FormData()
    data.set('title', title); data.set('description', 'Material E2E de sincronización'); data.set('teacher', teacher); data.set('group', group)
    data.set('visibility', 'GROUP'); data.set('published', 'true'); data.set('file', new File(['%PDF-1.4\n% E2E sync\n'], 'sync.pdf', { type: 'application/pdf' }))
    const response = await fetch('http://127.0.0.1:8090/api/collections/materials/records', { method: 'POST', headers: stored.token ? { Authorization: stored.token } : {}, body: data })
    let payload: any = null
    try { payload = await response.json() } catch { payload = null }
    return { status: response.status, body: payload }
  }, { teacher, group, title })
}

function recordsPath(collection: string, filter: string, perPage = 20) {
  return `/api/collections/${collection}/records?perPage=${perPage}&filter=${encodeURIComponent(filter)}`
}

test('15B sync: el cambio de grupo actualiza contenido sin borrar histórico entregado', async ({ page }) => {
  await loginAdmin(page)
  const suffix = `${Date.now()}`
  const cleanup: Array<() => Promise<void>> = []

  try {
    const courses = await adminRequest(page, recordsPath('courses', 'status = "ACTIVE"', 1))
    const groups = await adminRequest(page, recordsPath('groups', 'status = "ACTIVE"', 1))
    const course = courses.body.items[0]
    const teacherId = groups.body.items[0]?.teacher
    expect(course?.id).toBeTruthy()
    expect(teacherId).toBeTruthy()

    const email = `learning-sync-${suffix}@example.com`
    const password = 'LearningSyncPass123!'
    const student = await createPrivilegedUser<{ id: string }>(page.request, {
      email, password, name: 'Learning', surname: 'Sync', role: 'STUDENT', status: 'ACTIVE', phone: '',
    })
    expect(student.status).toBe(200)
    const studentId = student.body.id
    cleanup.push(async () => { await adminRequest(page, `/api/collections/users/records/${studentId}`, 'DELETE') })

    const profile = await adminRequest(page, '/api/collections/student_profiles/records', 'POST', {
      user: studentId, birth_date: '', guardian_name: '', guardian_phone: '', notes_private: '', active: true,
    })
    expect(profile.status).toBe(200)

    const makeGroup = (name: string) => adminRequest(page, '/api/collections/groups/records', 'POST', {
      name, course: course.id, teacher: teacherId, academic_year: '2098/99', schedule_text: 'E2E sync', capacity: 4,
      target_level: 'MIXED', default_delivery_mode: 'IN_PERSON', status: 'ACTIVE',
    })
    const groupAResult = await makeGroup(`Learning A ${suffix}`)
    const groupBResult = await makeGroup(`Learning B ${suffix}`)
    expect(groupAResult.status).toBe(200); expect(groupBResult.status).toBe(200)
    const groupA = groupAResult.body.id; const groupB = groupBResult.body.id
    cleanup.push(async () => { await adminRequest(page, `/api/collections/groups/records/${groupA}`, 'DELETE') })
    cleanup.push(async () => { await adminRequest(page, `/api/collections/groups/records/${groupB}`, 'DELETE') })

    const enrollment = await adminRequest(page, '/api/collections/enrollments/records', 'POST', {
      student: studentId, group: groupA, status: 'ACTIVE', joined_at: new Date().toISOString(), ended_at: '',
    })
    expect(enrollment.status).toBe(200)

    const makeAssignment = (group: string, title: string) => adminRequest(page, '/api/collections/assignments/records', 'POST', {
      title, description: title, teacher: teacherId, group, due_at: '2099-02-01T18:00:00.000Z', status: 'PUBLISHED',
    })
    const submittedOld = await makeAssignment(groupA, `Entregada A ${suffix}`)
    const unsubmittedOld = await makeAssignment(groupA, `Pendiente A ${suffix}`)
    const newGroupAssignment = await makeAssignment(groupB, `Tarea B ${suffix}`)
    expect(submittedOld.status).toBe(200); expect(unsubmittedOld.status).toBe(200); expect(newGroupAssignment.status).toBe(200)

    const oldMaterial = await createGroupMaterial(page, teacherId, groupA, `Material A ${suffix}`)
    const newMaterial = await createGroupMaterial(page, teacherId, groupB, `Material B ${suffix}`)
    expect(oldMaterial.status).toBe(200); expect(newMaterial.status).toBe(200)

    const auth = await page.evaluate(async ({ email, password }) => {
      const response = await fetch('http://127.0.0.1:8090/api/collections/users/auth-with-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identity: email, password }),
      })
      return response.json()
    }, { email, password })
    expect(auth.token).toBeTruthy()
    const token = auth.token as string

    expect((await tokenRequest(page, token, recordsPath('materials', `id = "${oldMaterial.body.id}"`, 1))).body.totalItems).toBe(1)
    expect((await tokenRequest(page, token, recordsPath('materials', `id = "${newMaterial.body.id}"`, 1))).body.totalItems).toBe(0)
    expect((await tokenRequest(page, token, recordsPath('assignments', `id = "${unsubmittedOld.body.id}"`, 1))).body.totalItems).toBe(1)
    expect((await tokenRequest(page, token, recordsPath('assignments', `id = "${newGroupAssignment.body.id}"`, 1))).body.totalItems).toBe(0)

    const submission = await tokenRequest(page, token, '/api/collections/assignment_submissions/records', 'POST', {
      assignment: submittedOld.body.id, student: studentId, text_answer: 'Entrega histórica antes del cambio de grupo.', submitted_at: new Date().toISOString(), status: 'SUBMITTED',
    })
    expect(submission.status).toBe(200)
    const move = await adminRequest(page, '/api/language-school/admin/academic/enrollments/move', 'POST', { studentId, targetGroupId: groupB })
    expect(move.status).toBe(200)

    expect((await tokenRequest(page, token, recordsPath('materials', `id = "${oldMaterial.body.id}"`, 1))).body.totalItems).toBe(0)
    expect((await tokenRequest(page, token, recordsPath('materials', `id = "${newMaterial.body.id}"`, 1))).body.totalItems).toBe(1)
    expect((await tokenRequest(page, token, recordsPath('assignments', `id = "${unsubmittedOld.body.id}"`, 1))).body.totalItems).toBe(0)
    expect((await tokenRequest(page, token, recordsPath('assignments', `id = "${newGroupAssignment.body.id}"`, 1))).body.totalItems).toBe(1)
    expect((await tokenRequest(page, token, recordsPath('assignments', `id = "${submittedOld.body.id}"`, 1))).body.totalItems).toBe(1)
    expect((await tokenRequest(page, token, recordsPath('assignment_submissions', `id = "${submission.body.id}"`, 1))).body.totalItems).toBe(1)
  } finally {
    for (const remove of cleanup.reverse()) {
      try { await remove() } catch { /* best-effort cleanup */ }
    }
  }
})
