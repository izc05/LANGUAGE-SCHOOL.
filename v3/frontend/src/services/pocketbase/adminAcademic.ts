import type { RecordModel } from 'pocketbase'
import { getCurrentUser } from './auth'
import { collections } from './collections'
import { pb } from './client'
import type { AppUser, UserRole, UserStatus } from './types'
import type { AttendanceRecord, ClassRecord, CourseRecord, GroupDeliveryMode, GroupRecord, GroupTargetLevel } from './studentPortal'
import type { TeacherProfileRecord } from './teacherPortal'

export type AdminStudentProfileRecord = RecordModel & {
  user: string
  birth_date: string
  guardian_name: string
  guardian_phone: string
  notes_private: string
  active: boolean
}

export type AdminEnrollmentRecord = RecordModel & {
  student: string
  group: string
  status: 'ACTIVE' | 'PAUSED' | 'FINISHED' | 'CANCELLED'
  joined_at: string
  ended_at: string
  expand?: {
    student?: AppUser
    group?: GroupRecord
  }
}

export type AdminGroupRecord = GroupRecord & {
  expand?: {
    course?: CourseRecord
    teacher?: AppUser
  }
}

type AdminEnrollmentMoveResponse = {
  previousId: string | null
  currentId: string
  unchanged: boolean
}

function requireAdmin() {
  const user = getCurrentUser()
  if (!user || user.role !== 'ADMIN') throw new Error('Se requiere una sesión de administrador activa.')
  return user
}

function quote(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

async function requestAdminEnrollmentMove(studentId: string, targetGroupId: string): Promise<AdminEnrollmentMoveResponse> {
  return pb.send<AdminEnrollmentMoveResponse>(
    '/api/language-school/admin/academic/enrollments/move',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, targetGroupId }),
    },
  )
}

export async function listAdminUsers(role?: UserRole): Promise<AppUser[]> {
  requireAdmin()
  return pb.collection(collections.users).getFullList<AppUser>({
    filter: role ? `role = "${quote(role)}"` : undefined,
    sort: 'name,surname,email',
  })
}

export async function createAdminUser(input: {
  email: string
  password: string
  name: string
  surname: string
  role: UserRole
  phone?: string
  status?: UserStatus
}): Promise<AppUser> {
  requireAdmin()
  if (input.password.length < 8) throw new Error('La contraseña inicial debe tener al menos 8 caracteres.')
  return pb.collection(collections.users).create<AppUser>({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    passwordConfirm: input.password,
    name: input.name.trim(),
    surname: input.surname.trim(),
    role: input.role,
    phone: input.phone?.trim() || '',
    status: input.status || 'ACTIVE',
  })
}

export async function updateAdminUser(record: AppUser, patch: Partial<Pick<AppUser, 'name' | 'surname' | 'phone' | 'status' | 'role'>>): Promise<AppUser> {
  requireAdmin()
  return pb.collection(collections.users).update<AppUser>(record.id, patch)
}

const teacherDependencies = [
  { collection: collections.groups, field: 'teacher', label: 'grupos' },
  { collection: collections.classes, field: 'teacher', label: 'clases' },
  { collection: collections.materials, field: 'teacher', label: 'materiales' },
  { collection: collections.assignments, field: 'teacher', label: 'tareas' },
  { collection: collections.studentFiles, field: 'uploaded_by', label: 'archivos de alumnos' },
  { collection: collections.blogPosts, field: 'author', label: 'artículos del blog' },
  { collection: collections.mediaLibrary, field: 'uploaded_by', label: 'archivos multimedia' },
  { collection: collections.notifications, field: 'created_by', label: 'notificaciones' },
] as const

export async function deleteAdminTeacher(record: AppUser): Promise<void> {
  requireAdmin()
  if (record.role !== 'TEACHER') throw new Error('La cuenta seleccionada no pertenece a un profesor.')

  const dependencies = await Promise.all(teacherDependencies.map(async (dependency) => {
    const result = await pb.collection(dependency.collection).getList(1, 1, {
      filter: `${dependency.field} = "${quote(record.id)}"`,
      fields: 'id',
    })
    return { ...dependency, count: result.totalItems }
  }))
  const linked = dependencies.filter((dependency) => dependency.count > 0)

  if (linked.length > 0) {
    const summary = linked.map((dependency) => `${dependency.count} ${dependency.label}`).join(', ')
    throw new Error(`No se puede eliminar porque conserva datos vinculados (${summary}). Reasigna esos datos o desactiva la cuenta.`)
  }

  try {
    await pb.collection(collections.users).delete(record.id)
  } catch (error: unknown) {
    const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: unknown }).status) : 0
    if (status === 400) {
      throw new Error('No se puede eliminar porque todavía existen datos vinculados. Reasígnalos o desactiva la cuenta.')
    }
    throw error
  }
}

export async function createAdminStudent(input: {
  email: string
  password: string
  name: string
  surname: string
  phone?: string
  birthDate?: string
  guardianName?: string
  guardianPhone?: string
  notesPrivate?: string
}): Promise<{ user: AppUser; profile: AdminStudentProfileRecord }> {
  requireAdmin()
  const user = await createAdminUser({ ...input, role: 'STUDENT', status: 'ACTIVE' })
  try {
    const profile = await pb.collection(collections.studentProfiles).create<AdminStudentProfileRecord>({
      user: user.id,
      birth_date: input.birthDate || '',
      guardian_name: input.guardianName?.trim() || '',
      guardian_phone: input.guardianPhone?.trim() || '',
      notes_private: input.notesPrivate?.trim() || '',
      active: true,
    })
    return { user, profile }
  } catch (error) {
    try { await pb.collection(collections.users).delete(user.id) } catch { /* best-effort compensation */ }
    throw error
  }
}

export async function createAdminTeacher(input: {
  email: string
  password: string
  name: string
  surname: string
  phone?: string
  bio?: string
  specialties?: string[]
  publicProfile?: boolean
}): Promise<{ user: AppUser; profile: TeacherProfileRecord }> {
  requireAdmin()
  const user = await createAdminUser({ ...input, role: 'TEACHER', status: 'ACTIVE' })
  try {
    const profile = await pb.collection(collections.teacherProfiles).create<TeacherProfileRecord>({
      user: user.id,
      bio: input.bio?.trim() || '',
      specialties: input.specialties || [],
      public_profile: Boolean(input.publicProfile),
      active: true,
    })
    return { user, profile }
  } catch (error) {
    try { await pb.collection(collections.users).delete(user.id) } catch { /* best-effort compensation */ }
    throw error
  }
}

export async function updateAdminTeacherProfile(userId: string, specialties: string[]): Promise<TeacherProfileRecord> {
  requireAdmin()
  const profile = await pb.collection(collections.teacherProfiles).getFirstListItem<TeacherProfileRecord>(`user = "${quote(userId)}"`)
  return pb.collection(collections.teacherProfiles).update<TeacherProfileRecord>(profile.id, { specialties })
}

export async function listAdminTeacherProfiles(): Promise<TeacherProfileRecord[]> {
  requireAdmin()
  return pb.collection(collections.teacherProfiles).getFullList<TeacherProfileRecord>({ sort: 'created' })
}

export async function getAdminStudentProfile(userId: string): Promise<AdminStudentProfileRecord | null> {
  requireAdmin()
  try {
    return await pb.collection(collections.studentProfiles).getFirstListItem<AdminStudentProfileRecord>(`user = "${quote(userId)}"`)
  } catch (error: unknown) {
    const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: unknown }).status) : 0
    if (status === 404) return null
    throw error
  }
}

export async function listAdminCourses(): Promise<CourseRecord[]> {
  requireAdmin()
  return pb.collection(collections.courses).getFullList<CourseRecord>({ sort: 'title' })
}

export async function createAdminCourse(input: {
  title: string
  slug: string
  level?: string
  description?: string
  status?: CourseRecord['status']
  publicVisible?: boolean
}): Promise<CourseRecord> {
  requireAdmin()
  return pb.collection(collections.courses).create<CourseRecord>({
    title: input.title.trim(),
    slug: input.slug.trim().toLowerCase(),
    level: input.level?.trim() || '',
    description: input.description?.trim() || '',
    status: input.status || 'ACTIVE',
    public_visible: Boolean(input.publicVisible),
  })
}

export async function updateAdminCourse(record: CourseRecord, patch: Partial<Pick<CourseRecord, 'title' | 'slug' | 'level' | 'description' | 'status' | 'public_visible'>>): Promise<CourseRecord> {
  requireAdmin()
  return pb.collection(collections.courses).update<CourseRecord>(record.id, patch)
}

export async function listAdminGroups(): Promise<AdminGroupRecord[]> {
  requireAdmin()
  return pb.collection(collections.groups).getFullList<AdminGroupRecord>({
    sort: 'name',
    expand: 'course,teacher',
  })
}

export async function createAdminGroup(input: {
  name: string
  courseId: string
  teacherId: string
  academicYear: string
  scheduleText?: string
  capacity: number
  targetLevel: GroupTargetLevel
  defaultDeliveryMode: GroupDeliveryMode
  status?: GroupRecord['status']
}): Promise<AdminGroupRecord> {
  requireAdmin()
  return pb.collection(collections.groups).create<AdminGroupRecord>({
    name: input.name.trim(),
    course: input.courseId,
    teacher: input.teacherId,
    academic_year: input.academicYear.trim(),
    schedule_text: input.scheduleText?.trim() || '',
    capacity: input.capacity,
    target_level: input.targetLevel,
    default_delivery_mode: input.defaultDeliveryMode,
    status: input.status || 'ACTIVE',
  }, { expand: 'course,teacher' })
}

export async function updateAdminGroup(record: AdminGroupRecord, patch: Partial<{
  name: string
  course: string
  teacher: string
  academic_year: string
  schedule_text: string
  capacity: number
  target_level: GroupTargetLevel
  default_delivery_mode: GroupDeliveryMode
  status: GroupRecord['status']
}>): Promise<AdminGroupRecord> {
  requireAdmin()
  return pb.collection(collections.groups).update<AdminGroupRecord>(record.id, patch, { expand: 'course,teacher' })
}

export async function listAdminEnrollments(): Promise<AdminEnrollmentRecord[]> {
  requireAdmin()
  return pb.collection(collections.enrollments).getFullList<AdminEnrollmentRecord>({
    sort: '-joined_at',
    expand: 'student,group,group.course,group.teacher',
  })
}

export async function createAdminEnrollment(input: {
  studentId: string
  groupId: string
  joinedAt?: string
}): Promise<AdminEnrollmentRecord> {
  requireAdmin()

  try {
    const existing = await pb.collection(collections.enrollments).getFirstListItem<AdminEnrollmentRecord>(
      `student = "${quote(input.studentId)}" && status = "ACTIVE"`,
      { expand: 'student,group,group.course,group.teacher' },
    )
    if (existing.group === input.groupId) return existing
    throw new Error('El alumno ya tiene una matrícula activa. Utiliza su ficha para cambiarlo de grupo y conservar el histórico.')
  } catch (error: unknown) {
    const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: unknown }).status) : 0
    if (status !== 404) throw error
  }

  const result = await requestAdminEnrollmentMove(input.studentId, input.groupId)
  return pb.collection(collections.enrollments).getOne<AdminEnrollmentRecord>(result.currentId, {
    expand: 'student,group,group.course,group.teacher',
  })
}

export async function updateAdminEnrollmentStatus(record: AdminEnrollmentRecord, status: AdminEnrollmentRecord['status']): Promise<AdminEnrollmentRecord> {
  requireAdmin()
  return pb.collection(collections.enrollments).update<AdminEnrollmentRecord>(record.id, {
    status,
    ended_at: status === 'FINISHED' || status === 'CANCELLED' ? new Date().toISOString() : '',
  }, { expand: 'student,group,group.course,group.teacher' })
}

export async function moveAdminStudentToGroup(input: {
  studentId: string
  currentEnrollment?: AdminEnrollmentRecord
  targetGroup: AdminGroupRecord
}): Promise<{ previous?: AdminEnrollmentRecord; current: AdminEnrollmentRecord }> {
  requireAdmin()
  if (input.targetGroup.status !== 'ACTIVE') throw new Error('El grupo de destino debe estar activo.')
  if (input.currentEnrollment?.group === input.targetGroup.id) return { current: input.currentEnrollment }

  const result = await requestAdminEnrollmentMove(input.studentId, input.targetGroup.id)
  const current = await pb.collection(collections.enrollments).getOne<AdminEnrollmentRecord>(result.currentId, {
    expand: 'student,group,group.course,group.teacher',
  })
  if (!result.previousId) return { current }
  const previous = await pb.collection(collections.enrollments).getOne<AdminEnrollmentRecord>(result.previousId, {
    expand: 'student,group,group.course,group.teacher',
  })
  return { previous, current }
}

export async function listAdminClasses(limit = 250): Promise<ClassRecord[]> {
  requireAdmin()
  const result = await pb.collection(collections.classes).getList<ClassRecord>(1, limit, {
    sort: '-starts_at',
    expand: 'group,group.course,teacher',
  })
  return result.items
}

export async function createAdminClass(input: {
  groupId: string
  teacherId: string
  startsAt: string
  endsAt: string
  topic: string
  description?: string
}): Promise<ClassRecord> {
  requireAdmin()
  const starts = new Date(input.startsAt)
  const ends = new Date(input.endsAt)
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) {
    throw new Error('La fecha final debe ser posterior al inicio.')
  }
  return pb.collection(collections.classes).create<ClassRecord>({
    group: input.groupId,
    teacher: input.teacherId,
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    topic: input.topic.trim(),
    description: input.description?.trim() || '',
    status: 'SCHEDULED',
  }, { expand: 'group,group.course,teacher' })
}

export async function updateAdminClass(record: ClassRecord, patch: Partial<Pick<ClassRecord, 'starts_at' | 'ends_at' | 'topic' | 'description' | 'status' | 'group' | 'teacher'>>): Promise<ClassRecord> {
  requireAdmin()
  return pb.collection(collections.classes).update<ClassRecord>(record.id, patch, { expand: 'group,group.course,teacher' })
}

export async function listAdminAttendance(classId?: string): Promise<AttendanceRecord[]> {
  requireAdmin()
  return pb.collection(collections.attendance).getFullList<AttendanceRecord>({
    filter: classId ? `class = "${quote(classId)}"` : undefined,
    sort: '-created',
    expand: 'student,class',
  })
}

export async function upsertAdminAttendance(input: {
  classId: string
  studentId: string
  status: AttendanceRecord['status']
  notes?: string
}): Promise<AttendanceRecord> {
  requireAdmin()
  let current: AttendanceRecord | null = null
  try {
    current = await pb.collection(collections.attendance).getFirstListItem<AttendanceRecord>(
      `class = "${quote(input.classId)}" && student = "${quote(input.studentId)}"`,
    )
  } catch (error: unknown) {
    const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: unknown }).status) : 0
    if (status !== 404) throw error
  }

  const payload = { status: input.status, notes: input.notes?.trim() || '' }
  if (current) return pb.collection(collections.attendance).update<AttendanceRecord>(current.id, payload)
  return pb.collection(collections.attendance).create<AttendanceRecord>({ class: input.classId, student: input.studentId, ...payload })
}
