import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const PB_URL = 'http://127.0.0.1:8090'
const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

async function authenticate(request: APIRequestContext, collection: string, email: string, password: string) {
  const response = await request.post(`${PB_URL}/api/collections/${collection}/auth-with-password`, {
    data: { identity: email, password },
  })
  expect(response.status(), await response.text()).toBe(200)
  return response.json() as Promise<{ token: string; record: { id: string } }>
}

async function createTemporaryStudentWithGroup(request: APIRequestContext, adminToken: string) {
  const groupsResponse = await request.get(`${PB_URL}/api/collections/groups/records?perPage=100`, {
    headers: { Authorization: adminToken },
  })
  expect(groupsResponse.status(), await groupsResponse.text()).toBe(200)
  const groups = await groupsResponse.json() as {
    items: Array<{ id: string; name: string; status: string; capacity: number; target_level: string }>
  }
  const enrollmentsResponse = await request.get(`${PB_URL}/api/collections/enrollments/records?perPage=500`, {
    headers: { Authorization: adminToken },
  })
  expect(enrollmentsResponse.status(), await enrollmentsResponse.text()).toBe(200)
  const enrollments = await enrollmentsResponse.json() as { items: Array<{ group: string; status: string }> }
  const group = groups.items.find((candidate) => {
    if (candidate.status !== 'ACTIVE' || !CEFR_LEVELS.includes(candidate.target_level)) return false
    const occupied = enrollments.items.filter((item) => item.group === candidate.id && item.status === 'ACTIVE').length
    return occupied < candidate.capacity
  })
  expect(group).toBeTruthy()

  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const password = 'E2eTempLevelUiPass123!'
  const userResponse = await request.post(`${PB_URL}/api/collections/users/records`, {
    headers: { Authorization: adminToken },
    data: {
      email: `e2e-level-ui-${unique}@example.com`,
      password,
      passwordConfirm: password,
      name: 'Level UI',
      surname: 'Student',
      role: 'STUDENT',
      status: 'ACTIVE',
      phone: '',
    },
  })
  expect([200, 201]).toContain(userResponse.status())
  const user = await userResponse.json() as { id: string }

  const enrollmentResponse = await request.post(`${PB_URL}/api/collections/enrollments/records`, {
    headers: { Authorization: adminToken },
    data: {
      student: user.id,
      group: group!.id,
      status: 'ACTIVE',
      joined_at: new Date().toISOString(),
    },
  })
  expect([200, 201]).toContain(enrollmentResponse.status())
  const enrollment = await enrollmentResponse.json() as { id: string }
  return { userId: user.id, enrollmentId: enrollment.id, groupName: group!.name, targetLevel: group!.target_level }
}

async function listRecords(request: APIRequestContext, superToken: string, collection: string) {
  const response = await request.get(`${PB_URL}/api/collections/${collection}/records?perPage=500`, {
    headers: { Authorization: superToken },
  })
  expect(response.status(), await response.text()).toBe(200)
  return (await response.json() as { items: Array<Record<string, unknown> & { id: string }> }).items
}

async function deleteRecord(request: APIRequestContext, superToken: string, collection: string, id: string) {
  const response = await request.delete(`${PB_URL}/api/collections/${collection}/records/${id}`, {
    headers: { Authorization: superToken },
  })
  expect([200, 204]).toContain(response.status())
}

async function cleanupTemporaryStudent(request: APIRequestContext, superToken: string, studentId: string, enrollmentId: string) {
  const assessments = (await listRecords(request, superToken, 'student_level_assessments')).filter((item) => item.student === studentId)
  for (const assessment of assessments) await deleteRecord(request, superToken, 'student_level_assessments', assessment.id)
  const profiles = (await listRecords(request, superToken, 'student_profiles')).filter((item) => item.user === studentId)
  for (const profile of profiles) await deleteRecord(request, superToken, 'student_profiles', profile.id)
  await deleteRecord(request, superToken, 'enrollments', enrollmentId)
  await deleteRecord(request, superToken, 'users', studentId)
}

async function login(page: Page) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(requiredEnv('E2E_ADMIN_EMAIL'))
  await page.getByLabel('Contraseña').fill(requiredEnv('E2E_ADMIN_PASSWORD'))
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

test('15B.3E.2: Admin gestiona nivel e histórico desde la ficha del alumno sin sobrescribir', async ({ request, page }) => {
  const admin = await authenticate(request, 'users', requiredEnv('E2E_ADMIN_EMAIL'), requiredEnv('E2E_ADMIN_PASSWORD'))
  const superuser = await authenticate(request, '_superusers', requiredEnv('PB_SUPERUSER_EMAIL'), requiredEnv('PB_SUPERUSER_PASSWORD'))
  const student = await createTemporaryStudentWithGroup(request, admin.token)
  const mismatchLevel = student.targetLevel === 'A1' ? 'B2' : 'A1'
  const assessmentUrl = `${PB_URL}/api/language-school/placement/admin/students/${student.userId}/assessments`
  const summaryUrl = `${PB_URL}/api/language-school/placement/admin/students/${student.userId}/summary`

  try {
    const rejectedMismatch = await request.post(assessmentUrl, {
      headers: { Authorization: admin.token },
      data: {
        validatedLevel: mismatchLevel,
        reason: 'INITIAL',
        notes: 'Existe justificación, pero falta la confirmación explícita E2E.',
        acknowledgeLevelMismatch: false,
      },
    })
    expect(rejectedMismatch.status(), await rejectedMismatch.text()).toBe(400)
    const afterRejected = await request.get(summaryUrl, { headers: { Authorization: admin.token } })
    expect(afterRejected.status(), await afterRejected.text()).toBe(200)
    expect((await afterRejected.json() as { assessmentHistory: unknown[] }).assessmentHistory).toHaveLength(0)

    await page.setViewportSize({ width: 1440, height: 1000 })
    await login(page)
    await page.goto(`/admin/alumnos/${student.userId}`)

    const levelCard = page.locator('.admin-student-level-card')
    await expect(levelCard.getByRole('heading', { name: 'Evaluación y progreso' })).toBeVisible()
    await expect(levelCard).toContainText('Sin evaluar')
    await expect(levelCard).toContainText('Sin valoraciones manuales')

    await levelCard.getByRole('button', { name: 'Registrar valoración' }).click()
    const levelSelect = levelCard.getByLabel('Nivel validado por Administración')
    const reasonSelect = levelCard.getByLabel('Motivo de valoración por Administración')
    const saveButton = levelCard.getByRole('button', { name: 'Guardar nueva valoración' })
    await expect(reasonSelect).toHaveValue('INITIAL')
    await levelSelect.selectOption(mismatchLevel)
    await expect(levelCard.getByRole('alert')).toContainText('Diferencia con el grupo')
    await expect(levelCard.getByRole('alert')).toContainText(student.targetLevel)
    await expect(saveButton).toBeDisabled()
    await levelCard.getByLabel('Observaciones de nivel por Administración').fill('Valoración inicial E2E con diferencia de grupo justificada.')
    await expect(saveButton).toBeDisabled()
    await levelCard.getByLabel('Confirmar desajuste entre nivel y grupo').check()
    await expect(saveButton).toBeEnabled()
    await saveButton.click()

    await expect(levelCard.getByRole('status')).toContainText(`Nivel ${mismatchLevel} registrado`)
    await expect(levelCard.locator('.admin-student-level-history-row')).toHaveCount(1)
    await expect(levelCard.locator('.admin-student-level-history-row').first()).toContainText('Inicial')
    await expect(levelCard.locator('.admin-student-level-history-row').first()).toContainText(mismatchLevel)
    await expect(levelCard).toContainText('Revisar encaje con el grupo')

    const academyCard = page.getByRole('heading', { name: 'Matrícula y aprendizaje' }).locator('xpath=ancestor::article[1]')
    await expect(academyCard).toContainText(mismatchLevel)

    await levelCard.getByRole('button', { name: 'Registrar valoración' }).click()
    await expect(reasonSelect).toHaveValue('REVIEW')
    await expect(reasonSelect.locator('option[value="INITIAL"]')).toHaveCount(0)
    await levelSelect.selectOption(student.targetLevel)
    await reasonSelect.selectOption('PROGRESS')
    await levelCard.getByLabel('Observaciones de nivel por Administración').fill('Progreso confirmado E2E; nueva entrada acumulativa.')
    await levelCard.getByRole('button', { name: 'Guardar nueva valoración' }).click()

    await expect(levelCard.getByRole('status')).toContainText(`Nivel ${student.targetLevel} registrado`)
    await expect(levelCard.locator('.admin-student-level-history-row')).toHaveCount(2)
    await expect(levelCard.locator('.admin-student-level-history-row').first()).toContainText('Progreso')
    await expect(levelCard.locator('.admin-student-level-history-row').nth(1)).toContainText('Inicial')
    await expect(levelCard.locator('.admin-student-level-mismatch')).toHaveCount(0)
    await expect(academyCard).toContainText(student.targetLevel)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.reload()
    await expect(page.locator('.admin-student-level-card')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  } finally {
    await cleanupTemporaryStudent(request, superuser.token, student.userId, student.enrollmentId)
  }
})