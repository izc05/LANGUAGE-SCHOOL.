import { expect, test, type Page } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

const admin = { email: requiredEnv('E2E_ADMIN_EMAIL'), password: requiredEnv('E2E_ADMIN_PASSWORD') }

async function login(page: Page) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(admin.email)
  await page.getByLabel('Contraseña').fill(admin.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

test('14E: clase seleccionada y asistencia se leen como ficha y filas amplias', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(page)
  await page.goto('/admin/clases')

  const panel = page.locator('.admin-class-attendance')
  await expect(panel).toBeVisible()
  const heading = panel.locator('.admin-class-detail-heading')
  await expect(heading.getByText('CLASE SELECCIONADA')).toBeVisible()

  const statusActions = panel.locator('.admin-class-status-actions')
  await expect(statusActions).toBeVisible()
  const statusButtons = statusActions.getByRole('button')
  expect(await statusButtons.count()).toBeGreaterThanOrEqual(2)
  const actionGeometry = await statusActions.evaluate((element) => {
    const style = getComputedStyle(element)
    const buttons = [...element.querySelectorAll('button')] as HTMLElement[]
    return {
      gap: Number.parseFloat(style.columnGap || style.gap || '0'),
      minHeight: buttons.length ? Math.min(...buttons.map((button) => button.getBoundingClientRect().height)) : 0,
    }
  })
  expect(actionGeometry.gap).toBeGreaterThanOrEqual(8)
  expect(actionGeometry.minHeight).toBeGreaterThanOrEqual(40)

  const rows = panel.locator('.admin-attendance-list > article')
  await expect.poll(async () => rows.count()).toBeGreaterThan(0)
  const firstRow = rows.first()
  const rowGeometry = await firstRow.evaluate((element) => {
    const info = element.children[1] as HTMLElement | undefined
    const small = info?.querySelector('small') as HTMLElement | null
    return {
      height: element.getBoundingClientRect().height,
      infoDisplay: info ? getComputedStyle(info).display : '',
      smallDisplay: small ? getComputedStyle(small).display : '',
    }
  })
  expect(rowGeometry.height).toBeGreaterThanOrEqual(84)
  expect(rowGeometry.infoDisplay).toBe('grid')
  expect(rowGeometry.smallDisplay).toBe('block')

  const attendanceActions = firstRow.locator('.admin-attendance-actions')
  await expect(attendanceActions.getByRole('button')).toHaveCount(3)
  const attendanceGeometry = await attendanceActions.evaluate((element) => {
    const style = getComputedStyle(element)
    const buttons = [...element.querySelectorAll('button')] as HTMLElement[]
    return {
      gap: Number.parseFloat(style.columnGap || style.gap || '0'),
      minHeight: Math.min(...buttons.map((button) => button.getBoundingClientRect().height)),
    }
  })
  expect(attendanceGeometry.gap).toBeGreaterThanOrEqual(7)
  expect(attendanceGeometry.minHeight).toBeGreaterThanOrEqual(40)
  await expectNoPageOverflow(page)
})

test('14E: asistencia apila acciones sin desbordar en móvil', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await login(page)
  await page.goto('/admin/clases')

  const panel = page.locator('.admin-class-attendance')
  await expect(panel).toBeVisible()
  const rows = panel.locator('.admin-attendance-list > article')
  await expect.poll(async () => rows.count()).toBeGreaterThan(0)
  const firstRow = rows.first()
  const actions = firstRow.locator('.admin-attendance-actions')
  const columns = await actions.evaluate((element) => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length)
  expect(columns).toBe(1)

  const buttons = actions.getByRole('button')
  await expect(buttons).toHaveCount(3)
  for (let index = 0; index < 3; index += 1) {
    const width = await buttons.nth(index).evaluate((element) => element.getBoundingClientRect().width)
    expect(width).toBeGreaterThan(150)
  }

  const classActions = panel.locator('.admin-class-status-actions')
  const classColumns = await classActions.evaluate((element) => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length)
  expect(classColumns).toBe(1)
  await expectNoPageOverflow(page)
})
