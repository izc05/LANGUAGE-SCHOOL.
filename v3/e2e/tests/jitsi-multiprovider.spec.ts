import { expect, test, type Page } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

const admin = { email: requiredEnv('E2E_ADMIN_EMAIL'), password: requiredEnv('E2E_ADMIN_PASSWORD') }
const student = { email: requiredEnv('E2E_STUDENT_EMAIL'), password: requiredEnv('E2E_STUDENT_PASSWORD') }
const legacyZoomJoinUrl = 'https://example.com/e2e-language-class'

async function login(page: Page, email: string, password: string, expectedPath: RegExp) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(expectedPath)
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/acceso$/)
}

async function openAdminClassroom(page: Page) {
  await page.getByRole('navigation', { name: 'Menú de Administrador' }).getByRole('link', { name: 'Aula online' }).click()
  await expect(page.getByRole('heading', { name: 'E2E Speaking class' })).toBeVisible()
}

test('Jitsi: genera una sala impredecible y autoriza al alumno dentro del campus', async ({ page }) => {
  await login(page, admin.email, admin.password, /\/admin$/)
  await openAdminClassroom(page)
  await page.getByRole('radio', { name: /^Híbrida/ }).check()
  await page.getByRole('radio', { name: 'Jitsi Meet' }).check()
  await page.getByRole('button', { name: 'Generar sala Jitsi' }).click()
  await expect(page.getByText(/Sala Jitsi (creada|segura|preparada)/).first()).toBeVisible()
  await logout(page)

  await page.route('https://meet.jit.si/external_api.js', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `window.JitsiMeetExternalAPI = class {
        constructor(domain, options) {
          const iframe = document.createElement('iframe');
          options.parentNode.appendChild(iframe);
          this.iframe = iframe;
          setTimeout(() => options.onload && options.onload(), 0);
        }
        addListener() {}
        getIFrame() { return this.iframe; }
        dispose() { this.iframe.remove(); }
      }`,
    })
  })

  await login(page, student.email, student.password, /\/alumno$/)
  const nextClass = page.locator('.campus-next-class')
  await nextClass.getByRole('link', { name: /Entrar en clase/ }).click()

  const joinResponsePromise = page.waitForResponse((response) => response.url().includes('/api/language-school/jitsi/classes/') && response.url().endsWith('/join'))
  await page.getByRole('button', { name: 'Entrar en clase' }).click()
  const authorization = await (await joinResponsePromise).json() as { roomName: string }
  expect(authorization.roomName).toMatch(/^ls-[A-Za-z0-9_-]+-[A-Za-z0-9]{24,}$/)
  expect(authorization.roomName.toLowerCase()).not.toContain('speaking')
  await expect(page.getByTitle('Aula Jitsi de Language School')).toBeVisible()
  await logout(page)

  // Restore the shared fixture for Zoom-specific tests.
  await login(page, admin.email, admin.password, /\/admin$/)
  await openAdminClassroom(page)
  await page.getByRole('radio', { name: 'Zoom' }).check()
  await page.getByLabel('Enlace de videoclase').fill(legacyZoomJoinUrl)
  await page.getByRole('button', { name: 'Guardar modalidad' }).click()
  await expect(page.getByText('Modalidad de la clase actualizada.')).toBeVisible()
})
