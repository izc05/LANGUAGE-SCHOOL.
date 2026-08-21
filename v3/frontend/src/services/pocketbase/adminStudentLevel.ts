import { pb } from './client'
import type { CefrLevel } from './placementTest'
import type { PlacementAdminAssessment } from './placementAdmin'

export type AdminStudentLevelAttempt = {
  id: string
  estimatedLevel: CefrLevel | ''
  scorePercent: number
  skillScores: Record<string, unknown>
  completedAt: string
  algorithmVersion: string
}

export type AdminStudentLevelSummary = {
  student: {
    id: string
    name: string
    surname: string
    email: string
    status: string
  }
  currentLevel: CefrLevel | ''
  currentLevelSource: 'VALIDATED' | 'AUTOMATIC' | 'NONE'
  latestAttempt: AdminStudentLevelAttempt | null
  latestAssessment: PlacementAdminAssessment | null
  assessmentHistory: PlacementAdminAssessment[]
}

export type CreateAdminStudentLevelAssessmentInput = {
  validatedLevel: CefrLevel
  speakingLevel?: CefrLevel | ''
  reason: 'INITIAL' | 'REVIEW' | 'PROGRESS' | 'OTHER'
  notes?: string
  sourceAttemptId?: string
}

const jsonHeaders = { 'Content-Type': 'application/json' }

export async function getAdminStudentLevelSummary(studentId: string): Promise<AdminStudentLevelSummary> {
  return pb.send<AdminStudentLevelSummary>(
    `/api/language-school/placement/admin/students/${encodeURIComponent(studentId)}/summary`,
    { method: 'GET' },
  )
}

export async function createAdminStudentLevelAssessment(
  studentId: string,
  input: CreateAdminStudentLevelAssessmentInput,
): Promise<{ assessment: PlacementAdminAssessment; summary: AdminStudentLevelSummary }> {
  return pb.send(
    `/api/language-school/placement/admin/students/${encodeURIComponent(studentId)}/assessments`,
    {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(input),
    },
  )
}