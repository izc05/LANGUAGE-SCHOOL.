import { expect, test, type Locator, type Page } from '@playwright/test'
import { enterHome } from '../helpers/intro'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

const adminEmail = requiredEnv('E2E_ADMIN_EMAIL')
const adminPassword = requiredEnv('E2E_ADMIN_PASSWORD')

async function loginAdmin(page: Page) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(adminEmail)
  await page.getByLabel('Contraseña').fill(adminPassword)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

async function expectNoHorizontalPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

function cardByText(page: Page, selector: string, text: string): Locator {
  return page.locator(selector).filter({ hasText: text }).first()
}

test('H1 de Home se publica desde Admin y recupera el fallback premium', async ({ page }) => {
  await loginAdmin(page)
  await page.goto('/admin/web')

  const title = page.getByLabel('Título principal')
  await title.fill('E2E Home editable title')
  await page.getByRole('button', { name: 'Guardar y publicar' }).click()
  await expect(page.locator('.cms-notice.success-notice')).toContainText('Portada e imágenes publicadas correctamente.')

  await enterHome(page)
  await expect(page.locator('.hero-copy h1')).toHaveText('E2E Home editable title')

  await page.goto('/admin/web')
  await page.getByLabel('Título principal').fill('')
  await page.getByRole('button', { name: 'Guardar y publicar' }).click()
  await expect(page.locator('.cms-notice.success-notice')).toContainText('Portada e imágenes publicadas correctamente.')

  await enterHome(page)
  await expect(page.locator('.hero-copy h1')).toHaveText('Inglés para cada etapa de tu vida.')
})

test('un curso existente se edita, persiste y controla listado y ficha pública', async ({ page }) => {
  await loginAdmin(page)
  await page.goto('/admin/cursos')

  let courseCard = cardByText(page, '.course-admin-card', 'E2E English B1')
  await courseCard.getByRole('button', { name: 'Editar curso' }).click()
  let editor = page.getByRole('form', { name: 'Editar curso E2E English B1' })
  await editor.getByLabel('Título del curso').fill('E2E English B1 Updated')
  await editor.getByLabel('Slug del curso').fill('e2e-english-b1-updated')
  await editor.getByLabel('Nivel del curso').fill('B1+')
  await editor.getByLabel('Descripción del curso').fill('Browser test course updated')
  await editor.getByLabel('Visibilidad pública').selectOption('PRIVATE')
  await editor.getByRole('button', { name: 'Guardar curso' }).click()
  await expect(page.locator('.cms-notice.success-notice')).toContainText('Curso actualizado correctamente.')

  await page.reload()
  courseCard = cardByText(page, '.course-admin-card', 'E2E English B1 Updated')
  await expect(courseCard).toContainText('B1+')
  await expect(courseCard).toContainText('Web pública')
  await expect(courseCard).toContainText('No')

  await page.goto('/programas')
  await expect(page.getByText('E2E English B1 Updated', { exact: true })).toHaveCount(0)
  await page.goto('/programas/e2e-english-b1-updated')
  await expect(page.getByRole('heading', { level: 1, name: 'No hemos encontrado este programa.' })).toBeVisible()

  await page.goto('/admin/cursos')
  courseCard = cardByText(page, '.course-admin-card', 'E2E English B1 Updated')
  await courseCard.getByRole('button', { name: 'Editar curso' }).click()
  editor = page.getByRole('form', { name: 'Editar curso E2E English B1 Updated' })
  await editor.getByLabel('Visibilidad pública').selectOption('PUBLIC')
  await editor.getByRole('button', { name: 'Guardar curso' }).click()
  await expect(page.locator('.cms-notice.success-notice')).toContainText('Curso actualizado correctamente.')

  await page.goto('/programas')
  await expect(page.getByText('E2E English B1 Updated', { exact: true })).toBeVisible()
  await expect(page.getByText('B1+', { exact: true })).toBeVisible()
  await expect(page.getByText('Browser test course updated', { exact: true })).toBeVisible()
  const publicCourse = cardByText(page, '.programs-v2-course', 'E2E English B1 Updated')
  await publicCourse.getByRole('link', { name: 'Ver ficha del programa' }).click()
  await expect(page).toHaveURL(/\/programas\/e2e-english-b1-updated$/)
  await expect(page.getByRole('heading', { level: 1, name: 'E2E English B1 Updated' })).toBeVisible()
  await expect(page.getByText('B1+', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Browser test course updated', { exact: true })).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('link', { name: 'Quiero información' })).toBeVisible()
  await expectNoHorizontalPageOverflow(page)
  await page.setViewportSize({ width: 1280, height: 900 })

  await page.goto('/admin/cursos')
  courseCard = cardByText(page, '.course-admin-card', 'E2E English B1 Updated')
  await courseCard.getByRole('button', { name: 'Editar curso' }).click()
  editor = page.getByRole('form', { name: 'Editar curso E2E English B1 Updated' })
  await editor.getByLabel('Título del curso').fill('E2E English B1')
  await editor.getByLabel('Slug del curso').fill('e2e-english-b1')
  await editor.getByLabel('Nivel del curso').fill('B1')
  await editor.getByLabel('Descripción del curso').fill('Browser test course')
  await editor.getByLabel('Visibilidad pública').selectOption('PUBLIC')
  await editor.getByRole('button', { name: 'Guardar curso' }).click()
  await expect(page.locator('.cms-notice.success-notice')).toContainText('Curso actualizado correctamente.')
})

test('una tarifa existente cambia de 45 a 49 euros sin recrearla y se refleja en la web', async ({ page }) => {
  await loginAdmin(page)
  await page.goto('/admin/tarifas')

  let planCard = cardByText(page, '.pricing-admin-card', 'E2E Monthly')
  await planCard.getByRole('button', { name: 'Editar', exact: true }).click()
  let editor = page.getByRole('form', { name: 'Editar tarifa E2E Monthly' })
  await editor.getByLabel('Precio de tarifa (€)').fill('49')
  await editor.getByLabel('Periodo de tarifa').fill('por mes')
  await editor.getByLabel('Descripción de tarifa').fill('Tarifa E2E actualizada desde Admin.')
  await editor.getByLabel('Características de tarifa').fill('Clases\nMaterial\nSeguimiento\nFeedback')
  await editor.getByLabel('Orden de tarifa').fill('15')
  await editor.getByLabel('Visible en la web').check()
  await editor.getByLabel('Tarifa destacada').uncheck()
  await editor.getByRole('button', { name: 'Guardar tarifa' }).click()
  await expect(page.locator('.cms-notice.success-notice')).toContainText('Tarifa actualizada correctamente.')

  await page.reload()
  planCard = cardByText(page, '.pricing-admin-card', 'E2E Monthly')
  await expect(planCard).toContainText('49 €')
  await expect(planCard).toContainText('por mes')

  await page.goto('/tarifas')
  const publicPlan = cardByText(page, '.pricing-v2-card', 'E2E Monthly')
  await expect(publicPlan).toContainText('49 €')
  await expect(publicPlan).toContainText('Tarifa E2E actualizada desde Admin.')
  await expect(publicPlan).toContainText('Feedback')

  await page.goto('/admin/tarifas')
  planCard = cardByText(page, '.pricing-admin-card', 'E2E Monthly')
  await planCard.getByRole('button', { name: 'Editar', exact: true }).click()
  editor = page.getByRole('form', { name: 'Editar tarifa E2E Monthly' })
  await editor.getByLabel('Precio de tarifa (€)').fill('45')
  await editor.getByLabel('Periodo de tarifa').fill('al mes')
  await editor.getByLabel('Descripción de tarifa').fill('Tarifa publicada por la prueba de navegador.')
  await editor.getByLabel('Características de tarifa').fill('Clases\nMaterial\nSeguimiento')
  await editor.getByLabel('Orden de tarifa').fill('10')
  await editor.getByLabel('Visible en la web').check()
  await editor.getByLabel('Tarifa destacada').check()
  await editor.getByRole('button', { name: 'Guardar tarifa' }).click()
  await expect(page.locator('.cms-notice.success-notice')).toContainText('Tarifa actualizada correctamente.')
})

test('Blog publica detalle por slug, bloquea drafts y mantiene responsive básico', async ({ page }) => {
  await loginAdmin(page)
  await page.goto('/admin/blog')

  let editor = page.locator('.blog-editor-panel')
  await editor.getByLabel('Título').fill('E2E Article Detail')
  await editor.getByLabel('Resumen').fill('Resumen E2E del artículo.')
  await editor.getByLabel('Contenido').fill('Primer párrafo E2E.\n\nSegundo párrafo E2E.')
  await editor.getByRole('button', { name: 'Publicar' }).click()
  await expect(page.locator('.cms-notice.success-notice')).toContainText('Artículo publicado correctamente.')

  await page.goto('/blog')
  const publishedCard = page.locator('article').filter({ hasText: 'E2E Article Detail' }).first()
  await expect(publishedCard).toBeVisible()
  await publishedCard.getByRole('link', { name: 'Leer artículo →' }).click()
  await expect(page).toHaveURL(/\/blog\/e2e-article-detail$/)
  await expect(page.getByRole('heading', { level: 1, name: 'E2E Article Detail' })).toBeVisible()
  await expect(page.getByText('Primer párrafo E2E.', { exact: true })).toBeVisible()
  await expect(page.getByText('Segundo párrafo E2E.', { exact: true })).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('link', { name: 'Volver al blog' })).toBeVisible()
  await expectNoHorizontalPageOverflow(page)
  await page.setViewportSize({ width: 1280, height: 900 })

  await page.goto('/admin/blog')
  editor = page.locator('.blog-editor-panel')
  await editor.getByLabel('Título').fill('E2E Hidden Draft')
  await editor.getByLabel('Contenido').fill('Contenido que nunca debe verse públicamente.')
  await editor.getByRole('button', { name: 'Guardar borrador' }).click()
  await expect(page.locator('.cms-notice.success-notice')).toContainText('Borrador guardado correctamente.')

  await page.goto('/blog/e2e-hidden-draft')
  await expect(page.getByRole('heading', { level: 1, name: 'Artículo no disponible.' })).toBeVisible()
  await expect(page.getByText('Contenido que nunca debe verse públicamente.')).toHaveCount(0)

  await page.goto('/admin/blog')
  let post = cardByText(page, '.admin-post-list article', 'E2E Article Detail')
  await post.getByRole('button', { name: 'Editar' }).click()
  page.once('dialog', (dialog) => void dialog.accept())
  await page.locator('.blog-editor-panel').getByRole('button', { name: 'Eliminar' }).click()
  await expect(page.locator('.cms-notice.success-notice')).toContainText('Artículo eliminado correctamente.')

  post = cardByText(page, '.admin-post-list article', 'E2E Hidden Draft')
  await post.getByRole('button', { name: 'Editar' }).click()
  page.once('dialog', (dialog) => void dialog.accept())
  await page.locator('.blog-editor-panel').getByRole('button', { name: 'Eliminar' }).click()
  await expect(page.locator('.cms-notice.success-notice')).toContainText('Artículo eliminado correctamente.')
})
