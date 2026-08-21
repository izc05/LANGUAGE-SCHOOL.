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

async function apiRequest(
  page: Page,
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: Record<string, unknown>,
  authenticated = true,
) {
  return page.evaluate(async ({ path, method, body, authenticated }) => {
    const stored = authenticated ? JSON.parse(localStorage.getItem('pocketbase_auth') || '{}') as { token?: string } : {}
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
  }, { path, method, body, authenticated })
}

function recordsPath(collection: string, filter: string, perPage = 50) {
  return `/api/collections/${collection}/records?perPage=${perPage}&filter=${encodeURIComponent(filter)}`
}

test('15B sync: Admin, Profesor y Alumno conservan una única verdad académica', async ({ page }) => {
  await loginAdmin(page)
  const suffix = `${Date.now()}`
  const cleanup: Array<() => Promise<void>> = []

  try {
    const courses = await apiRequest(page, recordsPath('courses', 'status = "ACTIVE"', 1))
    expect(courses.status).toBe(200)
    const course = courses.body.items[0]
    expect(course?.id).toBeTruthy()

    const groups = await apiRequest(page, recordsPath('groups', 'status = "ACTIVE"', 1))
    expect(groups.status).toBe(200)
    const baseGroup = groups.body.items[0]
    expect(baseGroup?.id).toBeTruthy()
    const originalTeacherId = baseGroup.teacher

    const teacherCreate = await apiRequest(page, '/api/collections/users/records', 'POST', {
      email: `sync-teacher-${suffix}@example.com`,
      password: 'SyncTeacherPass123!',
      passwordConfirm: 'SyncTeacherPass123!',
      name: 'Sync', surname: 'Teacher', role: 'TEACHER', status: 'ACTIVE', phone: '',
    })
    expect(teacherCreate.status).toBe(200)
    const tempTeacherId = teacherCreate.body.id
    cleanup.push(async () => { await apiRequest(page, `/api/collections/users/records/${tempTeacherId}`, 'DELETE') })

    const teacherProfileCreate = await apiRequest(page, '/api/collections/teacher_profiles/records', 'POST', {
      user: tempTeacherId,
      display_name: 'Sync Teacher',
      headline: 'Teacher',
      bio: '',
      specialties: ['B1'],
      public_profile: true,
      active: true,
      sort_order: 999,
    })
    expect(teacherProfileCreate.status).toBe(200)
    const teacherProfileId = teacherProfileCreate.body.id
    cleanup.push(async () => { await apiRequest(page, `/api/collections/teacher_profiles/records/${teacherProfileId}`, 'DELETE') })
    cleanup.push(async () => {
      await apiRequest(page, `/api/language-school/admin/academic/groups/${baseGroup.id}/update`, 'POST', {
        patch: { teacher: originalTeacherId },
        reassignFutureScheduledClasses: true,
      })
    })

    const visibleBefore = await apiRequest(page, recordsPath('teacher_profiles', `id = "${teacherProfileId}"`, 1), 'GET', undefined, false)
    expect(visibleBefore.status).toBe(200)
    expect(visibleBefore.body.totalItems).toBe(1)

    const disableTeacher = await apiRequest(page, `/api/collections/users/records/${tempTeacherId}`, 'PATCH', { status: 'INACTIVE' })
    expect(disableTeacher.status).toBe(200)
    const disabledProfile = await apiRequest(page, `/api/collections/teacher_profiles/records/${teacherProfileId}`)
    expect(disabledProfile.status).toBe(200)
    expect(disabledProfile.body.active).toBe(false)
    const hiddenWhileInactive = await apiRequest(page, recordsPath('teacher_profiles', `id = "${teacherProfileId}"`, 1), 'GET', undefined, false)
    expect(hiddenWhileInactive.status).toBe(200)
    expect(hiddenWhileInactive.body.totalItems).toBe(0)

    const enableTeacher = await apiRequest(page, `/api/collections/users/records/${tempTeacherId}`, 'PATCH', { status: 'ACTIVE' })
    expect(enableTeacher.status).toBe(200)
    const enabledProfile = await apiRequest(page, `/api/collections/teacher_profiles/records/${teacherProfileId}`)
    expect(enabledProfile.body.active).toBe(true)

    const futureClassCreate = await apiRequest(page, '/api/collections/classes/records', 'POST', {
      group: baseGroup.id,
      teacher: originalTeacherId,
      starts_at: '2099-01-10T18:00:00.000Z',
      ends_at: '2099-01-10T19:00:00.000Z',
      topic: `Sync future ${suffix}`,
      description: '',
      status: 'SCHEDULED',
    })
    expect(futureClassCreate.status).toBe(200)
    const futureClassId = futureClassCreate.body.id
    cleanup.push(async () => { await apiRequest(page, `/api/collections/classes/records/${futureClassId}`, 'DELETE') })

    const completedClassCreate = await apiRequest(page, '/api/collections/classes/records', 'POST', {
      group: baseGroup.id,
      teacher: originalTeacherId,
      starts_at: '2025-01-10T18:00:00.000Z',
      ends_at: '2025-01-10T19:00:00.000Z',
      topic: `Sync history ${suffix}`,
      description: '',
      status: 'COMPLETED',
    })
    expect(completedClassCreate.status).toBe(200)
    const completedClassId = completedClassCreate.body.id
    cleanup.push(async () => { await apiRequest(page, `/api/collections/classes/records/${completedClassId}`, 'DELETE') })

    const reassign = await apiRequest(page, `/api/language-school/admin/academic/groups/${baseGroup.id}/update`, 'POST', {
      patch: { teacher: tempTeacherId },
      reassignFutureScheduledClasses: true,
    })
    expect(reassign.status).toBe(200)
    const futureAfter = await apiRequest(page, `/api/collections/classes/records/${futureClassId}`)
    const historyAfter = await apiRequest(page, `/api/collections/classes/records/${completedClassId}`)
    expect(futureAfter.body.teacher).toBe(tempTeacherId)
    expect(historyAfter.body.teacher).toBe(originalTeacherId)

    const restoreGroupTeacher = await apiRequest(page, `/api/language-school/admin/academic/groups/${baseGroup.id}/update`, 'POST', {
      patch: { teacher: originalTeacherId },
      reassignFutureScheduledClasses: true,
    })
    expect(restoreGroupTeacher.status).toBe(200)
    const futureRestored = await apiRequest(page, `/api/collections/classes/records/${futureClassId}`)
    expect(futureRestored.body.teacher).toBe(originalTeacherId)

    const studentCreate = await apiRequest(page, '/api/collections/users/records', 'POST', {
      email: `sync-student-${suffix}@example.com`,
      password: 'SyncStudentPass123!',
      passwordConfirm: 'SyncStudentPass123!',
      name: 'Sync', surname: 'Student', role: 'STUDENT', status: 'ACTIVE', phone: '',
    })
    expect(studentCreate.status).toBe(200)
    const tempStudentId = studentCreate.body.id
    cleanup.push(async () => { await apiRequest(page, `/api/collections/users/records/${tempStudentId}`, 'DELETE') })

    const studentProfileCreate = await apiRequest(page, '/api/collections/student_profiles/records', 'POST', {
      user: tempStudentId, birth_date: '', guardian_name: '', guardian_phone: '', notes_private: '', active: true,
    })
    expect(studentProfileCreate.status).toBe(200)
    const tempStudentProfileId = studentProfileCreate.body.id
    cleanup.push(async () => { await apiRequest(page, `/api/collections/student_profiles/records/${tempStudentProfileId}`, 'DELETE') })

    const makeGroup = async (name: string) => apiRequest(page, '/api/collections/groups/records', 'POST', {
      name, course: course.id, teacher: originalTeacherId, academic_year: '2098/99', schedule_text: 'E2E sync', capacity: 4,
      target_level: 'MIXED', default_delivery_mode: 'IN_PERSON', status: 'ACTIVE',
    })
    const groupOneCreate = await makeGroup(`Sync A ${suffix}`)
    const groupTwoCreate = await makeGroup(`Sync B ${suffix}`)
    expect(groupOneCreate.status).toBe(200)
    expect(groupTwoCreate.status).toBe(200)
    const groupOneId = groupOneCreate.body.id
    const groupTwoId = groupTwoCreate.body.id
    cleanup.push(async () => { await apiRequest(page, `/api/collections/groups/records/${groupOneId}`, 'DELETE') })
    cleanup.push(async () => { await apiRequest(page, `/api/collections/groups/records/${groupTwoId}`, 'DELETE') })

    const firstEnrollment = await apiRequest(page, '/api/collections/enrollments/records', 'POST', {
      student: tempStudentId, group: groupOneId, status: 'ACTIVE', joined_at: new Date().toISOString(), ended_at: '',
    })
    expect(firstEnrollment.status).toBe(200)

    const duplicateActive = await apiRequest(page, '/api/collections/enrollments/records', 'POST', {
      student: tempStudentId, group: groupTwoId, status: 'ACTIVE', joined_at: new Date().toISOString(), ended_at: '',
    })
    expect(duplicateActive.status).toBe(400)

    const moveToSecond = await apiRequest(page, '/api/language-school/admin/academic/enrollments/move', 'POST', {
      studentId: tempStudentId, targetGroupId: groupTwoId,
    })
    expect(moveToSecond.status).toBe(200)

    const afterFirstMove = await apiRequest(page, recordsPath('enrollments', `student = "${tempStudentId}"`, 20))
    const activeAfterFirstMove = afterFirstMove.body.items.filter((item: any) => item.status === 'ACTIVE')
    expect(activeAfterFirstMove).toHaveLength(1)
    expect(activeAfterFirstMove[0].group).toBe(groupTwoId)
    expect(afterFirstMove.body.items.find((item: any) => item.id === firstEnrollment.body.id)?.status).toBe('FINISHED')

    const moveBack = await apiRequest(page, '/api/language-school/admin/academic/enrollments/move', 'POST', {
      studentId: tempStudentId, targetGroupId: groupOneId,
    })
    expect(moveBack.status).toBe(200)

    const afterReturn = await apiRequest(page, recordsPath('enrollments', `student = "${tempStudentId}"`, 20))
    const activeAfterReturn = afterReturn.body.items.filter((item: any) => item.status === 'ACTIVE')
    expect(activeAfterReturn).toHaveLength(1)
    expect(activeAfterReturn[0].group).toBe(groupOneId)
    expect(afterReturn.body.items.filter((item: any) => item.group === groupOneId)).toHaveLength(2)

    const blockedDisableStudent = await apiRequest(page, `/api/collections/users/records/${tempStudentId}`, 'PATCH', { status: 'INACTIVE' })
    expect(blockedDisableStudent.status).toBe(400)

    const finishCurrentEnrollment = await apiRequest(page, `/api/collections/enrollments/records/${activeAfterReturn[0].id}`, 'PATCH', {
      status: 'FINISHED', ended_at: new Date().toISOString(),
    })
    expect(finishCurrentEnrollment.status).toBe(200)

    const disableStudent = await apiRequest(page, `/api/collections/users/records/${tempStudentId}`, 'PATCH', { status: 'INACTIVE' })
    expect(disableStudent.status).toBe(200)
    const disabledStudentProfile = await apiRequest(page, `/api/collections/student_profiles/records/${tempStudentProfileId}`)
    expect(disabledStudentProfile.body.active).toBe(false)
  } finally {
    for (const remove of cleanup.reverse()) {
      try { await remove() } catch { /* best-effort E2E cleanup */ }
    }
  }
})
