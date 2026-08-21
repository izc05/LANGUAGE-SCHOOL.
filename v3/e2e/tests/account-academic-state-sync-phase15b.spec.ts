import { expect, test, type Page } from '@playwright/test'

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

test('15B sync: una cuenta no puede romper relaciones académicas activas', async ({ page }) => {
  await loginAdmin(page)
  const suffix = `${Date.now()}`
  const cleanup: Array<() => Promise<void>> = []

  try {
    const courseResult = await api(page, recordsPath('courses', 'status = "ACTIVE"'))
    const groupResult = await api(page, recordsPath('groups', 'status = "ACTIVE"'))
    const course = courseResult.body.items[0]
    const originalTeacherId = groupResult.body.items[0]?.teacher
    expect(course?.id).toBeTruthy()
    expect(originalTeacherId).toBeTruthy()

    const teacher = await api(page, '/api/collections/users/records', 'POST', {
      email: `state-teacher-${suffix}@example.com`, password: 'StateTeacherPass123!', passwordConfirm: 'StateTeacherPass123!',
      name: 'State', surname: 'Teacher', role: 'TEACHER', status: 'ACTIVE', phone: '',
    })
    expect(teacher.status).toBe(200)
    const teacherId = teacher.body.id
    cleanup.push(async () => { await api(page, `/api/collections/users/records/${teacherId}`, 'DELETE') })

    const teacherProfile = await api(page, '/api/collections/teacher_profiles/records', 'POST', {
      user: teacherId, display_name: 'State Teacher', headline: '', bio: '', specialties: [], public_profile: false, active: true,
    })
    expect(teacherProfile.status).toBe(200)

    const teacherGroup = await api(page, '/api/collections/groups/records', 'POST', {
      name: `State Teacher Group ${suffix}`, course: course.id, teacher: teacherId, academic_year: '2098/99', schedule_text: '', capacity: 4,
      target_level: 'MIXED', default_delivery_mode: 'IN_PERSON', status: 'ACTIVE',
    })
    expect(teacherGroup.status).toBe(200)
    const teacherGroupId = teacherGroup.body.id
    cleanup.push(async () => { await api(page, `/api/collections/groups/records/${teacherGroupId}`, 'DELETE') })

    expect((await api(page, `/api/collections/users/records/${teacherId}`, 'PATCH', { role: 'STUDENT' })).status).toBe(404)
    expect((await api(page, `/api/collections/users/records/${teacherId}`, 'PATCH', { status: 'INACTIVE' })).status).toBe(400)

    expect((await api(page, `/api/language-school/admin/academic/groups/${teacherGroupId}/update`, 'POST', {
      patch: { teacher: originalTeacherId },
      reassignFutureScheduledClasses: false,
    })).status).toBe(200)
    expect((await api(page, `/api/collections/users/records/${teacherId}`, 'PATCH', { status: 'INACTIVE' })).status).toBe(200)
    const inactiveTeacherProfile = await api(page, `/api/collections/teacher_profiles/records/${teacherProfile.body.id}`)
    expect(inactiveTeacherProfile.body.active).toBe(false)

    const student = await api(page, '/api/collections/users/records', 'POST', {
      email: `state-student-${suffix}@example.com`, password: 'StateStudentPass123!', passwordConfirm: 'StateStudentPass123!',
      name: 'State', surname: 'Student', role: 'STUDENT', status: 'ACTIVE', phone: '',
    })
    expect(student.status).toBe(200)
    const studentId = student.body.id
    cleanup.push(async () => { await api(page, `/api/collections/users/records/${studentId}`, 'DELETE') })

    const studentProfile = await api(page, '/api/collections/student_profiles/records', 'POST', {
      user: studentId, birth_date: '', guardian_name: '', guardian_phone: '', notes_private: '', active: true,
    })
    expect(studentProfile.status).toBe(200)

    const studentGroup = await api(page, '/api/collections/groups/records', 'POST', {
      name: `State Student Group ${suffix}`, course: course.id, teacher: originalTeacherId, academic_year: '2098/99', schedule_text: '', capacity: 4,
      target_level: 'MIXED', default_delivery_mode: 'IN_PERSON', status: 'ACTIVE',
    })
    expect(studentGroup.status).toBe(200)
    const studentGroupId = studentGroup.body.id
    cleanup.push(async () => { await api(page, `/api/collections/groups/records/${studentGroupId}`, 'DELETE') })

    const enrollment = await api(page, '/api/collections/enrollments/records', 'POST', {
      student: studentId, group: studentGroupId, status: 'ACTIVE', joined_at: new Date().toISOString(), ended_at: '',
    })
    expect(enrollment.status).toBe(200)

    expect((await api(page, `/api/collections/users/records/${studentId}`, 'PATCH', { status: 'INACTIVE' })).status).toBe(400)
    expect((await api(page, `/api/collections/enrollments/records/${enrollment.body.id}`, 'PATCH', {
      status: 'FINISHED', ended_at: new Date().toISOString(),
    })).status).toBe(200)
    expect((await api(page, `/api/collections/users/records/${studentId}`, 'PATCH', { status: 'INACTIVE' })).status).toBe(200)
    const inactiveStudentProfile = await api(page, `/api/collections/student_profiles/records/${studentProfile.body.id}`)
    expect(inactiveStudentProfile.body.active).toBe(false)
  } finally {
    for (const remove of cleanup.reverse()) {
      try { await remove() } catch { /* best-effort cleanup */ }
    }
  }
})