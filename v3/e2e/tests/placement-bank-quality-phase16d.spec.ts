import { expect, test, type APIRequestContext } from '@playwright/test'

const PB_URL = 'http://127.0.0.1:8090'
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const SKILLS = ['GRAMMAR', 'VOCABULARY', 'READING']

function env(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

async function auth(request: APIRequestContext) {
  const response = await request.post(`${PB_URL}/api/collections/users/auth-with-password`, {
    data: { identity: env('E2E_ADMIN_EMAIL'), password: env('E2E_ADMIN_PASSWORD') },
  })
  expect(response.status()).toBe(200)
  return response.json() as Promise<{ token: string }>
}

test('16D: banco propio mantiene cobertura MCER y distractores refinados', async ({ request }) => {
  const admin = await auth(request)
  const testsResponse = await request.get(`${PB_URL}/api/language-school/placement/admin/tests`, {
    headers: { Authorization: admin.token },
  })
  expect(testsResponse.status()).toBe(200)
  const tests = (await testsResponse.json() as {
    tests: Array<{ id: string; version: string; validation: { questionCount: number } }>
  }).tests
  const baseline = tests.find((item) => item.version === 'ls-cefr-2026-v1')
  expect(baseline).toBeTruthy()
  if (!baseline) throw new Error('Baseline placement bank is missing')

  const questionsResponse = await request.get(`${PB_URL}/api/language-school/placement/admin/tests/${baseline.id}/questions`, {
    headers: { Authorization: admin.token },
  })
  expect(questionsResponse.status()).toBe(200)
  const questions = (await questionsResponse.json() as {
    questions: Array<{
      code: string
      skill: string
      cefrLevel: string
      prompt: string
      options: Array<{ id: string; label: string }>
      correctOptionId: string
    }>
  }).questions

  expect(questions).toHaveLength(72)
  for (const skill of SKILLS) {
    for (const level of LEVELS) {
      const cell = questions.filter((question) => question.skill === skill && question.cefrLevel === level)
      expect(cell, `${skill}:${level}`).toHaveLength(4)
      expect(new Set(cell.map((question) => question.correctOptionId))).toEqual(new Set(['a', 'b', 'c', 'd']))
    }
  }

  const byCode = new Map(questions.map((question) => [question.code, question]))
  const optionLabels = (code: string) => (byCode.get(code)?.options || []).map((option) => option.label)

  expect(byCode.get('vo-b1-01')?.prompt).toContain('until Friday')
  expect(optionLabels('vo-b1-01')).toEqual(expect.arrayContaining(['put off', 'set up', 'carry out', 'bring forward']))
  expect(byCode.get('vo-b2-01')?.prompt).toContain('down on unnecessary paperwork')
  expect(optionLabels('vo-b2-01')).toEqual(expect.arrayContaining(['cut', 'bring', 'take', 'keep']))
  expect(byCode.get('vo-c1-04')?.prompt).toContain('without shortening the article')
  expect(optionLabels('vo-c1-04')).toEqual(expect.arrayContaining(['refine', 'condense', 'retract', 'compile']))
  expect(byCode.get('gr-c2-03')?.prompt).toContain('Had the warning been taken seriously')
  expect(optionLabels('gr-c2-03')).toContain('might have been avoided')
})
