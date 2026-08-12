import type { RecordModel } from 'pocketbase'
import { collections } from './collections'
import { getCurrentUser } from './auth'
import { pb } from './client'

export type StudentProfileRecord = RecordModel & {
  user: string
  birth_date: string
  guardian_name: string
  guardian_phone: string
  active: boolean
}

export type CourseRecord = RecordModel & {
  title: string
  slug: string
  level: string
  description: string
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  public_visible: boolean
}

export type GroupRecord = RecordModel & {
  name: string
  course: string
  teacher: string
  academic_year: string
  schedule_text: string
  capacity: number
  status: 'ACTIVE' | 'PAUSED' | 'FINISHED' | 'CANCELLED'
  expand?: {
    course?: CourseRecord
  }
}

export type EnrollmentRecord = RecordModel & {
  student: string
  group: string
  status: 'ACTIVE' | 'PAUSED' | 'FINISHED' | 'CANCELLED'
  joined_at: string
  ended_at: string
  expand?: {
    group?: GroupRecord
  }
}

export type ClassRecord = RecordModel & {
  group: string
  teacher: string
  starts_at: string
  ends_at: string
  topic: string
  description: string
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'
  expand?: {
    group?: GroupRecord
  }
}

export type StudentFileCategory = 'MATERIAL' | 'HOMEWORK' | 'AUDIO' | 'DOCUMENT' | 'OTHER'

export type StudentFileRecord = RecordModel & {
  title: string
  file: string
  student: string
  uploaded_by: string
  category: StudentFileCategory
  description: string
  status: 'ACTIVE' | 'ARCHIVED'
}

export type MaterialRecord = RecordModel & {
  title: string
  description: string
  file: string
  teacher: string
  course: string
  group: string
  student: string
  visibility: 'COURSE' | 'GROUP' | 'STUDENT'
  published: boolean
}

export type AssignmentRecord = RecordModel & {
  title: string
  description: string
  teacher: string
  group: string
  student: string
  attachment: string
  due_at: string
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED'
}

export type SubmissionRecord = RecordModel & {
  assignment: string
  student: string
  file: string
  text_answer: string
  submitted_at: string
  teacher_feedback: string
  grade_text: string
  status: 'SUBMITTED' | 'REVIEWED' | 'RETURNED'
}

export type NotificationRecord = RecordModel & {
  recipient: string
  title: string
  body: string
  type: 'GENERAL' | 'CLASS' | 'MATERIAL' | 'ASSIGNMENT' | 'SYSTEM'
  read_at: string
  created_by: string
}

export type AttendanceRecord = RecordModel & {
  class: string
  student: string
  status: 'PRESENT' | 'ABSENT' | 'JUSTIFIED'
  notes: string
}

function requireStudentUser() {
  const user = getCurrentUser()
  if (!user || user.role !== 'STUDENT') {
    throw new Error('Se requiere una sesión de alumno activa.')
  }
  return user
}

function quote(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export async function getMyStudentProfile(): Promise<StudentProfileRecord | null> {
  const user = requireStudentUser()
  try {
    return await pb
      .collection(collections.studentProfiles)
      .getFirstListItem<StudentProfileRecord>(`user = "${quote(user.id)}"`)
  } catch (error: unknown) {
    const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: unknown }).status) : 0
    if (status === 404) return null
    throw error
  }
}

export async function listMyEnrollments(): Promise<EnrollmentRecord[]> {
  const user = requireStudentUser()
  return pb.collection(collections.enrollments).getFullList<EnrollmentRecord>({
    filter: `student = "${quote(user.id)}"`,
    sort: '-joined_at',
    expand: 'group,group.course',
  })
}

export async function listMyUpcomingClasses(limit = 10): Promise<ClassRecord[]> {
  requireStudentUser()
  const now = new Date().toISOString()
  const result = await pb.collection(collections.classes).getList<ClassRecord>(1, limit, {
    filter: `status = "SCHEDULED" && starts_at >= "${quote(now)}"`,
    sort: 'starts_at',
    expand: 'group,group.course',
  })
  return result.items
}

export async function listMyRecentClasses(limit = 20): Promise<ClassRecord[]> {
  requireStudentUser()
  const result = await pb.collection(collections.classes).getList<ClassRecord>(1, limit, {
    filter: 'status = "COMPLETED"',
    sort: '-starts_at',
    expand: 'group,group.course',
  })
  return result.items
}

export async function listMyAttendance(limit = 40): Promise<AttendanceRecord[]> {
  const user = requireStudentUser()
  const result = await pb.collection(collections.attendance).getList<AttendanceRecord>(1, limit, {
    filter: `student = "${quote(user.id)}"`,
    sort: '-created',
  })
  return result.items
}

export async function listMyFiles(limit = 50): Promise<StudentFileRecord[]> {
  const user = requireStudentUser()
  const result = await pb.collection(collections.studentFiles).getList<StudentFileRecord>(1, limit, {
    filter: `student = "${quote(user.id)}" && status = "ACTIVE"`,
    sort: '-created',
  })
  return result.items
}

export async function uploadMyFile(input: {
  title: string
  file: File
  category: StudentFileCategory
  description?: string
}): Promise<StudentFileRecord> {
  const user = requireStudentUser()
  const data = new FormData()
  data.set('title', input.title.trim() || input.file.name)
  data.set('file', input.file)
  data.set('student', user.id)
  data.set('uploaded_by', user.id)
  data.set('category', input.category)
  data.set('description', input.description?.trim() || '')
  data.set('status', 'ACTIVE')
  return pb.collection(collections.studentFiles).create<StudentFileRecord>(data)
}

export async function archiveMyFile(record: StudentFileRecord): Promise<StudentFileRecord> {
  const user = requireStudentUser()
  if (record.student !== user.id) throw new Error('No puedes modificar archivos de otro alumno.')
  return pb.collection(collections.studentFiles).update<StudentFileRecord>(record.id, { status: 'ARCHIVED' })
}

export async function deleteMyFile(record: StudentFileRecord): Promise<boolean> {
  const user = requireStudentUser()
  if (record.student !== user.id) throw new Error('No puedes eliminar archivos de otro alumno.')
  return pb.collection(collections.studentFiles).delete(record.id)
}

async function getProtectedFileUrl(record: RecordModel, filename: string, download = false): Promise<string> {
  if (!filename) return ''
  const token = await pb.files.getToken()
  return pb.files.getURL(record, filename, { token, ...(download ? { download: 1 } : {}) })
}

export function getMyFileDownloadUrl(record: StudentFileRecord): Promise<string> {
  const user = requireStudentUser()
  if (record.student !== user.id) return Promise.reject(new Error('No puedes descargar archivos de otro alumno.'))
  return getProtectedFileUrl(record, record.file, true)
}

export async function listMyMaterials(limit = 30): Promise<MaterialRecord[]> {
  requireStudentUser()
  const result = await pb.collection(collections.materials).getList<MaterialRecord>(1, limit, {
    filter: 'published = true',
    sort: '-created',
  })
  return result.items
}

export function getMaterialDownloadUrl(record: MaterialRecord): Promise<string> {
  requireStudentUser()
  return getProtectedFileUrl(record, record.file, true)
}

export async function listMyAssignments(limit = 30): Promise<AssignmentRecord[]> {
  requireStudentUser()
  const result = await pb.collection(collections.assignments).getList<AssignmentRecord>(1, limit, {
    filter: 'status != "DRAFT"',
    sort: 'due_at,-created',
  })
  return result.items
}

export async function listMySubmissions(limit = 50): Promise<SubmissionRecord[]> {
  const user = requireStudentUser()
  const result = await pb.collection(collections.assignmentSubmissions).getList<SubmissionRecord>(1, limit, {
    filter: `student = "${quote(user.id)}"`,
    sort: '-submitted_at',
  })
  return result.items
}

export async function submitAssignment(input: {
  assignmentId: string
  file?: File
  textAnswer?: string
}): Promise<SubmissionRecord> {
  const user = requireStudentUser()
  const data = new FormData()
  data.set('assignment', input.assignmentId)
  data.set('student', user.id)
  data.set('text_answer', input.textAnswer?.trim() || '')
  data.set('submitted_at', new Date().toISOString())
  data.set('status', 'SUBMITTED')
  if (input.file) data.set('file', input.file)
  return pb.collection(collections.assignmentSubmissions).create<SubmissionRecord>(data)
}

export async function listMyNotifications(limit = 30): Promise<NotificationRecord[]> {
  const user = requireStudentUser()
  const result = await pb.collection(collections.notifications).getList<NotificationRecord>(1, limit, {
    filter: `recipient = "${quote(user.id)}"`,
    sort: '-created',
  })
  return result.items
}

export async function markMyNotificationRead(record: NotificationRecord): Promise<NotificationRecord> {
  const user = requireStudentUser()
  if (record.recipient !== user.id) throw new Error('No puedes modificar avisos de otro usuario.')
  return pb.collection(collections.notifications).update<NotificationRecord>(record.id, {
    read_at: new Date().toISOString(),
  })
}

export async function getStudentDashboardSnapshot() {
  requireStudentUser()
  const [profile, enrollments, upcomingClasses, recentClasses, files, materials, assignments, submissions, notifications] = await Promise.all([
    getMyStudentProfile(),
    listMyEnrollments(),
    listMyUpcomingClasses(6),
    listMyRecentClasses(20),
    listMyFiles(8),
    listMyMaterials(8),
    listMyAssignments(12),
    listMySubmissions(30),
    listMyNotifications(10),
  ])

  return {
    profile,
    enrollments,
    upcomingClasses,
    recentClasses,
    files,
    materials,
    assignments,
    submissions,
    notifications,
  }
}
