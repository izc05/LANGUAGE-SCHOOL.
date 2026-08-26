import { expect, test, type Page } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

async function login(page: Page) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(requiredEnv('E2E_ADMIN_EMAIL'))
  await page.getByLabel('Contraseña').fill(requiredEnv('E2E_ADMIN_PASSWORD'))
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
}

test('14C: Avisos gana presencia rosa sin perder contraste', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(page)
  await page.goto('/admin/avisos')

  const hero = page.locator('.notifications-admin-page > .cms-page-heading')
  await expect(hero).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Centro de avisos' })).toBeVisible()
  const style = await hero.evaluate((element) => {
    const css = getComputedStyle(element)
    const heading = element.querySelector('h2')
    return {
      backgroundImage: css.backgroundImage,
      headingColor: heading ? getComputedStyle(heading).color : '',
      borderRadius: css.borderRadius,
    }
  })
  expect(style.backgroundImage).toContain('linear-gradient')
  expect(style.backgroundImage).toContain('radial-gradient')
  expect(style.headingColor).toBe('rgb(255, 255, 255)')
  expect(Number.parseFloat(style.borderRadius)).toBeGreaterThanOrEqual(24)

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(hero).toBeVisible()
  await expectNoOverflow(page)
})

test('14C: directorios y fichas usan superficies blancas y cabeceras rosa claras', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(page)

  await page.goto('/admin/alumnos')
  const studentHeading = page.locator('.phase14-pink-heading').first()
  const studentColors = await studentHeading.evaluate((element) => ({
    backgroundImage: getComputedStyle(element).backgroundImage,
    color: getComputedStyle(element).color,
  }))
  expect(studentColors.backgroundImage).toContain('linear-gradient')

  const firstStudent = page.locator('.phase14-student-row:not(.phase14-student-header)').first()
  await expect(firstStudent).toBeVisible()
  await firstStudent.click()
  await expect(page.locator('.phase14-profile-hero')).toBeVisible()
  const panelBackground = await page.locator('.phase14-profile-card').first().evaluate((element) => getComputedStyle(element).backgroundColor)
  expect(panelBackground).toBe('rgb(255, 255, 255)')

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoOverflow(page)
})
