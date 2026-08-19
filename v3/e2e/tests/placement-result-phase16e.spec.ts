import { expect, test } from '@playwright/test'

const attemptId = 'mock-result-16e'
const placementBase = `**/api/language-school/placement/attempts/${attemptId}`
const skills = ['GRAMMAR', 'VOCABULARY', 'READING'] as const

async function mockProgressiveResult(page: import('@playwright/test').Page) {
  let answered = 0

  await page.route('**/api/language-school/placement/start', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        attemptId,
        mode: 'PUBLIC',
        totalQuestions: 12,
        algorithmVersion: 'cefr-v3-progressive',
        token: 'mock-token-16e',
      }),
    })
  })

  await page.route(`${placementBase}/question`, async (route) => {
    if (answered >= 12) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ complete: true, status: 'IN_PROGRESS', answered: 12, total: 12 }),
      })
      return
    }

    const position = answered + 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        complete: false,
        attemptId,
        position,
        total: 12,
        answered,
        question: {
          id: `mock-question-${position}`,
          skill: skills[answered % skills.length],
          prompt: `Pregunta de prueba ${position}`,
          passage: '',
          options: [
            { id: 'a', label: 'Respuesta A' },
            { id: 'b', label: 'Respuesta B' },
            { id: 'c', label: 'Respuesta C' },
            { id: 'd', label: 'Respuesta D' },
          ],
        },
      }),
    })
  })

  await page.route(`${placementBase}/answer`, async (route) => {
    answered += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accepted: true, answered, total: 12 }),
    })
  })

  await page.route(`${placementBase}/finish`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        attemptId,
        mode: 'PUBLIC',
        status: 'COMPLETED',
        algorithmVersion: 'cefr-v3-progressive',
        estimatedLevel: 'B2',
        rawScore: 9,
        maxScore: 12,
        scorePercent: 75,
        skillScores: {
          GRAMMAR: { correct: 3, total: 4, percent: 75 },
          VOCABULARY: { correct: 4, total: 4, percent: 100 },
          READING: { correct: 2, total: 4, percent: 50 },
        },
        completedAt: '2026-08-19 21:00:00.000Z',
        notice: 'Resultado orientativo basado en una ruta progresiva MCER; la academia puede validarlo posteriormente.',
      }),
    })
  })

  await page.route(`${placementBase}/recommendations`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ estimatedLevel: 'B2', courses: [] }),
    })
  })
}

async function completeMockTest(page: import('@playwright/test').Page) {
  await page.goto('/test-de-nivel')
  await page.getByRole('button', { name: 'Empezar test' }).click()

  for (let position = 1; position <= 12; position += 1) {
    await expect(page.getByText(`Pregunta ${position} de 12`)).toBeVisible()
    await page.getByText('Respuesta A', { exact: true }).click()
    await page.getByRole('button', { name: position === 12 ? 'Ver mi resultado' : 'Confirmar respuesta' }).click()
  }
}

test('16E: resultado prioriza nivel MCER, fortalezas, refuerzo y speaking docente', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await mockProgressiveResult(page)
  await completeMockTest(page)

  await expect(page.getByRole('heading', { name: 'Tu nivel estimado es B2.' })).toBeVisible()
  await expect(page.getByText('El nivel no sale solo del porcentaje.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Lo que ya está sosteniendo tu nivel.' })).toBeVisible()
  await expect(page.locator('.placement-result-insight-card.is-strength')).toContainText('Vocabulario')
  await expect(page.getByRole('heading', { name: 'Dónde puede estar tu siguiente mejora.' })).toBeVisible()
  await expect(page.locator('.placement-result-insight-card.is-focus')).toContainText('Comprensión lectora')
  await expect(page.getByRole('heading', { name: 'Speaking requiere valoración docente.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Programas que encajan con tu B2.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Quiero que me orientéis' })).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('16E: resultado premium conserva lectura y acciones en móvil', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockProgressiveResult(page)
  await completeMockTest(page)

  await expect(page.getByRole('heading', { name: 'Tu nivel estimado es B2.' })).toBeVisible()
  await expect(page.getByText('Aciertos del recorrido · 9 de 12')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Speaking requiere valoración docente.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Quiero que me orientéis' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Repetir el test' })).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
