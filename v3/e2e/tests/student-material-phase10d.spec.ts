import { expect, test, type Page } from '@playwright/test'

const PB_URL = 'http://127.0.0.1:8090'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

const credentials = {
  admin: { email: requiredEnv('E2E_ADMIN_EMAIL'), password: requiredEnv('E2E_ADMIN_PASSWORD') },
  student: { email: requiredEnv('E2E_STUDENT_EMAIL'), password: requiredEnv('E2E_STUDENT_PASSWORD') },
}

async function login(page: Page, email: string, password: string, expectedPath: RegExp) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(expectedPath)
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/acceso$/)
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

test('10.4: Material destaca, busca y filtra un recurso real del grupo', async ({ page }, testInfo) => {
  const materialTitle = `Phase 10 · Travel pack R${testInfo.retry}`

  await login(page, credentials.admin.email, credentials.admin.password, /\/admin$/)

  const created = await page.evaluate(async ({ pbUrl, materialTitle }) => {
    const auth = JSON.parse(localStorage.getItem('pocketbase_auth') || '{}') as { token?: string }
    const token = auth.token || ''
    const groupsResponse = await fetch(`${pbUrl}/api/collections/groups/records?perPage=20`, { headers: { Authorization: token } })
    const groups = await groupsResponse.json() as { items?: Array<{ id: string; name: string; teacher: string }> }
    const group = (groups.items || []).find((item) => item.name === 'E2E B1 Group')
    if (!group) return { status: 404, id: '' }

    const form = new FormData()
    form.set('title', materialTitle)
    form.set('description', 'Material real creado para validar la biblioteca del alumno.')
    form.set('teacher', group.teacher)
    form.set('group', group.id)
    form.set('visibility', 'GROUP')
    form.set('published', 'true')
    form.set('file', new File(['%PDF-1.4\n% E2E phase 10 material'], `phase-10-travel-pack-r${materialTitle.slice(-1)}.pdf`, { type: 'application/pdf' }))

    const response = await fetch(`${pbUrl}/api/collections/materials/records`, {
      method: 'POST',
      headers: { Authorization: token },
      body: form,
    })
    const payload = await response.json().catch(() => ({})) as { id?: string }
    return { status: response.status, id: payload.id || '' }
  }, { pbUrl: PB_URL, materialTitle })

  expect(created.status).toBe(200)
  expect(created.id).toBeTruthy()
  await logout(page)

  await login(page, credentials.student.email, credentials.student.password, /\/alumno$/)
  await page.getByRole('navigation', { name: 'Menú de Alumno' }).getByRole('link', { name: 'Material' }).click()
  await expect(page).toHaveURL(/\/alumno\/material$/)
  await expect(page.getByRole('heading', { name: 'Material' })).toBeVisible()

  const featured = page.locator('.student-material-featured10')
  await expect(featured).toBeVisible()
  await expect(featured.getByText('ÚLTIMO RECURSO', { exact: true })).toBeVisible()
  await expect(featured.getByRole('heading', { name: materialTitle })).toBeVisible()
  await expect(featured.getByText('Tu grupo', { exact: true })).toBeVisible()
  await expect(featured.getByRole('button', { name: 'Descargar recurso' })).toBeVisible()

  const search = page.getByPlaceholder('Título, descripción o archivo...')
  await search.fill(materialTitle)
  await expect(featured).toHaveCount(0)
  await expect(page.locator('.student-resource-card10').filter({ hasText: materialTitle })).toHaveCount(1)
  await expect(page.locator('.student-resource-card10').filter({ hasText: materialTitle }).first()).toBeVisible()

  await search.fill('')
  await page.getByRole('button', { name: 'Mi grupo' }).click()
  await expect(featured).toHaveCount(0)
  await expect(page.locator('.student-resource-card10').filter({ hasText: materialTitle }).first()).toBeVisible()

  await page.locator('.student-material-sort10 select').selectOption('TITLE')
  await expect(page.getByRole('button', { name: 'Limpiar filtros' })).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoHorizontalOverflow(page)
})
