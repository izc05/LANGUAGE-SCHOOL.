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

async function apiGet(page: Page, path: string) {
  return page.evaluate(async (requestPath) => {
    const stored = JSON.parse(localStorage.getItem('pocketbase_auth') || '{}') as { token?: string }
    const response = await fetch(`http://127.0.0.1:8090${requestPath}`, { headers: stored.token ? { Authorization: stored.token } : {} })
    let body: any = null
    try { body = await response.json() } catch { body = null }
    return { status: response.status, body }
  }, path)
}

function recordsPath(collection: string, filter: string, perPage = 50) {
  return `/api/collections/${collection}/records?perPage=${perPage}&filter=${encodeURIComponent(filter)}`
}

test('15B.3F.2: ficha Alumno conserva contexto al abrir profesor, grupo y próxima clase', async ({ page }) => {
  await loginAdmin(page)

  const groups = await apiGet(page, recordsPath('groups', 'name = "E2E B1 Group" && status = "ACTIVE"', 1))
  expect(groups.status).toBe(200)
  const group = groups.body.items[0]
  expect(group?.id).toBeTruthy()
  expect(group?.teacher).toBeTruthy()
  expect(group?.course).toBeTruthy()

  const enrollments = await apiGet(page, recordsPath('enrollments', `group = "${group.id}" && status = "ACTIVE"`, 10))
  expect(enrollments.status).toBe(200)
  const enrollment = enrollments.body.items[0]
  expect(enrollment?.student).toBeTruthy()

  const [studentResponse, teacherResponse, courseResponse, classesResponse] = await Promise.all([
    apiGet(page, `/api/collections/users/records/${enrollment.student}`),
    apiGet(page, `/api/collections/users/records/${group.teacher}`),
    apiGet(page, `/api/collections/courses/records/${group.course}`),
    apiGet(page, recordsPath('classes', `group = "${group.id}"`, 50)),
  ])
  expect(studentResponse.status).toBe(200)
  expect(teacherResponse.status).toBe(200)
  expect(courseResponse.status).toBe(200)
  expect(classesResponse.status).toBe(200)

  const student = studentResponse.body
  const teacher = teacherResponse.body
  const course = courseResponse.body
  const teacherName = [teacher.name, teacher.surname].filter(Boolean).join(' ') || teacher.email
  const futureClass = [...classesResponse.body.items]
    .filter((record: any) => record.status === 'SCHEDULED' && new Date(record.starts_at).getTime() >= Date.now())
    .sort((a: any, b: any) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0]
  expect(futureClass?.id).toBeTruthy()

  const studentPath = `/admin/alumnos/${student.id}`
  const groupPath = `/admin/cursos?grupo=${encodeURIComponent(group.id)}`
  const teacherPath = `/admin/profesores/${encodeURIComponent(teacher.id)}`
  const classPath = `/admin/clases?grupo=${encodeURIComponent(group.id)}&clase=${encodeURIComponent(futureClass.id)}`

  await page.goto(studentPath)
  const academyCard = page.getByRole('heading', { name: 'Matrícula y aprendizaje' }).locator('xpath=ancestor::article[1]')
  await expect(academyCard).toBeVisible()
  await expect(academyCard.locator(`a[href="${groupPath}"]`)).toHaveCount(2)
  await expect(academyCard.getByRole('link', { name: teacherName })).toHaveAttribute('href', teacherPath)
  await expect(academyCard.locator(`a[href="${classPath}"]`)).toHaveCount(1)

  await academyCard.getByRole('link', { name: group.name }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/cursos\\?grupo=${group.id}$`))
  await expect(page.locator('.admin-group-row.selected')).toContainText(group.name)
  await expect(page.locator('.admin-enrollment-panel')).toContainText(`MATRÍCULAS · ${group.name}`)

  await page.goto(studentPath)
  await page.getByRole('heading', { name: 'Matrícula y aprendizaje' }).locator('xpath=ancestor::article[1]').getByRole('link', { name: teacherName }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/profesores/${teacher.id}$`))

  await page.goto(studentPath)
  await page.getByRole('heading', { name: 'Matrícula y aprendizaje' }).locator('xpath=ancestor::article[1]').locator(`a[href="${classPath}"]`).click()
  await expect(page).toHaveURL(new RegExp(`/admin/clases\\?grupo=${group.id}&clase=${futureClass.id}$`))
  await expect(page.locator('.admin-calendar-filters select').nth(1)).toHaveValue(group.id)
  await expect(page.locator('.calendar-class.selected')).toContainText(futureClass.topic)
  await expect(page.locator('.admin-class-detail-heading')).toContainText(futureClass.topic)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(studentPath)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  await expect(page.getByRole('heading', { name: 'Matrícula y aprendizaje' })).toBeVisible()
  await expect(page.getByRole('link', { name: teacherName })).toBeVisible()
  await expect(page.getByRole('link', { name: course.title })).toBeVisible()
})
