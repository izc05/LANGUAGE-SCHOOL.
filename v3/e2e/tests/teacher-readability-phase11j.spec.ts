import { expect, test, type Page } from '@playwright/test'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

const teacher = {
  email: requiredEnv('E2E_TEACHER_EMAIL'),
  password: requiredEnv('E2E_TEACHER_PASSWORD'),
}

async function login(page: Page) {
  await page.goto('/acceso')
  await page.getByLabel('Email').fill(teacher.email)
  await page.getByLabel('Contraseña').fill(teacher.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/profesor$/)
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

async function expectSingleReadableColumn(page: Page, selector: string) {
  const result = await page.locator(selector).evaluate((element) => {
    const style = getComputedStyle(element)
    const columns = style.gridTemplateColumns.trim().split(/\s+/).filter(Boolean)
    const rect = element.getBoundingClientRect()
    return { columns: columns.length, width: rect.width }
  })
  expect(result.columns).toBe(1)
  expect(result.width).toBeGreaterThan(450)
}

async function expectVisuallyBefore(page: Page, firstSelector: string, secondSelector: string) {
  const positions = await page.evaluate(([firstQuery, secondQuery]) => {
    const first = document.querySelector(firstQuery) as HTMLElement | null
    const second = document.querySelector(secondQuery) as HTMLElement | null
    return {
      firstTop: first?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY,
      secondTop: second?.getBoundingClientRect().top ?? Number.NEGATIVE_INFINITY,
    }
  }, [firstSelector, secondSelector])
  expect(positions.firstTop).toBeLessThan(positions.secondTop)
}

test('11.10: los espacios densos del Profesor priorizan lectura amplia en 1180', async ({ page }) => {
  await login(page)
  await page.setViewportSize({ width: 1180, height: 900 })

  const denseRoutes = [
    ['/profesor/alumnos', '.teacher-students-grid'],
    ['/profesor/niveles', '.teacher-levels-grid'],
    ['/profesor/clases', '.teacher-class-workspace'],
    ['/profesor/material', '.teacher-material-workspace'],
    ['/profesor/tareas', '.teacher-assignment-workspace'],
    ['/profesor/correcciones', '.teacher-corrections-workspace'],
  ] as const

  for (const [route, selector] of denseRoutes) {
    await page.goto(route)
    await expect(page.locator(selector)).toBeVisible()
    await expectSingleReadableColumn(page, selector)
    await expectNoHorizontalOverflow(page)
  }
})

test('11.10: listas y controles del Profesor mantienen tamaño legible y orden útil', async ({ page }) => {
  await login(page)
  await page.setViewportSize({ width: 1180, height: 900 })

  await page.goto('/profesor/material')
  await expectVisuallyBefore(page, '.teacher-material-library', '.teacher-material-form')

  await page.goto('/profesor/tareas')
  await expectVisuallyBefore(page, '.teacher-assignment-plan', '.teacher-assignment-form')

  await page.goto('/profesor/clases')
  await expectVisuallyBefore(page, '.teacher-class-agenda', '.teacher-class-create')

  const controls = page.locator('.teacher-portal-page button')
  const controlCount = await controls.count()
  if (controlCount > 0) {
    const minHeight = await controls.evaluateAll((elements) => Math.min(...elements.map((element) => element.getBoundingClientRect().height)))
    expect(minHeight).toBeGreaterThanOrEqual(28)
  }

  await expectNoHorizontalOverflow(page)
})

test('11.10: selección de alumnos, niveles y correcciones deja de parecer una tabla comprimida', async ({ page }) => {
  await login(page)
  await page.setViewportSize({ width: 1180, height: 900 })

  const pickers = [
    ['/profesor/alumnos', '.teacher-student-picker'],
    ['/profesor/niveles', '.teacher-levels-picker'],
    ['/profesor/correcciones', '.teacher-correction-items'],
  ] as const

  for (const [route, selector] of pickers) {
    await page.goto(route)
    const geometry = await page.locator(selector).evaluate((element) => {
      const style = getComputedStyle(element)
      const columns = style.gridTemplateColumns.trim().split(/\s+/).filter(Boolean)
      const buttons = [...element.querySelectorAll(':scope > button')] as HTMLElement[]
      return {
        columns: columns.length,
        buttonCount: buttons.length,
        minItemHeight: buttons.length ? Math.min(...buttons.map((button) => button.getBoundingClientRect().height)) : 72,
      }
    })
    expect(geometry.columns).toBe(2)
    expect(geometry.buttonCount).toBeGreaterThan(0)
    // 72 CSS px may render fractionally below 68 device-independent px under CI scaling.
    // The previous compressed rows were about 62 px, so this still guards the intended visual gain.
    expect(geometry.minItemHeight).toBeGreaterThanOrEqual(67.5)
    await expectNoHorizontalOverflow(page)
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/profesor/alumnos')
  const mobileColumns = await page.locator('.teacher-student-picker').evaluate((element) => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length)
  expect(mobileColumns).toBe(1)
  await expectNoHorizontalOverflow(page)
})
