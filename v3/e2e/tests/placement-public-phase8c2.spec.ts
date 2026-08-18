import { expect, test } from '@playwright/test'

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1)
}

test('8C.2: visitante completa el test público desde la UI y recibe C2 sin exponer answer key', async ({ page }) => {
  await page.goto('/test-de-nivel')

  await expect(page.getByRole('heading', { name: /Descubre tu punto de partida en inglés/i })).toBeVisible()
  await expect(page.getByText(/(?:sin|no necesitas) registrarte ni dejar tus datos/i)).toBeVisible()
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

test('8C.2: test público conserva teclado, reduced motion y cero overflow en 390 px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/test-de-nivel')

  const start = page.getByRole('button', { name: 'Empezar test' })
  await start.focus()
  await page.keyboard.press('Enter')

  const firstOption = page.getByRole('radio').first()
  await firstOption.focus()
  await page.keyboard.press('Space')
  await expect(firstOption).toBeChecked()
  await expect(page.getByRole('progressbar', { name: 'Progreso del test' })).toBeVisible()

  const transitionDuration = await page.locator('.placement-option').first().evaluate((element) => getComputedStyle(element).transitionDuration)
  expect(Number.parseFloat(transitionDuration)).toBeLessThanOrEqual(0.001)
  await expectNoHorizontalOverflow(page)
})

test('8C.2: portada pública queda íntegra en 1440, 1180, 820 y 390 con metadata propia', async ({ page }) => {
  for (const width of [1440, 1180, 820, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    await page.goto('/test-de-nivel')

    await expect(page).toHaveTitle('Test de nivel de inglés · Language School')
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /test breve de inglés.*A1 a C2/i)
    await expect(page.locator('.placement-test-page')).toHaveCount(1)
    await expect(page.locator('.placement-test-intro-card')).toBeVisible()
    await expect(page.locator('.site-footer a[href="/test-de-nivel"]')).toHaveText('Test de nivel')

    const rootBox = await page.locator('.placement-test-page').boundingBox()
    expect(rootBox, `La portada del test debe tener geometría en ${width}px`).not.toBeNull()
    if (rootBox) {
      expect(rootBox.x, `La portada empieza fuera del viewport en ${width}px`).toBeGreaterThanOrEqual(-1)
      expect(rootBox.x + rootBox.width, `La portada desborda el viewport en ${width}px`).toBeLessThanOrEqual(width + 1)
    }
    await expectNoHorizontalOverflow(page)
  }
})
