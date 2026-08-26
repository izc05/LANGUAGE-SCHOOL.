import { expect, test } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

function columnCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length
}

function durationInMs(value: string): number {
  const normalized = value.trim()
  const amount = Number.parseFloat(normalized)
  return normalized.endsWith('ms') ? amount : amount * 1000
}

const admin = {
  email: requiredEnv('E2E_ADMIN_EMAIL'),
  password: requiredEnv('E2E_ADMIN_PASSWORD'),
}

async function login(page: import('@playwright/test').Page) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(admin.email)
  await page.getByLabel('Contraseña').fill(admin.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

async function expectNoPageOverflow(page: import('@playwright/test').Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
}

test('12.7: Web y contenido conserva sus seis herramientas con responsive coherente', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(page)

  await page.goto('/admin/web')
  await expect(page.getByRole('heading', { name: 'Editar web pública' })).toBeVisible()
  const sitePage = page.locator('.cms-page').filter({ has: page.locator('.cms-editor-grid') })
  await expect(sitePage.locator('.cms-form')).toBeVisible()
  await expect(sitePage.locator('.cms-preview-panel')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Guardar y publicar' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Guardar borrador' })).toBeVisible()
  const siteDesktopColumns = await sitePage.locator('.cms-editor-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(columnCount(siteDesktopColumns)).toBe(2)

  await page.setViewportSize({ width: 820, height: 900 })
  await expectNoPageOverflow(page)
  const siteTabletColumns = await sitePage.locator('.cms-editor-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(columnCount(siteTabletColumns)).toBe(1)

  await page.goto('/admin/web/sobre-nosotros')
  await expect(page.getByRole('heading', { name: 'Historia, enfoque y valores' })).toBeVisible()
  const aboutPage = page.locator('.cms-page').filter({ has: page.locator('.about-admin-layout') })
  await expect(aboutPage.locator('.about-admin-layout')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publicar cambios' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Guardar borrador' })).toBeVisible()
  const aboutTabletColumns = await aboutPage.locator('.about-admin-layout').evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(columnCount(aboutTabletColumns)).toBe(1)
  await expectNoPageOverflow(page)

  await page.goto('/admin/profesores/publicos')
  await expect(page.getByRole('heading', { name: 'Perfiles públicos del equipo' })).toBeVisible()
  const publicTeachersPage = page.locator('.cms-page').filter({ has: page.locator('.public-teacher-admin-grid') })
  await expect(publicTeachersPage.locator('.public-teacher-admin-grid')).toBeVisible()
  const teacherCards = publicTeachersPage.locator('.public-teacher-admin-card')
  if (await teacherCards.count()) {
    await expect(teacherCards.first().getByRole('button', { name: 'Guardar perfil público' })).toBeVisible()
  }
  const teacherTabletColumns = await publicTeachersPage.locator('.public-teacher-admin-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(columnCount(teacherTabletColumns)).toBe(1)
  await expectNoPageOverflow(page)

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/admin/blog')
  await expect(page.getByRole('heading', { name: 'Contenido del blog' })).toBeVisible()
  const blogPage = page.locator('.cms-page').filter({ has: page.locator('.blog-admin-grid') })
  await expect(blogPage.locator('.blog-list-panel')).toBeVisible()
  await expect(blogPage.locator('.blog-editor-panel')).toBeVisible()
  const blogNewButton = blogPage.locator('.blog-list-panel .panel-heading').getByRole('button', { name: 'Nuevo' })
  await expect(blogNewButton).toBeVisible()
  const blogDesktopColumns = await blogPage.locator('.blog-admin-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(columnCount(blogDesktopColumns)).toBe(2)

  await blogNewButton.focus()
  const blogFocus = await blogNewButton.evaluate((element) => {
    const style = getComputedStyle(element)
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth }
  })
  expect(blogFocus.outlineStyle).not.toBe('none')
  expect(blogFocus.outlineWidth).not.toBe('0px')

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoPageOverflow(page)
  const blogMobileColumns = await blogPage.locator('.blog-admin-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(columnCount(blogMobileColumns)).toBe(1)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const blogTransition = await blogNewButton.evaluate((element) => getComputedStyle(element).transitionDuration)
  expect(blogTransition.split(',').every((value) => durationInMs(value) <= 0.01)).toBe(true)

  await page.setViewportSize({ width: 820, height: 900 })
  await page.goto('/admin/multimedia')
  await expect(page.getByRole('heading', { name: 'Biblioteca de imágenes' })).toBeVisible()
  const mediaPage = page.locator('.cms-page').filter({ has: page.locator('.media-grid-admin') })
  await expect(mediaPage.locator('.media-toolbar-panel')).toBeVisible()
  await expect(page.getByPlaceholder('Nombre de archivo...')).toBeVisible()
  const mediaTabletColumns = await mediaPage.locator('.media-grid-admin').evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(columnCount(mediaTabletColumns)).toBe(2)
  await expectNoPageOverflow(page)

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoPageOverflow(page)
  const mediaMobileColumns = await mediaPage.locator('.media-grid-admin').evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(columnCount(mediaMobileColumns)).toBe(1)

  await page.goto('/admin/tarifas')
  await expect(page.getByRole('heading', { name: 'Planes y precios' })).toBeVisible()
  const pricingPage = page.locator('.cms-page').filter({ has: page.locator('.pricing-admin-list') })
  await expect(pricingPage.locator('.admin-settings-grid')).toBeVisible()
  await expect(pricingPage.locator('.pricing-admin-list')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Crear tarifa' })).toBeVisible()
  const pricingMobileColumns = await pricingPage.locator('.admin-settings-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(columnCount(pricingMobileColumns)).toBe(1)
  await expectNoPageOverflow(page)
})
