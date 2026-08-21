import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const PB_URL = 'http://127.0.0.1:8090'

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

async function createTemporaryEvaluatedStudent(request: APIRequestContext, adminToken: string) {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const email = `e2e-level-crosslink-${unique}@example.com`
  const password = 'E2eCrossLinkPass123!'
  const name = 'Cross Link'
  const surname = 'Student'
  const userResponse = await request.post(`${PB_URL}/api/collections/users/records`, {
    headers: { Authorization: adminToken },
    data: {
      email,
      password,
      passwordConfirm: password,
      name,
      surname,
      role: 'STUDENT',
      status: 'ACTIVE',
      phone: '',
    },
  })
  expect([200, 201]).toContain(userResponse.status())
  const user = await userResponse.json() as { id: string }

  const assessmentResponse = await request.post(`${PB_URL}/api/language-school/placement/admin/students/${user.id}/assessments`, {
    headers: { Authorization: adminToken },
    data: {
      validatedLevel: 'B1',
      speakingLevel: 'B1',
      reason: 'INITIAL',
      notes: 'Valoración temporal para comprobar navegación cruzada 15B.3F.1.',
    },
  })
  expect(assessmentResponse.status(), await assessmentResponse.text()).toBe(201)

  return { userId: user.id, email, fullName: `${name} ${surname}` }
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

async function cleanupTemporaryStudent(request: APIRequestContext, superToken: string, studentId: string) {
  const assessments = (await listRecords(request, superToken, 'student_level_assessments')).filter((item) => item.student === studentId)
  for (const assessment of assessments) await deleteRecord(request, superToken, 'student_level_assessments', assessment.id)
  const profiles = (await listRecords(request, superToken, 'student_profiles')).filter((item) => item.user === studentId)
  for (const profile of profiles) await deleteRecord(request, superToken, 'student_profiles', profile.id)
  await deleteRecord(request, superToken, 'users', studentId)
}

async function login(page: Page) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(requiredEnv('E2E_ADMIN_EMAIL'))
  await page.getByLabel('Contraseña').fill(requiredEnv('E2E_ADMIN_PASSWORD'))
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

test('15B.3F.1: Resultados y ficha Alumno quedan enlazados en ambos sentidos', async ({ request, page }) => {
  const admin = await authenticate(request, 'users', requiredEnv('E2E_ADMIN_EMAIL'), requiredEnv('E2E_ADMIN_PASSWORD'))
  const superuser = await authenticate(request, '_superusers', requiredEnv('PB_SUPERUSER_EMAIL'), requiredEnv('PB_SUPERUSER_PASSWORD'))
  const student = await createTemporaryEvaluatedStudent(request, admin.token)

  try {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await login(page)
    await page.goto('/admin/test-de-nivel/resultados')

    await expect(page.getByRole('heading', { name: 'Resultados de nivel' })).toBeVisible()
    await page.getByLabel('Buscar alumno').fill(student.email)

    const studentLink = page.getByRole('link', { name: `Abrir ficha de ${student.fullName}` })
    await expect(studentLink).toBeVisible()
    await expect(studentLink).toHaveAttribute('href', `/admin/alumnos/${student.userId}`)
    await studentLink.click()

    await expect(page).toHaveURL(new RegExp(`/admin/alumnos/${student.userId}$`))
    await expect(page.getByRole('heading', { name: student.fullName })).toBeVisible()
    const levelCard = page.locator('.admin-student-level-card')
    await expect(levelCard).toBeVisible()
    await expect(levelCard.locator('.admin-student-level-current')).toContainText('B1')

    const backToResults = levelCard.getByRole('link', { name: 'Ver resultados de test' })
    await expect(backToResults).toHaveAttribute('href', '/admin/test-de-nivel/resultados')
    await backToResults.click()
    await expect(page).toHaveURL(/\/admin\/test-de-nivel\/resultados$/)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByLabel('Buscar alumno').fill(student.email)
    await expect(page.getByRole('link', { name: `Abrir ficha de ${student.fullName}` })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  } finally {
    await cleanupTemporaryStudent(request, superuser.token, student.userId)
  }
})
