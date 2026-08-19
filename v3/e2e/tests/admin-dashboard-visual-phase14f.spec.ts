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

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
}

test('14F: Dashboard no estira Últimos contenidos y compacta herramientas secundarias', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(page)

  const dashboard = page.locator('.admin-dashboard-phase12a')
  const secondaryCards = dashboard.locator('.admin-action-grid-secondary .admin-action-card')
  await expect(secondaryCards).toHaveCount(3)
  for (let index = 0; index < 3; index += 1) {
    const height = await secondaryCards.nth(index).evaluate((element) => element.getBoundingClientRect().height)
    expect(height).toBeLessThanOrEqual(210)
  }

  const columns = dashboard.locator('.admin-columns')
  await expect(columns).toBeVisible()
  const geometry = await columns.evaluate((element) => {
    const style = getComputedStyle(element)
    const panels = [...element.querySelectorAll(':scope > .panel')] as HTMLElement[]
    return {
      alignItems: style.alignItems,
      columnCount: style.gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length,
      panelHeights: panels.map((panel) => panel.getBoundingClientRect().height),
    }
  })
  expect(geometry.alignItems).toBe('start')
  expect(geometry.columnCount).toBe(2)
  expect(geometry.panelHeights).toHaveLength(2)

  const settingRows = dashboard.locator('.settings-list > a')
  await expect(settingRows).toHaveCount(4)
  for (let index = 0; index < 4; index += 1) {
    const height = await settingRows.nth(index).evaluate((element) => element.getBoundingClientRect().height)
    expect(height).toBeLessThanOrEqual(76)
  }

  const contentRows = dashboard.locator('.content-list > div')
  await expect.poll(async () => contentRows.count()).toBeGreaterThan(0)
  const firstContentHeight = await contentRows.first().evaluate((element) => element.getBoundingClientRect().height)
  expect(firstContentHeight).toBeLessThanOrEqual(90)
  await expectNoOverflow(page)
})

test('14F: Dashboard apila paneles inferiores sin overflow en móvil', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await login(page)

  const dashboard = page.locator('.admin-dashboard-phase12a')
  const columns = dashboard.locator('.admin-columns')
  const columnCount = await columns.evaluate((element) => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length)
  expect(columnCount).toBe(1)

  const panels = columns.locator(':scope > .panel')
  await expect(panels).toHaveCount(2)
  for (let index = 0; index < 2; index += 1) {
    const width = await panels.nth(index).evaluate((element) => element.getBoundingClientRect().width)
    expect(width).toBeLessThanOrEqual(390)
  }
  await expectNoOverflow(page)
})
