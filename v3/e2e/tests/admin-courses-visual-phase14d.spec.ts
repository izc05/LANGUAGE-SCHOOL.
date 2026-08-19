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

async function login(page: Page) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(admin.email)
  await page.getByLabel('Contraseña').fill(admin.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

async function expectNoInternalHorizontalOverflow(locator: import('@playwright/test').Locator) {
  const overflow = await locator.evaluate((element) => element.scrollWidth - element.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

test('14D: Cursos coloca grupos a ancho completo y elimina el panel lateral recortado', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(page)
  await page.goto('/admin/cursos')

  const workspace = page.locator('.admin-course-workspace')
  const courses = page.locator('.course-admin-grid')
  const groups = page.locator('.groups-overview-panel')

  await expect(workspace).toBeVisible()
  await expect(courses).toBeVisible()
  await expect(groups).toBeVisible()

  const geometry = await page.evaluate(() => {
    const courseGrid = document.querySelector('.course-admin-grid') as HTMLElement | null
    const groupPanel = document.querySelector('.groups-overview-panel') as HTMLElement | null
    const workspaceElement = document.querySelector('.admin-course-workspace') as HTMLElement | null
    if (!courseGrid || !groupPanel || !workspaceElement) return null
    const courseRect = courseGrid.getBoundingClientRect()
    const groupRect = groupPanel.getBoundingClientRect()
    return {
      workspaceColumns: getComputedStyle(workspaceElement).gridTemplateColumns,
      groupPosition: getComputedStyle(groupPanel).position,
      courseBottom: courseRect.bottom,
      groupTop: groupRect.top,
      groupWidth: groupRect.width,
      courseWidth: courseRect.width,
    }
  })

  expect(geometry).not.toBeNull()
  expect(geometry!.workspaceColumns.trim().split(/\s+/)).toHaveLength(1)
  expect(geometry!.groupPosition).toBe('static')
  expect(geometry!.groupTop).toBeGreaterThanOrEqual(geometry!.courseBottom - 2)
  expect(Math.abs(geometry!.groupWidth - geometry!.courseWidth)).toBeLessThanOrEqual(3)

  await expectNoInternalHorizontalOverflow(groups)
  const groupRows = groups.locator('.group-row')
  const rowCount = await groupRows.count()
  for (let index = 0; index < rowCount; index += 1) {
    await expectNoInternalHorizontalOverflow(groupRows.nth(index))
  }
  await expectNoHorizontalOverflow(page)
})

test('14D: Cursos y grupos siguen legibles en 1180, 820 y 390', async ({ page }) => {
  await login(page)

  for (const viewport of [
    { width: 1180, height: 900 },
    { width: 820, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/admin/cursos')

    const groups = page.locator('.groups-overview-panel')
    await expect(groups).toBeVisible()
    await expectNoInternalHorizontalOverflow(groups)

    const rows = groups.locator('.group-row')
    const rowCount = await rows.count()
    for (let index = 0; index < rowCount; index += 1) {
      const row = rows.nth(index)
      await expectNoInternalHorizontalOverflow(row)
      if (viewport.width <= 900) {
        const height = await row.evaluate((element) => element.getBoundingClientRect().height)
        expect(height).toBeGreaterThanOrEqual(82)
      }
    }

    const courseGrid = page.locator('.course-admin-grid')
    const columns = await courseGrid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length)
    if (viewport.width <= 900) expect(columns).toBe(1)
    else expect(columns).toBeGreaterThanOrEqual(1)

    await expectNoHorizontalOverflow(page)
  }
})
