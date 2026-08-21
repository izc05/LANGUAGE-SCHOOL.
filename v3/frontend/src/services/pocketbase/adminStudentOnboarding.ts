import type { CefrLevel } from './placementTest'
import { getCurrentUser } from './auth'
import { pb } from './client'
import {
  listAdminCourses,
  listAdminEnrollments,
  listAdminGroups,
  type AdminGroupRecord,
} from './adminAcademic'

export type StudentOnboardingLevelMode = 'UNEVALUATED' | 'TEST' | 'INITIAL'
export type StudentOnboardingStage = 'PREFLIGHT' | 'INVITATION' | 'LEVEL' | 'ENROLLMENT' | 'SEND'

export type StudentOnboardingGroupOption = {
  id: string
  name: string
  courseId: string
  courseTitle: string
  targetLevel: AdminGroupRecord['target_level']
  teacherId: string
  teacherName: string
  scheduleText: string
  deliveryMode: AdminGroupRecord['default_delivery_mode']
  capacity: number
  occupied: number
  availableSeats: number
  status: AdminGroupRecord['status']
}

export type StudentOnboardingCatalog = {
  courses: Awaited<ReturnType<typeof listAdminCourses>>
  groups: StudentOnboardingGroupOption[]
}

export type StudentOnboardingInvitation = {
  userId: string
  invitationId: string
  role?: 'STUDENT'
  status: 'PENDING'
  expiresAt: string
  activationUrl: string
  emailSent: boolean
}

export type CreateAdminStudentOnboardingInput = {
  email: string
  name: string
  surname: string
  phone?: string
  birthDate?: string
  guardianName?: string
  guardianPhone?: string
  notesPrivate?: string
  levelMode: StudentOnboardingLevelMode
  initialLevel?: CefrLevel | ''
  levelNotes?: string
  courseId: string
  groupId: string
  acknowledgeLevelMismatch?: boolean
  activationBaseUrl?: string
}

export type AdminStudentOnboardingResult = {
  userId: string
  profileId: string
  assessmentId: string | null
  enrollmentId: string
  invitation: StudentOnboardingInvitation
  group: StudentOnboardingGroupOption
  levelMode: StudentOnboardingLevelMode
  levelMismatch: boolean
}

type AtomicStudentOnboardingResponse = {
  userId: string
  profileId: string
  assessmentId: string | null
  enrollmentId: string
  studentStatus: 'INVITED'
  currentLevel: CefrLevel | ''
  targetLevel: AdminGroupRecord['target_level']
  levelMismatch: boolean
  courseId: string
  teacherId: string
  invitation: StudentOnboardingInvitation
}

export class AdminStudentOnboardingError extends Error {
  readonly stage: StudentOnboardingStage
  readonly userId: string | null
  readonly originalError: unknown

  constructor(stage: StudentOnboardingStage, message: string, userId: string | null, originalError?: unknown) {
    super(message)
    this.name = 'AdminStudentOnboardingError'
    this.stage = stage
    this.userId = userId
    this.originalError = originalError
  }
}

function requireAdmin() {
  const admin = getCurrentUser()
  if (!admin || admin.role !== 'ADMIN') throw new Error('Se requiere una sesión de administrador activa.')
  return admin
}

function activationBaseUrl(input?: string): string {
  const explicit = input?.trim().replace(/\/+$/, '') || ''
  if (explicit) return explicit
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

function teacherLabel(group: AdminGroupRecord): string {
  const teacher = group.expand?.teacher
  if (!teacher) return 'Profesor asignado'
  return `${teacher.name || ''} ${teacher.surname || ''}`.trim() || teacher.email
}

function onboardingErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error) {
    const response = 'response' in error ? (error as { response?: unknown }).response : null
    if (typeof response === 'object' && response && 'message' in response) {
      const message = (response as { message?: unknown }).message
      if (typeof message === 'string' && message.trim()) return message.trim()
    }
  }
  return 'No se ha podido completar el alta del alumno. No se ha guardado ningún alta parcial.'
}

export function hasStudentGroupLevelMismatch(level: CefrLevel | '', targetLevel: AdminGroupRecord['target_level']): boolean {
  return Boolean(level && targetLevel !== 'MIXED' && level !== targetLevel)
}

export async function loadAdminStudentOnboardingCatalog(): Promise<StudentOnboardingCatalog> {
  requireAdmin()
  const [courses, groups, enrollments] = await Promise.all([
    listAdminCourses(),
    listAdminGroups(),
    listAdminEnrollments(),
  ])
  const activeCourses = courses.filter((course) => course.status === 'ACTIVE')
  const activeCourseIds = new Set(activeCourses.map((course) => course.id))
  const occupancy = new Map<string, number>()
  enrollments.forEach((enrollment) => {
    if (enrollment.status !== 'ACTIVE') return
    occupancy.set(enrollment.group, (occupancy.get(enrollment.group) || 0) + 1)
  })

  return {
    courses: activeCourses,
    groups: groups
      .filter((group) => group.status === 'ACTIVE' && activeCourseIds.has(group.course))
      .map((group) => {
        const occupied = occupancy.get(group.id) || 0
        return {
          id: group.id,
          name: group.name,
          courseId: group.course,
          courseTitle: group.expand?.course?.title || group.expand?.course?.level || 'Curso',
          targetLevel: group.target_level,
          teacherId: group.teacher,
          teacherName: teacherLabel(group),
          scheduleText: group.schedule_text || 'Horario pendiente',
          deliveryMode: group.default_delivery_mode,
          capacity: group.capacity,
          occupied,
          availableSeats: Math.max(0, group.capacity - occupied),
          status: group.status,
        }
      }),
  }
}

export async function createAdminStudentOnboarding(input: CreateAdminStudentOnboardingInput): Promise<AdminStudentOnboardingResult> {
  requireAdmin()
  const catalog = await loadAdminStudentOnboardingCatalog()
  const group = catalog.groups.find((candidate) => candidate.id === input.groupId)
  if (!group || group.courseId !== input.courseId) {
    throw new AdminStudentOnboardingError('PREFLIGHT', 'El grupo seleccionado ya no está disponible para ese curso.', null)
  }
  if (group.availableSeats <= 0) {
    throw new AdminStudentOnboardingError('PREFLIGHT', 'El grupo seleccionado ya no tiene plazas disponibles.', null)
  }
  if (input.levelMode === 'INITIAL' && !input.initialLevel) {
    throw new AdminStudentOnboardingError('PREFLIGHT', 'Selecciona el nivel inicial del alumno.', null)
  }

  const chosenLevel = input.levelMode === 'INITIAL' ? (input.initialLevel || '') : ''
  const mismatch = hasStudentGroupLevelMismatch(chosenLevel, group.targetLevel)
  if (mismatch && !input.acknowledgeLevelMismatch) {
    throw new AdminStudentOnboardingError(
      'PREFLIGHT',
      `El nivel ${chosenLevel} no coincide con el nivel objetivo ${group.targetLevel}. Confirma expresamente la asignación para continuar.`,
      null,
    )
  }

  try {
    const response = await pb.send<AtomicStudentOnboardingResponse>(
      '/api/language-school/admin/student-onboarding/complete',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: input.email.trim().toLowerCase(),
          name: input.name.trim(),
          surname: input.surname.trim(),
          phone: input.phone?.trim() || '',
          birthDate: input.birthDate || '',
          guardianName: input.guardianName?.trim() || '',
          guardianPhone: input.guardianPhone?.trim() || '',
          notesPrivate: input.notesPrivate?.trim() || '',
          levelMode: input.levelMode,
          initialLevel: input.initialLevel || '',
          levelNotes: input.levelNotes?.trim() || '',
          expectedCourseId: input.courseId,
          targetGroupId: input.groupId,
          acknowledgeLevelMismatch: Boolean(input.acknowledgeLevelMismatch),
          activationBaseUrl: activationBaseUrl(input.activationBaseUrl),
        }),
      },
    )

    if (response.courseId !== group.courseId || response.teacherId !== group.teacherId) {
      throw new Error('La respuesta académica no coincide con el grupo confirmado.')
    }

    return {
      userId: response.userId,
      profileId: response.profileId,
      assessmentId: response.assessmentId,
      enrollmentId: response.enrollmentId,
      invitation: response.invitation,
      group,
      levelMode: input.levelMode,
      levelMismatch: response.levelMismatch,
    }
  } catch (error) {
    throw new AdminStudentOnboardingError('ENROLLMENT', onboardingErrorMessage(error), null, error)
  }
}
