import { expect, test } from '@playwright/test'

const viewports = [
  { width: 1440, height: 1000 },
  { width: 820, height: 900 },
  { width: 390, height: 844 },
] as const

async function expectNoOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

test('16B: la entrada pública del test es directa, clara y responsive', async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto('/test-de-nivel')

    await expect(page.getByRole('heading', { name: /Descubre tu punto de partida/i })).toBeVisible()
    const start = page.getByRole('button', { name: 'Empezar test' })
    await expect(start).toBeVisible()
    await expect(page.getByText('Sin registro', { exact: false })).toBeVisible()
    await expect(page.getByText('A1–C2', { exact: false })).toBeVisible()

    const startBox = await start.boundingBox()
    expect(startBox?.height || 0).toBeGreaterThanOrEqual(48)
    await expectNoOverflow(page)
  }
})

test('16B: una pregunta mantiene opciones grandes, foco visible y progreso claro', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/test-de-nivel')
  await page.getByRole('button', { name: 'Empezar test' }).click()

  const card = page.locator('.placement-question-card')
  await expect(card).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Progreso del test' })).toBeVisible()
  await expect(page.getByText(/Pregunta \d+ de \d+/)).toBeVisible()

  const options = page.locator('.placement-option')
  await expect(options.first()).toBeVisible()
  expect(await options.count()).toBeGreaterThanOrEqual(2)

  const heights = await options.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().height))
  expect(Math.min(...heights)).toBeGreaterThanOrEqual(58)

  const firstInput = options.first().locator('input')
  await firstInput.focus()
  const outline = await options.first().evaluate((element) => {
    const style = getComputedStyle(element)
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth }
  })
  expect(outline.outlineStyle).not.toBe('none')
  expect(outline.outlineWidth).not.toBe('0px')
  await expectNoOverflow(page)
})
