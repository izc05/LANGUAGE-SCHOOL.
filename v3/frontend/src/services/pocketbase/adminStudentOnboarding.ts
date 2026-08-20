import type { RecordModel } from 'pocketbase'
import type { CefrLevel } from './placementTest'
import { getCurrentUser } from './auth'
import { pb } from './client'
import {
  listAdminCourses,
  listAdminEnrollments,
  listAdminGroups,
  type AdminEnrollmentRecord,
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

export type StudentOnboardingAssessment = RecordModel & {
  student: string
  source_attempt: string
  automatic_level: CefrLevel | ''
  speaking_level: CefrLevel | ''
  validated_level: CefrLevel
  notes: string
  assessed_by: string
  assessed_at: string
  reason: 'INITIAL'
}

type StudentOnboardingEnrollmentResponse = {
  currentId: string
  unchanged: boolean
  studentStatus: 'INVITED' | 'ACTIVE'
  currentLevel: CefrLevel | ''
  targetLevel: AdminGroupRecord['target_level']
  levelMismatch: boolean
  courseId: string
  teacherId: string
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
  invitation: StudentOnboardingInvitation
  assessment: StudentOnboardingAssessment | null
  enrollment: AdminEnrollmentRecord
  group: StudentOnboardingGroupOption
  levelMode: StudentOnboardingLevelMode
  levelMismatch: boolean
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

async function createStudentInvitation(input: CreateAdminStudentOnboardingInput): Promise<StudentOnboardingInvitation> {
  return pb.send<StudentOnboardingInvitation>('/api/language-school/admin/accounts/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role: 'STUDENT',
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
      surname: input.surname.trim(),
      phone: input.phone?.trim() || '',
      birthDate: input.birthDate || '',
      guardianName: input.guardianName?.trim() || '',
      guardianPhone: input.guardianPhone?.trim() || '',
      notesPrivate: input.notesPrivate?.trim() || '',
      activationBaseUrl: '',
    }),
  })
}

async function createInitialAssessment(studentId: string, level: CefrLevel, notes: string): Promise<StudentOnboardingAssessment> {
  const admin = requireAdmin()
  return pb.collection('student_level_assessments').create<StudentOnboardingAssessment>({
    student: studentId,
    source_attempt: '',
    automatic_level: '',
    speaking_level: '',
    validated_level: level,
    notes: notes.trim(),
    assessed_by: admin.id,
    assessed_at: new Date().toISOString(),
    reason: 'INITIAL',
  })
}

async function createInitialEnrollment(input: {
  studentId: string
  groupId: string
  courseId: string
  acknowledgeLevelMismatch: boolean
}): Promise<{ response: StudentOnboardingEnrollmentResponse; record: AdminEnrollmentRecord }> {
  const response = await pb.send<StudentOnboardingEnrollmentResponse>(
    '/api/language-school/admin/academic/enrollments/onboard',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: input.studentId,
        targetGroupId: input.groupId,
        expectedCourseId: input.courseId,
        acknowledgeLevelMismatch: input.acknowledgeLevelMismatch,
      }),
    },
  )
  const record = await pb.collection('enrollments').getOne<AdminEnrollmentRecord>(response.currentId, {
    expand: 'student,group,group.course,group.teacher',
  })
  return { response, record }
}

async function sendFinalInvitation(userId: string, baseUrl: string): Promise<StudentOnboardingInvitation> {
  return pb.send<StudentOnboardingInvitation>('/api/language-school/admin/accounts/invite/resend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, activationBaseUrl: baseUrl }),
  })
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

  let userId: string | null = null
  let assessment: StudentOnboardingAssessment | null = null
  let enrollment: AdminEnrollmentRecord
  let enrollmentResponse: StudentOnboardingEnrollmentResponse
  let invitation: StudentOnboardingInvitation

  try {
    const created = await createStudentInvitation(input)
    userId = created.userId
  } catch (error) {
    throw new AdminStudentOnboardingError('INVITATION', 'No se ha podido crear la cuenta invitada del alumno.', null, error)
  }

  if (input.levelMode === 'INITIAL' && chosenLevel) {
    try {
      assessment = await createInitialAssessment(userId, chosenLevel, input.levelNotes || '')
    } catch (error) {
      throw new AdminStudentOnboardingError('LEVEL', 'La cuenta se ha creado, pero no se ha podido registrar el nivel inicial.', userId, error)
    }
  }

  try {
    const created = await createInitialEnrollment({
      studentId: userId,
      groupId: input.groupId,
      courseId: input.courseId,
      acknowledgeLevelMismatch: Boolean(input.acknowledgeLevelMismatch),
    })
    enrollment = created.record
    enrollmentResponse = created.response
  } catch (error) {
    throw new AdminStudentOnboardingError('ENROLLMENT', 'La cuenta se ha creado, pero no se ha podido completar la matrícula.', userId, error)
  }

  try {
    invitation = await sendFinalInvitation(userId, activationBaseUrl(input.activationBaseUrl))
  } catch (error) {
    throw new AdminStudentOnboardingError('SEND', 'La ficha académica está preparada, pero no se ha podido emitir la invitación final.', userId, error)
  }

  return {
    userId,
    invitation,
    assessment,
    enrollment,
    group,
    levelMode: input.levelMode,
    levelMismatch: enrollmentResponse.levelMismatch,
  }
}
