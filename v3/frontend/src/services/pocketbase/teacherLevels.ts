import { pb } from './client'
import type { CefrLevel, PlacementSkill, PlacementSkillScore } from './placementTest'

export type TeacherLevelAttempt = {
  attemptId: string
  estimatedLevel: CefrLevel | ''
  scorePercent: number
  skillScores: Record<PlacementSkill, PlacementSkillScore>
  completedAt: string
  algorithmVersion: string
}

export type TeacherLevelAssessment = {
  assessmentId: string
  sourceAttemptId: string
  automaticLevel: CefrLevel | ''
  speakingLevel: CefrLevel | ''
  validatedLevel: CefrLevel
  notes: string
  assessedBy: string
  assessedAt: string
  reason: 'INITIAL' | 'REVIEW' | 'PROGRESS' | 'OTHER'
}

export type TeacherStudentLevelSummary = {
  student: { id: string; name: string; surname: string; email: string }
  currentLevel: CefrLevel | ''
  currentLevelSource: 'VALIDATED' | 'AUTOMATIC' | 'NONE'
  latestAttempt: TeacherLevelAttempt | null
  latestAssessment: TeacherLevelAssessment | null
  assessmentHistory: TeacherLevelAssessment[]
}

export async function getTeacherStudentLevelSummary(studentId: string): Promise<TeacherStudentLevelSummary> {
  return pb.send<TeacherStudentLevelSummary>(
    `/api/language-school/placement/teacher/students/${encodeURIComponent(studentId)}/summary`,
    { method: 'GET' },
  )
}

export async function validateTeacherStudentLevel(studentId: string, input: {
  sourceAttemptId?: string
  speakingLevel?: CefrLevel | ''
  validatedLevel: CefrLevel
  notes?: string
  reason?: TeacherLevelAssessment['reason']
}): Promise<{ assessment: TeacherLevelAssessment }> {
  return pb.send<{ assessment: TeacherLevelAssessment }>(
    `/api/language-school/placement/teacher/students/${encodeURIComponent(studentId)}/validate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceAttemptId: input.sourceAttemptId || '',
        speakingLevel: input.speakingLevel || '',
        validatedLevel: input.validatedLevel,
        notes: input.notes || '',
        reason: input.reason || 'REVIEW',
      }),
    },
  )
}
