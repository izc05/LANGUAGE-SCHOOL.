import { expect, test } from '@playwright/test'

test('8C.2: visitante completa el test público desde la UI y recibe C2 sin exponer answer key', async ({ page }) => {
  await page.goto('/test-de-nivel')

  await expect(page.getByRole('heading', { name: /Descubre tu punto de partida en inglés/i })).toBeVisible()
  await expect(page.getByText(/sin registrarte ni dejar tus datos/i)).toBeVisible()
  await page.getByRole('button', { name: 'Empezar test' }).click()

  for (let position = 1; position <= 15; position += 1) {
    await expect(page.getByText(`Pregunta ${position} de 15`)).toBeVisible()
    await page.getByLabel('Option A').check()
    await page.getByRole('button', { name: position === 15 ? 'Ver mi resultado' : 'Confirmar respuesta' }).click()
  }

  await expect(page.getByRole('heading', { name: 'Tu nivel estimado es C2.' })).toBeVisible()
  await expect(page.locator('.placement-result-score strong')).toHaveText('100%')
  await expect(page.getByText(/Resultado orientativo basado en el MCER/i)).toBeVisible()

  const body = await page.locator('body').innerText()
  expect(body).not.toContain('correct_option_id')
  expect(body).not.toContain('E2E-only answer key')
  expect(body).not.toContain('public_token_hash')
})

test('8C.2: test público conserva navegación por teclado y cero overflow en 390 px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/test-de-nivel')

  const start = page.getByRole('button', { name: 'Empezar test' })
  await start.focus()
  await page.keyboard.press('Enter')

  const firstOption = page.getByRole('radio').first()
  await firstOption.focus()
  await page.keyboard.press('Space')
  await expect(firstOption).toBeChecked()
  await expect(page.getByRole('progressbar', { name: 'Progreso del test' })).toBeVisible()

  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  expect(hasOverflow).toBe(false)
})
