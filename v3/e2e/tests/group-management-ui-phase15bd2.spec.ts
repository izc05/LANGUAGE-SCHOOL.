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

test('15B.3D.2: Admin decide desde la UI qué ocurre con las clases futuras al cambiar profesor', async ({ page }) => {
  await loginAdmin(page)
  const suffix = `${Date.now()}`
  const cleanup: Array<() => Promise<void>> = []
  const futureStart = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
  const futureEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString()
  const groupName = `D2 Grupo ${suffix}`

  try {
    const course = await api(page, '/api/collections/courses/records', 'POST', {
      title: `D2 Course ${suffix}`,
      slug: `d2-course-${suffix}`,
      level: 'B1',
      description: '15B.3D.2 E2E',
      status: 'ACTIVE',
      public_visible: false,
    })
    expect(course.status).toBe(200)
    cleanup.push(async () => { await api(page, `/api/collections/courses/records/${course.body.id}`, 'DELETE') })

    const teacherA = await api(page, '/api/collections/users/records', 'POST', {
      email: `d2-teacher-a-${suffix}@example.com`,
      password: 'D2TeacherPass123!',
      passwordConfirm: 'D2TeacherPass123!',
      name: 'D2', surname: 'Teacher A', role: 'TEACHER', status: 'ACTIVE', phone: '',
    })
    expect(teacherA.status).toBe(200)
    cleanup.push(async () => { await api(page, `/api/collections/users/records/${teacherA.body.id}`, 'DELETE') })

    const teacherB = await api(page, '/api/collections/users/records', 'POST', {
      email: `d2-teacher-b-${suffix}@example.com`,
      password: 'D2TeacherPass123!',
      passwordConfirm: 'D2TeacherPass123!',
      name: 'D2', surname: 'Teacher B', role: 'TEACHER', status: 'ACTIVE', phone: '',
    })
    expect(teacherB.status).toBe(200)
    cleanup.push(async () => { await api(page, `/api/collections/users/records/${teacherB.body.id}`, 'DELETE') })

    const group = await api(page, '/api/collections/groups/records', 'POST', {
      name: groupName,
      course: course.body.id,
      teacher: teacherA.body.id,
      academic_year: '2026/27',
      schedule_text: 'Martes y jueves · 18:00',
      capacity: 8,
      target_level: 'B1',
      default_delivery_mode: 'IN_PERSON',
      status: 'ACTIVE',
    })
    expect(group.status).toBe(200)
    cleanup.push(async () => { await api(page, `/api/collections/groups/records/${group.body.id}`, 'DELETE') })

    const scheduled = await api(page, '/api/collections/classes/records', 'POST', {
      group: group.body.id,
      teacher: teacherB.body.id,
      starts_at: futureStart,
      ends_at: futureEnd,
      topic: 'D2 Future scheduled',
      description: '15B.3D.2 UI decision',
      status: 'SCHEDULED',
      delivery_mode: 'ONLINE',
      location_text: '',
      online_join_url: '',
    })
    expect(scheduled.status).toBe(200)
    expect(scheduled.body.teacher).toBe(teacherA.body.id)
    cleanup.push(async () => { await api(page, `/api/collections/classes/records/${scheduled.body.id}`, 'DELETE') })

    await page.goto('/admin/cursos')
    const groupRow = page.locator('.admin-group-row').filter({ hasText: groupName })
    await expect(groupRow).toBeVisible()
    await groupRow.click()
    await page.getByRole('button', { name: 'Editar grupo' }).click()
    const teacherSelect = page.locator('.class-edit-form select').first()
    await expect(teacherSelect).toBeVisible()
    await teacherSelect.selectOption(teacherB.body.id)

    const decision = page.getByRole('checkbox', { name: /Reasignar clases futuras programadas al nuevo profesor/i })
    await expect(decision).toBeVisible()
    await expect(decision).toBeChecked()
    await expect(page.getByText(/La modalidad por defecto solo se aplica a nuevas clases/i)).toBeVisible()

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('reasignarán al nuevo profesor')
      expect(dialog.message()).toContain('histórico')
      await dialog.accept()
    })
    await page.getByRole('button', { name: 'Guardar grupo' }).click()
    await expect(page.getByText(/Las clases futuras programadas pasan al nuevo profesor/i)).toBeVisible()

    const groupAfterReassign = await api(page, `/api/collections/groups/records/${group.body.id}`)
    const classAfterReassign = await api(page, `/api/collections/classes/records/${scheduled.body.id}`)
    expect(groupAfterReassign.body.teacher).toBe(teacherB.body.id)
    expect(classAfterReassign.body.teacher).toBe(teacherB.body.id)

    await page.getByRole('button', { name: 'Editar grupo' }).click()
    await teacherSelect.selectOption(teacherA.body.id)
    await expect(decision).toBeVisible()
    await expect(decision).toBeChecked()
    await decision.uncheck()

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('conservarán el profesor que ya tienen')
      await dialog.accept()
    })
    await page.getByRole('button', { name: 'Guardar grupo' }).click()
    await expect(page.getByText(/Las clases futuras ya programadas conservan su profesor/i)).toBeVisible()

    const groupAfterKeep = await api(page, `/api/collections/groups/records/${group.body.id}`)
    const classAfterKeep = await api(page, `/api/collections/classes/records/${scheduled.body.id}`)
    expect(groupAfterKeep.body.teacher).toBe(teacherA.body.id)
    expect(classAfterKeep.body.teacher).toBe(teacherB.body.id)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: 'Editar grupo' }).click()
    await teacherSelect.selectOption(teacherB.body.id)
    await expect(decision).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    await page.getByRole('button', { name: 'Cancelar' }).click()
  } finally {
    for (const remove of cleanup.reverse()) {
      try { await remove() } catch { /* best-effort cleanup */ }
    }
  }
})
