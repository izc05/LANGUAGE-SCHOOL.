import { expect, test } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

test('18C: Resultados de nivel mantiene la escala de Admin aislada del resultado público', async ({ page }) => {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(requiredEnv('E2E_ADMIN_EMAIL'))
  await page.getByLabel('Contraseña').fill(requiredEnv('E2E_ADMIN_PASSWORD'))
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin$/)

  await page.goto('/admin/test-de-nivel/resultados')
  const firstStudent = page.locator('.placement-results-student-list article').first()
  await expect(firstStudent).toBeVisible()

  const typography = await firstStudent.evaluate((element) => {
    const level = element.querySelector('.placement-result-level') as HTMLElement | null
    const source = level?.querySelector('small') as HTMLElement | null
    const levelStyle = level ? getComputedStyle(level) : null
    const sourceStyle = source ? getComputedStyle(source) : null
    return {
      hasLevel: Boolean(level),
      hasSource: Boolean(source),
      levelFontSize: Number.parseFloat(levelStyle?.fontSize || '0'),
      sourceFontSize: Number.parseFloat(sourceStyle?.fontSize || '0'),
      sourceLineHeight: sourceStyle?.lineHeight || '',
    }
  })

  expect(typography.hasLevel).toBe(true)
  expect(typography.hasSource).toBe(true)
  expect(typography.levelFontSize).toBeGreaterThan(0)
  expect(typography.levelFontSize).toBeLessThanOrEqual(20)
  expect(typography.sourceFontSize).toBeGreaterThan(0)
  expect(typography.sourceFontSize).toBeLessThanOrEqual(18)

  if (typography.sourceLineHeight !== 'normal') {
    const sourceLineHeight = Number.parseFloat(typography.sourceLineHeight)
    expect(Number.isFinite(sourceLineHeight)).toBe(true)
    expect(sourceLineHeight).toBeLessThanOrEqual(30)
  }
})
