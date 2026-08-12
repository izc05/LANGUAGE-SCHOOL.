import { expect, test, type Page } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

async function login(page: Page, email: string, password: string, expected: RegExp) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(expected)
}

async function useSkipLink(page: Page) {
  const skip = page.getByRole('link', { name: 'Saltar al contenido' })
  await page.keyboard.press('Tab')
  await expect(skip).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main-content')).toBeFocused()
}

test('web pública ofrece salto al contenido y landmarks principales', async ({ page }) => {
  await page.goto('/')
  await useSkipLink(page)
  await expect(page.getByRole('main')).toHaveCount(1)
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible()
  await expect(page.getByRole('contentinfo')).toHaveCount(1)
})

test('portal STUDENT permite saltar el menú lateral por teclado', async ({ page }) => {
  await login(page, requiredEnv('E2E_STUDENT_EMAIL'), requiredEnv('E2E_STUDENT_PASSWORD'), /\/alumno$/)
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await useSkipLink(page)
  await expect(page.getByRole('navigation', { name: 'Menú de Alumno' })).toBeVisible()
})

test('formularios públicos mantienen etiquetas accesibles', async ({ page }) => {
  await page.goto('/contacto')
  await expect(page.getByLabel('Nombre')).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('Teléfono')).toBeVisible()
  await expect(page.getByLabel('Me interesa')).toBeVisible()
  await expect(page.getByLabel('Mensaje')).toBeVisible()
})

test('modo de movimiento reducido elimina transiciones largas', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const durationSeconds = await page.locator('.skip-link').evaluate((element) => {
    const raw = getComputedStyle(element).transitionDuration.trim()
    if (raw.endsWith('ms')) return Number.parseFloat(raw) / 1000
    return Number.parseFloat(raw)
  })
  expect(durationSeconds).toBeLessThanOrEqual(0.001)
})
