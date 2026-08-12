import type { RecordModel } from 'pocketbase'
import { getCurrentUser } from './auth'
import { collections } from './collections'
import { pb } from './client'
import type { AppUser, UserRole, UserStatus } from './types'
import type { AttendanceRecord, ClassRecord, CourseRecord, GroupRecord } from './studentPortal'
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

function requireAdmin() {
  const user = getCurrentUser()
  if (!user || user.role !== 'ADMIN') throw new Error('Se requiere una sesión de administrador activa.')
  return user
}

function quote(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
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
  return pb.collection(collections.enrollments).create<AdminEnrollmentRecord>({
    student: input.studentId,
    group: input.groupId,
    status: 'ACTIVE',
    joined_at: input.joinedAt || new Date().toISOString(),
    ended_at: '',
  }, { expand: 'student,group,group.course,group.teacher' })
}

export async function updateAdminEnrollmentStatus(record: AdminEnrollmentRecord, status: AdminEnrollmentRecord['status']): Promise<AdminEnrollmentRecord> {
  requireAdmin()
  return pb.collection(collections.enrollments).update<AdminEnrollmentRecord>(record.id, {
    status,
    ended_at: status === 'FINISHED' || status === 'CANCELLED' ? new Date().toISOString() : '',
  }, { expand: 'student,group,group.course,group.teacher' })
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
