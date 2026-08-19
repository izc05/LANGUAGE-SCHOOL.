import { expect, test, type Page } from '@playwright/test'

const viewports = [
  { width: 1440, height: 1000 },
  { width: 1180, height: 900 },
  { width: 820, height: 900 },
  { width: 390, height: 844 },
] as const

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

async function completeProgressiveAttempt(page: Page, keyboardFirstAnswer = false) {
  await page.getByRole('button', { name: 'Empezar test' }).click()
  await expect(page.getByText('Pregunta 1 de 12')).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Progreso del test' })).toHaveAttribute('aria-valuemax', '12')

  for (let position = 1; position <= 12; position += 1) {
    await expect(page.getByText(`Pregunta ${position} de 12`)).toBeVisible()
    const firstRadio = page.getByRole('radio').first()
    if (keyboardFirstAnswer && position === 1) {
      await firstRadio.focus()
      await page.keyboard.press('Space')
    } else {
      await page.locator('.placement-option').first().click()
    }
    await expect(firstRadio).toBeChecked()
    await page.getByRole('button', { name: position === 12 ? 'Ver mi resultado' : 'Confirmar respuesta' }).click()
  }

  await expect(page.getByRole('heading', { name: /Tu nivel estimado es (A1|A2|B1|B2|C1|C2)\./ })).toBeVisible()
}

test('16G: recorrido progresivo real queda íntegro en 1440, 1180, 820 y 390', async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.emulateMedia({ reducedMotion: viewport.width === 390 ? 'reduce' : 'no-preference' })
    await page.goto('/test-de-nivel')

    await expect(page.getByRole('heading', { name: /Descubre tu punto de partida en inglés/i })).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await completeProgressiveAttempt(page, viewport.width === 390)

    await expect(page.getByText('El nivel no sale solo del porcentaje.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Lo que ya está sosteniendo tu nivel.' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Dónde puede estar tu siguiente mejora.' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Speaking requiere valoración docente.' })).toBeVisible()
    await expect(page.locator('.placement-recommendations')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Quiero que me orientéis' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Repetir el test' })).toBeVisible()

    const body = await page.locator('body').innerText()
    expect(body).not.toContain('correct_option_id')
    expect(body).not.toContain('correctOptionId')
    expect(body).not.toContain('selected_option_id')
    expect(body).not.toContain('public_token_hash')
    await expectNoHorizontalOverflow(page)
  }
})

test('16G: reduced motion elimina transiciones del test progresivo en móvil', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/test-de-nivel')
  await page.getByRole('button', { name: 'Empezar test' }).click()
  await expect(page.getByText('Pregunta 1 de 12')).toBeVisible()

  const option = page.locator('.placement-option').first()
  const transitionDuration = await option.evaluate((element) => getComputedStyle(element).transitionDuration)
  expect(Number.parseFloat(transitionDuration)).toBeLessThanOrEqual(0.001)

  const firstRadio = page.getByRole('radio').first()
  await firstRadio.focus()
  await page.keyboard.press('Space')
  await expect(firstRadio).toBeChecked()
  await expectNoHorizontalOverflow(page)
})
