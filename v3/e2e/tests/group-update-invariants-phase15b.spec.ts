import { expect, test, type Page } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

const admin = {
  email: requiredEnv('E2E_ADMIN_EMAIL'),
  password: requiredEnv('E2E_ADMIN_PASSWORD'),
}

async function loginAdmin(page: Page) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(admin.email)
  await page.getByLabel('Contraseña').fill(admin.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

async function api(
  page: Page,
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: Record<string, unknown>,
) {
  return page.evaluate(async ({ path, method, body }) => {
    const stored = JSON.parse(localStorage.getItem('pocketbase_auth') || '{}') as { token?: string }
    const response = await fetch(`http://127.0.0.1:8090${path}`, {
      method,
      headers: {
        ...(stored.token ? { Authorization: stored.token } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    let payload: any = null
    try { payload = await response.json() } catch { payload = null }
    return { status: response.status, body: payload }
  }, { path, method, body })
}

test('15B: Grupo/Aula mantiene capacidad y dependencias activas en cualquier PATCH', async ({ page }) => {
  await loginAdmin(page)
  const suffix = `${Date.now()}`
  const cleanup: Array<() => Promise<void>> = []

  try {
    const course = await api(page, '/api/collections/courses/records', 'POST', {
      title: `Invariant Course ${suffix}`,
      slug: `invariant-course-${suffix}`,
      level: 'B1',
      description: 'Group invariant E2E',
      status: 'ACTIVE',
      public_visible: false,
    })
    expect(course.status).toBe(200)
    const courseId = course.body.id
    cleanup.push(async () => { await api(page, `/api/collections/courses/records/${courseId}`, 'DELETE') })

    const teacher = await api(page, '/api/collections/users/records', 'POST', {
      email: `group-invariant-teacher-${suffix}@example.com`,
      password: 'GroupInvariantTeacher123!',
      passwordConfirm: 'GroupInvariantTeacher123!',
      name: 'Invariant', surname: 'Teacher', role: 'TEACHER', status: 'ACTIVE', phone: '',
    })
    expect(teacher.status).toBe(200)
    const teacherId = teacher.body.id
    cleanup.push(async () => { await api(page, `/api/collections/users/records/${teacherId}`, 'DELETE') })

    const students: string[] = []
    for (const index of [1, 2]) {
      const student = await api(page, '/api/collections/users/records', 'POST', {
        email: `group-invariant-student-${index}-${suffix}@example.com`,
        password: 'GroupInvariantStudent123!',
        passwordConfirm: 'GroupInvariantStudent123!',
        name: `Invariant ${index}`, surname: 'Student', role: 'STUDENT', status: 'ACTIVE', phone: '',
      })
      expect(student.status).toBe(200)
      students.push(student.body.id)
      cleanup.push(async () => { await api(page, `/api/collections/users/records/${student.body.id}`, 'DELETE') })
    }

    const group = await api(page, '/api/collections/groups/records', 'POST', {
      name: `Invariant Group ${suffix}`,
      course: courseId,
      teacher: teacherId,
      academic_year: '2026/27',
      schedule_text: 'Martes y jueves · 18:00',
      capacity: 2,
      status: 'ACTIVE',
    })
    expect(group.status).toBe(200)
    const groupId = group.body.id
    cleanup.push(async () => { await api(page, `/api/collections/groups/records/${groupId}`, 'DELETE') })

    const enrollmentIds: string[] = []
    for (const studentId of students) {
      const enrollment = await api(page, '/api/collections/enrollments/records', 'POST', {
        student: studentId,
        group: groupId,
        status: 'ACTIVE',
        joined_at: new Date().toISOString(),
        ended_at: '',
      })
      expect(enrollment.status).toBe(200)
      enrollmentIds.push(enrollment.body.id)
      cleanup.push(async () => { await api(page, `/api/collections/enrollments/records/${enrollment.body.id}`, 'DELETE') })
    }

    const capacityBelowOccupancy = await api(page, `/api/collections/groups/records/${groupId}`, 'PATCH', { capacity: 1 })
    expect(capacityBelowOccupancy.status).toBe(400)

    const archiveActiveCourse = await api(page, `/api/collections/courses/records/${courseId}`, 'PATCH', { status: 'ARCHIVED' })
    expect(archiveActiveCourse.status).toBe(400)

    const pauseGroup = await api(page, `/api/collections/groups/records/${groupId}`, 'PATCH', { status: 'PAUSED' })
    expect(pauseGroup.status).toBe(200)
    expect(pauseGroup.body.status).toBe('PAUSED')

    const archivePausedCourse = await api(page, `/api/collections/courses/records/${courseId}`, 'PATCH', { status: 'ARCHIVED' })
    expect(archivePausedCourse.status).toBe(200)

    const reactivateWithArchivedCourse = await api(page, `/api/collections/groups/records/${groupId}`, 'PATCH', { status: 'ACTIVE' })
    expect(reactivateWithArchivedCourse.status).toBe(400)

    const restoreCourse = await api(page, `/api/collections/courses/records/${courseId}`, 'PATCH', { status: 'ACTIVE' })
    expect(restoreCourse.status).toBe(200)

    const deactivateTeacher = await api(page, `/api/collections/users/records/${teacherId}`, 'PATCH', { status: 'INACTIVE' })
    expect(deactivateTeacher.status).toBe(200)

    const reactivateWithInactiveTeacher = await api(page, `/api/collections/groups/records/${groupId}`, 'PATCH', { status: 'ACTIVE' })
    expect(reactivateWithInactiveTeacher.status).toBe(400)

    const restoreTeacher = await api(page, `/api/collections/users/records/${teacherId}`, 'PATCH', { status: 'ACTIVE' })
    expect(restoreTeacher.status).toBe(200)

    const restoreGroup = await api(page, `/api/collections/groups/records/${groupId}`, 'PATCH', { status: 'ACTIVE' })
    expect(restoreGroup.status).toBe(200)
    expect(restoreGroup.body.status).toBe('ACTIVE')

    const finishOne = await api(page, `/api/collections/enrollments/records/${enrollmentIds[0]}`, 'PATCH', {
      status: 'FINISHED',
      ended_at: new Date().toISOString(),
    })
    expect(finishOne.status).toBe(200)

    const capacityEqualOccupancy = await api(page, `/api/collections/groups/records/${groupId}`, 'PATCH', { capacity: 1 })
    expect(capacityEqualOccupancy.status).toBe(200)
    expect(capacityEqualOccupancy.body.capacity).toBe(1)
  } finally {
    for (const remove of cleanup.reverse()) {
      try { await remove() } catch { /* best-effort cleanup */ }
    }
  }
})
