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
  const materialOrder = await page.evaluate(() => {
    const library = document.querySelector('.teacher-material-library') as HTMLElement | null
    const form = document.querySelector('.teacher-material-form') as HTMLElement | null
    return {
      libraryOrder: library ? Number.parseInt(getComputedStyle(library).order || '0', 10) : 0,
      formOrder: form ? Number.parseInt(getComputedStyle(form).order || '0', 10) : 0,
    }
  })
  expect(materialOrder.libraryOrder).toBeLessThan(materialOrder.formOrder)

  await page.goto('/profesor/tareas')
  const taskOrder = await page.evaluate(() => {
    const list = document.querySelector('.teacher-assignment-plan') as HTMLElement | null
    const form = document.querySelector('.teacher-assignment-form') as HTMLElement | null
    return {
      listOrder: list ? Number.parseInt(getComputedStyle(list).order || '0', 10) : 0,
      formOrder: form ? Number.parseInt(getComputedStyle(form).order || '0', 10) : 0,
    }
  })
  expect(taskOrder.listOrder).toBeLessThan(taskOrder.formOrder)

  await page.goto('/profesor/clases')
  const classOrder = await page.evaluate(() => {
    const agenda = document.querySelector('.teacher-class-agenda') as HTMLElement | null
    const create = document.querySelector('.teacher-class-create') as HTMLElement | null
    return {
      agendaOrder: agenda ? Number.parseInt(getComputedStyle(agenda).order || '0', 10) : 0,
      createOrder: create ? Number.parseInt(getComputedStyle(create).order || '0', 10) : 0,
    }
  })
  expect(classOrder.agendaOrder).toBeLessThan(classOrder.createOrder)

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
      const children = [...element.children] as HTMLElement[]
      return {
        columns: columns.length,
        minItemHeight: children.length ? Math.min(...children.map((child) => child.getBoundingClientRect().height)) : 72,
      }
    })
    expect(geometry.columns).toBe(2)
    expect(geometry.minItemHeight).toBeGreaterThanOrEqual(68)
    await expectNoHorizontalOverflow(page)
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/profesor/alumnos')
  const mobileColumns = await page.locator('.teacher-student-picker').evaluate((element) => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length)
  expect(mobileColumns).toBe(1)
  await expectNoHorizontalOverflow(page)
})
