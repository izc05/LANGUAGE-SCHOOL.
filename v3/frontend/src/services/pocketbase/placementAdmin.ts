import { pb } from './client'
import type { CefrLevel, PlacementSkill } from './placementTest'

export type PlacementAdminValidationRequirement = {
  skill: PlacementSkill
  level: CefrLevel
  required: number
  available: number
  ready: boolean
}

export type PlacementAdminValidation = {
  ready: boolean
  errors: string[]
  requirements: PlacementAdminValidationRequirement[]
  questionCount: number
  activeQuestionCount: number
}

export type PlacementAdminTest = {
  id: string
  name: string
  version: string
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  algorithmVersion: string
  publicQuestionCount: number
  campusQuestionCount: number
  campusRetakeDays: number
  publishedAt: string
  createdAt: string
  canEdit: boolean
  validation: PlacementAdminValidation
}

export type PlacementAdminQuestionOption = { id: string; label: string }

export type PlacementAdminQuestion = {
  id: string
  testId: string
  code: string
  skill: PlacementSkill
  cefrLevel: CefrLevel
  prompt: string
  passage: string
  options: PlacementAdminQuestionOption[]
  correctOptionId: string
  internalExplanation: string
  weight: number
  active: boolean
  adminOrder: number
}

const jsonHeaders = { 'Content-Type': 'application/json' }

export async function listPlacementAdminTests(): Promise<PlacementAdminTest[]> {
  const response = await pb.send<{ tests: PlacementAdminTest[] }>('/api/language-school/placement/admin/tests', { method: 'GET' })
  return response.tests
}

export async function createPlacementAdminDraft(input: { name: string; version: string; sourceTestId?: string }): Promise<PlacementAdminTest> {
  const response = await pb.send<{ test: PlacementAdminTest }>('/api/language-school/placement/admin/tests', {
    method: 'POST', headers: jsonHeaders, body: JSON.stringify(input),
  })
  return response.test
}

export async function updatePlacementAdminDraft(testId: string, input: { name?: string; version?: string; campusRetakeDays?: number }): Promise<PlacementAdminTest> {
  const response = await pb.send<{ test: PlacementAdminTest }>(`/api/language-school/placement/admin/tests/${encodeURIComponent(testId)}`, {
    method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(input),
  })
  return response.test
}

export async function deletePlacementAdminDraft(testId: string): Promise<void> {
  await pb.send(`/api/language-school/placement/admin/tests/${encodeURIComponent(testId)}`, { method: 'DELETE' })
}

export async function listPlacementAdminQuestions(testId: string): Promise<{ test: PlacementAdminTest; questions: PlacementAdminQuestion[] }> {
  return pb.send(`/api/language-school/placement/admin/tests/${encodeURIComponent(testId)}/questions`, { method: 'GET' })
}

export async function createPlacementAdminQuestion(testId: string, input: Omit<PlacementAdminQuestion, 'id' | 'testId'>): Promise<PlacementAdminQuestion> {
  const response = await pb.send<{ question: PlacementAdminQuestion }>(`/api/language-school/placement/admin/tests/${encodeURIComponent(testId)}/questions`, {
    method: 'POST', headers: jsonHeaders, body: JSON.stringify(input),
  })
  return response.question
}

export async function updatePlacementAdminQuestion(questionId: string, input: Omit<PlacementAdminQuestion, 'id' | 'testId'>): Promise<PlacementAdminQuestion> {
  const response = await pb.send<{ question: PlacementAdminQuestion }>(`/api/language-school/placement/admin/questions/${encodeURIComponent(questionId)}`, {
    method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(input),
  })
  return response.question
}

export async function deletePlacementAdminQuestion(questionId: string): Promise<void> {
  await pb.send(`/api/language-school/placement/admin/questions/${encodeURIComponent(questionId)}`, { method: 'DELETE' })
}

export async function publishPlacementAdminTest(testId: string): Promise<PlacementAdminTest> {
  const response = await pb.send<{ test: PlacementAdminTest }>(`/api/language-school/placement/admin/tests/${encodeURIComponent(testId)}/publish`, {
    method: 'POST', headers: jsonHeaders, body: '{}',
  })
  return response.test
}
