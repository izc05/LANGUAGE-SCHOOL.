import { pb } from './client'
import type { CefrLevel, PlacementSkill, PlacementSkillScore } from './placementTest'

export type CampusPlacementSession = {
  attemptId: string
  mode: 'CAMPUS'
  totalQuestions: number
  algorithmVersion: string
  resumed?: boolean
}

export type CampusPlacementQuestion = {
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
    options: Array<{ id: string; label: string }>
  }
}

export type CampusPlacementQuestionComplete = {
  complete: true
  status: string
  answered?: number
  total?: number
}

export type CampusPlacementResult = {
  attemptId: string
  mode: 'CAMPUS'
  status: 'COMPLETED'
  algorithmVersion: string
  estimatedLevel: CefrLevel
  rawScore: number
  maxScore: number
  scorePercent: number
  skillScores: Record<PlacementSkill, PlacementSkillScore>
  completedAt: string
  notice: string
  startedAt?: string
}

export type CampusLevelAssessment = {
  automaticLevel: CefrLevel | ''
  speakingLevel: CefrLevel | ''
  validatedLevel: CefrLevel
  assessedAt: string
  reason: 'INITIAL' | 'REVIEW' | 'PROGRESS' | 'OTHER'
}

export type CampusLevelSummary = {
  currentLevel: CefrLevel | ''
  currentLevelSource: 'VALIDATED' | 'AUTOMATIC' | 'NONE'
  latestAttempt: CampusPlacementResult | null
  latestAssessment: CampusLevelAssessment | null
  history: CampusPlacementResult[]
  activeAttempt: {
    attemptId: string
    totalQuestions: number
    answered: number
    startedAt: string
  } | null
  retake: {
    allowed: boolean
    days: number
    nextAvailableAt: string
  }
  campusQuestionCount: number
}

const jsonHeaders = { 'Content-Type': 'application/json' }

export async function getCampusLevelSummary(): Promise<CampusLevelSummary> {
  return pb.send<CampusLevelSummary>('/api/language-school/placement/campus/summary', { method: 'GET' })
}

export async function startCampusPlacementTest(): Promise<CampusPlacementSession> {
  return pb.send<CampusPlacementSession>('/api/language-school/placement/start', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ mode: 'CAMPUS' }),
  })
}

export async function getNextCampusPlacementQuestion(session: CampusPlacementSession): Promise<CampusPlacementQuestion | CampusPlacementQuestionComplete> {
  return pb.send<CampusPlacementQuestion | CampusPlacementQuestionComplete>(
    `/api/language-school/placement/attempts/${encodeURIComponent(session.attemptId)}/question`,
    { method: 'GET' },
  )
}

export async function answerCampusPlacementQuestion(
  session: CampusPlacementSession,
  questionId: string,
  optionId: string,
): Promise<{ accepted: true; answered: number; total: number }> {
  return pb.send<{ accepted: true; answered: number; total: number }>(
    `/api/language-school/placement/attempts/${encodeURIComponent(session.attemptId)}/answer`,
    {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ questionId, optionId }),
    },
  )
}

export async function finishCampusPlacementTest(session: CampusPlacementSession): Promise<CampusPlacementResult> {
  return pb.send<CampusPlacementResult>(
    `/api/language-school/placement/attempts/${encodeURIComponent(session.attemptId)}/finish`,
    { method: 'POST', headers: jsonHeaders, body: '{}' },
  )
}
