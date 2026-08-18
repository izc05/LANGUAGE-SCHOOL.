import { expect, test, type Page } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

async function login(page: Page, email: string, password: string, expectedPath: RegExp) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(expectedPath)
}

async function expectNoHorizontalOverflow(page: Page) {
  const values = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
  expect(values.scroll).toBeLessThanOrEqual(values.client + 1)
}

test('8C.8 UI: visitante escucha Listening sin autoplay y Admin ve el banco protegido', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/test-de-nivel')
  await page.getByRole('button', { name: 'Empezar test' }).click()

  let listeningQuestions = 0
  for (let position = 1; position <= 21; position += 1) {
    await expect(page.getByText(`Pregunta ${position} de 21`)).toBeVisible()
    const audioBlock = page.locator('[data-listening-audio]')
    if (await audioBlock.count()) {
      listeningQuestions += 1
      await expect(audioBlock).toBeVisible()
      const audio = audioBlock.locator('audio')
      await expect(audio).toBeVisible()
      expect(await audio.getAttribute('autoplay')).toBeNull()
      await expect(page.getByText('Escucha el audio antes de responder.')).toBeVisible()
      expect((await page.locator('body').innerText()).toLowerCase()).not.toContain('transcripción interna')
    }

    const option = page.getByRole('radio').first()
    await page.locator('label.placement-option').first().click()
    await expect(option).toBeChecked()
    await page.getByRole('button', { name: position === 21 ? 'Ver mi resultado' : 'Confirmar respuesta' }).click()
  }

  expect(listeningQuestions).toBe(6)
  await expect(page.getByRole('heading', { name: /Tu nivel estimado es/i })).toBeVisible()
  await expect(page.getByText('Comprensión oral')).toBeVisible()
  await expect(page.getByText(/diagnóstico complementario/i)).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await login(page, requiredEnv('E2E_ADMIN_EMAIL'), requiredEnv('E2E_ADMIN_PASSWORD'), /\/admin$/)
  await page.goto('/admin/test-de-nivel')
  await expect(page.getByRole('heading', { name: 'Test de nivel' })).toBeVisible()

  const listeningVersion = page.locator('.placement-version-list button').filter({ hasText: 'Listening' }).first()
  await expect(listeningVersion).toBeVisible()
  await listeningVersion.click()
  await expect(page.getByRole('heading', { name: 'Comprensión oral' })).toBeVisible()
  await expect(page.getByText('24/24 audios')).toBeVisible()
  await expect(page.getByText(/Los guiones y respuestas son internos/i)).toBeVisible()
  await expect(page.locator('.placement-listening-level')).toHaveCount(6)
  await expectNoHorizontalOverflow(page)
})