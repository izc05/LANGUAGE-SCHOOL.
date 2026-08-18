import { pocketBaseUrl } from '../../config/environment'
import { pb } from './client'

export type PlacementSkill = 'GRAMMAR' | 'VOCABULARY' | 'READING' | 'LISTENING'
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export type PublicPlacementSession = {
  attemptId: string
  mode: 'PUBLIC'
  totalQuestions: number
  algorithmVersion: string
  token: string
}

export type PlacementOption = {
  id: string
  label: string
}

export type PublicPlacementQuestion = {
  complete: false
  attemptId: string
  position: number
  total: number
  answered: number
  question: {
    id: string
    skill: PlacementSkill
    prompt: string
    passage: string
    hasAudio?: boolean
    options: PlacementOption[]
  }
}

export type PublicPlacementQuestionComplete = {
  complete: true
  status: string
  answered?: number
  total?: number
}

export type PlacementSkillScore = {
  correct: number
  total: number
  percent: number
  diagnosticOnly?: boolean
}

export type PublicPlacementResult = {
  attemptId: string
  mode: 'PUBLIC'
  status: 'COMPLETED'
  algorithmVersion: string
  estimatedLevel: CefrLevel
  rawScore: number
  maxScore: number
  scorePercent: number
  skillScores: Partial<Record<PlacementSkill, PlacementSkillScore>>
  completedAt: string
  notice: string
  listeningDiagnosticOnly?: boolean
}

export type PlacementRecommendationCourse = {
  id: string
  title: string
  slug: string
  level: string
  description: string
  cefrLevels: CefrLevel[]
}

export type PublicPlacementRecommendations = {
  estimatedLevel: CefrLevel
  courses: PlacementRecommendationCourse[]
}

export type PublicPlacementContactInput = {
  name: string
  email: string
  phone?: string
  interest?: string
  message: string
}

function publicHeaders(token: string, json = false): Record<string, string> {
  return {
    'X-Placement-Token': token,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  }
}

function placementAudioUrl(attemptId: string, questionId: string): string {
  const base = pocketBaseUrl.replace(/\/$/, '')
  return `${base}/api/language-school/placement/attempts/${encodeURIComponent(attemptId)}/questions/${encodeURIComponent(questionId)}/audio`
}

export async function fetchPlacementAudio(attemptId: string, questionId: string, publicToken?: string): Promise<Blob> {
  const headers: Record<string, string> = {}
  if (publicToken) headers['X-Placement-Token'] = publicToken
  else if (pb.authStore.token) headers.Authorization = pb.authStore.token

  const response = await fetch(placementAudioUrl(attemptId, questionId), {
    method: 'GET',
    headers,
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('Placement audio unavailable')
  return response.blob()
}

export async function startPublicPlacementTest(): Promise<PublicPlacementSession> {
  return pb.send<PublicPlacementSession>('/api/language-school/placement/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'PUBLIC' }),
  })
}

export async function getNextPublicPlacementQuestion(
  session: PublicPlacementSession,
): Promise<PublicPlacementQuestion | PublicPlacementQuestionComplete> {
  return pb.send<PublicPlacementQuestion | PublicPlacementQuestionComplete>(
    `/api/language-school/placement/attempts/${encodeURIComponent(session.attemptId)}/question`,
    { method: 'GET', headers: publicHeaders(session.token) },
  )
}

export async function answerPublicPlacementQuestion(
  session: PublicPlacementSession,
  questionId: string,
  optionId: string,
): Promise<{ accepted: true; answered: number; total: number }> {
  return pb.send<{ accepted: true; answered: number; total: number }>(
    `/api/language-school/placement/attempts/${encodeURIComponent(session.attemptId)}/answer`,
    {
      method: 'POST',
      headers: publicHeaders(session.token, true),
      body: JSON.stringify({ questionId, optionId }),
    },
  )
}

export async function finishPublicPlacementTest(session: PublicPlacementSession): Promise<PublicPlacementResult> {
  return pb.send<PublicPlacementResult>(
    `/api/language-school/placement/attempts/${encodeURIComponent(session.attemptId)}/finish`,
    {
      method: 'POST',
      headers: publicHeaders(session.token, true),
      body: '{}',
    },
  )
}

export async function getPublicPlacementRecommendations(
  session: PublicPlacementSession,
): Promise<PublicPlacementRecommendations> {
  return pb.send<PublicPlacementRecommendations>(
    `/api/language-school/placement/attempts/${encodeURIComponent(session.attemptId)}/recommendations`,
    { method: 'GET', headers: publicHeaders(session.token) },
  )
}

export async function submitPublicPlacementContact(
  session: PublicPlacementSession,
  input: PublicPlacementContactInput,
): Promise<{ created: true }> {
  return pb.send<{ created: true }>(
    `/api/language-school/placement/attempts/${encodeURIComponent(session.attemptId)}/contact`,
    {
      method: 'POST',
      headers: publicHeaders(session.token, true),
      body: JSON.stringify({
        name: input.name.trim(),
        email: input.email.trim(),
        phone: input.phone?.trim() || '',
        interest: input.interest?.trim() || '',
        message: input.message.trim(),
      }),
    },
  )
}