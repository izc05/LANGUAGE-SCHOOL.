import { expect, test, type Page } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

async function loginAdmin(page: Page) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(requiredEnv('E2E_ADMIN_EMAIL'))
  await page.getByLabel('Contraseña').fill(requiredEnv('E2E_ADMIN_PASSWORD'))
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

test('15B.3D.1: cambio de profesor de Grupo/Aula requiere decisión explícita y conserva histórico', async ({ page }) => {
  await loginAdmin(page)
  const suffix = `${Date.now()}`
  const cleanup: Array<() => Promise<void>> = []
  const future = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
  const past = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  try {
    const courseA = await api(page, '/api/collections/courses/records', 'POST', {
      title: `D1 Course A ${suffix}`,
      slug: `d1-course-a-${suffix}`,
      level: 'B1',
      description: '15B.3D.1 E2E',
      status: 'ACTIVE',
      public_visible: false,
    })
    expect(courseA.status).toBe(200)
    cleanup.push(async () => { await api(page, `/api/collections/courses/records/${courseA.body.id}`, 'DELETE') })

    const courseB = await api(page, '/api/collections/courses/records', 'POST', {
      title: `D1 Course B ${suffix}`,
      slug: `d1-course-b-${suffix}`,
      level: 'B2',
      description: '15B.3D.1 E2E alternate course',
      status: 'ACTIVE',
      public_visible: false,
    })
    expect(courseB.status).toBe(200)
    cleanup.push(async () => { await api(page, `/api/collections/courses/records/${courseB.body.id}`, 'DELETE') })

    const teacherA = await api(page, '/api/collections/users/records', 'POST', {
      email: `d1-teacher-a-${suffix}@example.com`,
      password: 'D1TeacherPass123!',
      passwordConfirm: 'D1TeacherPass123!',
      name: 'D1', surname: 'Teacher A', role: 'TEACHER', status: 'ACTIVE', phone: '',
    })
    expect(teacherA.status).toBe(200)
    cleanup.push(async () => { await api(page, `/api/collections/users/records/${teacherA.body.id}`, 'DELETE') })

    const teacherB = await api(page, '/api/collections/users/records', 'POST', {
      email: `d1-teacher-b-${suffix}@example.com`,
      password: 'D1TeacherPass123!',
      passwordConfirm: 'D1TeacherPass123!',
      name: 'D1', surname: 'Teacher B', role: 'TEACHER', status: 'ACTIVE', phone: '',
    })
    expect(teacherB.status).toBe(200)
    cleanup.push(async () => { await api(page, `/api/collections/users/records/${teacherB.body.id}`, 'DELETE') })

    const group = await api(page, '/api/collections/groups/records', 'POST', {
      name: `D1 Group ${suffix}`,
      course: courseA.body.id,
      teacher: teacherA.body.id,
      academic_year: '2026/27',
      schedule_text: 'Lunes y miércoles · 18:00',
      capacity: 8,
      target_level: 'B1',
      default_delivery_mode: 'IN_PERSON',
      status: 'ACTIVE',
    })
    expect(group.status).toBe(200)
    const groupId = group.body.id
    cleanup.push(async () => { await api(page, `/api/collections/groups/records/${groupId}`, 'DELETE') })

    async function createClass(label: string, startsAt: string, endsAt: string, status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED') {
      const created = await api(page, '/api/collections/classes/records', 'POST', {
        group: groupId,
        teacher: teacherB.body.id,
        starts_at: startsAt,
        ends_at: endsAt,
        topic: label,
        description: '15B.3D.1 E2E class',
        status,
        delivery_mode: 'ONLINE',
        location_text: '',
        online_join_url: '',
      })
      expect(created.status).toBe(200)
      expect(created.body.teacher).toBe(teacherA.body.id)
      cleanup.push(async () => { await api(page, `/api/collections/classes/records/${created.body.id}`, 'DELETE') })
      return created.body
    }

    const scheduledA = await createClass('Future scheduled A', future(3), future(3.1), 'SCHEDULED')
    const scheduledPast = await createClass('Past scheduled', past(3), past(2.9), 'SCHEDULED')
    const completed = await createClass('Completed history', past(5), past(4.9), 'COMPLETED')
    const cancelled = await createClass('Cancelled history', future(5), future(5.1), 'CANCELLED')

    // Teacher changes must not bypass the explicit decision through the generic collection PATCH.
    const directTeacherPatch = await api(page, `/api/collections/groups/records/${groupId}`, 'PATCH', { teacher: teacherB.body.id })
    expect(directTeacherPatch.status).toBe(400)
    const groupAfterBlockedPatch = await api(page, `/api/collections/groups/records/${groupId}`)
    expect(groupAfterBlockedPatch.body.teacher).toBe(teacherA.body.id)

    // The canonical endpoint refuses a teacher change until Admin makes an explicit decision.
    const missingDecision = await api(page, `/api/language-school/admin/academic/groups/${groupId}/update`, 'POST', {
      patch: { teacher: teacherB.body.id },
    })
    expect(missingDecision.status).toBe(400)

    // Admin may consciously keep the teacher already stored in scheduled classes.
    const keepFutureOverrides = await api(page, `/api/language-school/admin/academic/groups/${groupId}/update`, 'POST', {
      patch: { teacher: teacherB.body.id },
      reassignFutureScheduledClasses: false,
    })
    expect(keepFutureOverrides.status, JSON.stringify(keepFutureOverrides.body)).toBe(200)
    expect(keepFutureOverrides.body).toMatchObject({ teacherChanged: true, reassignedFutureScheduledClasses: 0 })

    const scheduledAKept = await api(page, `/api/collections/classes/records/${scheduledA.id}`)
    expect(scheduledAKept.body.teacher).toBe(teacherA.body.id)

    // A class created after the group change inherits the current group teacher server-side.
    const scheduledB = await api(page, '/api/collections/classes/records', 'POST', {
      group: groupId,
      teacher: teacherA.body.id,
      starts_at: future(4),
      ends_at: future(4.1),
      topic: 'Future scheduled B',
      description: '15B.3D.1 E2E inherited teacher',
      status: 'SCHEDULED',
      delivery_mode: 'ONLINE',
      location_text: '',
      online_join_url: '',
    })
    expect(scheduledB.status).toBe(200)
    expect(scheduledB.body.teacher).toBe(teacherB.body.id)
    cleanup.push(async () => { await api(page, `/api/collections/classes/records/${scheduledB.body.id}`, 'DELETE') })

    const modeBefore = scheduledB.body.delivery_mode
    const modeOnly = await api(page, `/api/language-school/admin/academic/groups/${groupId}/update`, 'POST', {
      patch: { default_delivery_mode: 'HYBRID' },
    })
    expect(modeOnly.status, JSON.stringify(modeOnly.body)).toBe(200)
    const scheduledBAfterMode = await api(page, `/api/collections/classes/records/${scheduledB.body.id}`)
    expect(scheduledBAfterMode.body.delivery_mode).toBe(modeBefore)

    // Choosing reassignment only rewrites future SCHEDULED classes whose teacher differs.
    const reassignFuture = await api(page, `/api/language-school/admin/academic/groups/${groupId}/update`, 'POST', {
      patch: { teacher: teacherA.body.id },
      reassignFutureScheduledClasses: true,
    })
    expect(reassignFuture.status, JSON.stringify(reassignFuture.body)).toBe(200)
    expect(reassignFuture.body.teacherChanged).toBe(true)
    expect(reassignFuture.body.reassignedFutureScheduledClasses).toBe(1)

    const [futureAAfter, futureBAfter, pastAfter, completedAfter, cancelledAfter] = await Promise.all([
      api(page, `/api/collections/classes/records/${scheduledA.id}`),
      api(page, `/api/collections/classes/records/${scheduledB.body.id}`),
      api(page, `/api/collections/classes/records/${scheduledPast.id}`),
      api(page, `/api/collections/classes/records/${completed.id}`),
      api(page, `/api/collections/classes/records/${cancelled.id}`),
    ])
    expect(futureAAfter.body.teacher).toBe(teacherA.body.id)
    expect(futureBAfter.body.teacher).toBe(teacherA.body.id)
    expect(pastAfter.body.teacher).toBe(teacherA.body.id)
    expect(completedAfter.body.teacher).toBe(teacherA.body.id)
    expect(cancelledAfter.body.teacher).toBe(teacherA.body.id)

    const courseChangeWithHistory = await api(page, `/api/language-school/admin/academic/groups/${groupId}/update`, 'POST', {
      patch: { course: courseB.body.id },
    })
    expect(courseChangeWithHistory.status).toBe(400)

    const deactivateTeacherB = await api(page, `/api/collections/users/records/${teacherB.body.id}`, 'PATCH', { status: 'INACTIVE' })
    expect(deactivateTeacherB.status).toBe(200)
    const inactiveTeacherChange = await api(page, `/api/language-school/admin/academic/groups/${groupId}/update`, 'POST', {
      patch: { teacher: teacherB.body.id },
      reassignFutureScheduledClasses: true,
    })
    expect(inactiveTeacherChange.status).toBe(400)
    const restoreTeacherB = await api(page, `/api/collections/users/records/${teacherB.body.id}`, 'PATCH', { status: 'ACTIVE' })
    expect(restoreTeacherB.status).toBe(200)

    // Course can still be corrected safely while a group is genuinely empty.
    const emptyGroup = await api(page, '/api/collections/groups/records', 'POST', {
      name: `D1 Empty Group ${suffix}`,
      course: courseA.body.id,
      teacher: teacherA.body.id,
      academic_year: '2026/27',
      schedule_text: '',
      capacity: 4,
      target_level: 'MIXED',
      default_delivery_mode: 'IN_PERSON',
      status: 'ACTIVE',
    })
    expect(emptyGroup.status).toBe(200)
    cleanup.push(async () => { await api(page, `/api/collections/groups/records/${emptyGroup.body.id}`, 'DELETE') })

    const emptyCourseChange = await api(page, `/api/language-school/admin/academic/groups/${emptyGroup.body.id}/update`, 'POST', {
      patch: { course: courseB.body.id },
    })
    expect(emptyCourseChange.status, JSON.stringify(emptyCourseChange.body)).toBe(200)
    expect(emptyCourseChange.body.courseId).toBe(courseB.body.id)
  } finally {
    for (const remove of cleanup.reverse()) {
      try { await remove() } catch { /* best-effort cleanup */ }
    }
  }
})
