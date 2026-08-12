import type { RecordModel } from 'pocketbase'
import { getCurrentUser } from './auth'
import { collections } from './collections'
import { pb } from './client'
import type {
  AssignmentRecord,
  ClassRecord,
  CourseRecord,
  GroupRecord,
  MaterialRecord,
  SubmissionRecord,
} from './studentPortal'

export type TeacherProfileRecord = RecordModel & {
  user: string
  bio: string
  specialties: string
  public_photo: string
  public_profile: boolean
  active: boolean
}

export type TeacherStudentRecord = RecordModel & {
  name: string
  surname: string
  email: string
  phone: string
  role: 'STUDENT'
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
}

export type TeacherEnrollmentRecord = RecordModel & {
  student: string
  group: string
  status: 'ACTIVE' | 'PAUSED' | 'FINISHED' | 'CANCELLED'
  joined_at: string
  ended_at: string
  expand?: {
    student?: TeacherStudentRecord
    group?: GroupRecord
  }
}

export type TeacherGroupRecord = GroupRecord & {
  expand?: {
    course?: CourseRecord
  }
}

export type TeacherTarget =
  | { type: 'GROUP'; id: string }
  | { type: 'STUDENT'; id: string }

function requireTeacher() {
  const user = getCurrentUser()
  if (!user || user.role !== 'TEACHER') throw new Error('Se requiere una sesión de profesor activa.')
  return user
}

function quote(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

async function protectedFileUrl(record: RecordModel, filename: string): Promise<string> {
  if (!filename) return ''
  requireTeacher()
  const token = await pb.files.getToken()
  return pb.files.getURL(record, filename, { token, download: true })
}

export async function getMyTeacherProfile(): Promise<TeacherProfileRecord | null> {
  const user = requireTeacher()
  try {
    return await pb.collection(collections.teacherProfiles).getFirstListItem<TeacherProfileRecord>(`user = "${quote(user.id)}"`)
  } catch (error: unknown) {
    const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: unknown }).status) : 0
    if (status === 404) return null
    throw error
  }
}

export async function listMyTeacherGroups(): Promise<TeacherGroupRecord[]> {
  const user = requireTeacher()
  return pb.collection(collections.groups).getFullList<TeacherGroupRecord>({
    filter: `teacher = "${quote(user.id)}"`,
    sort: 'name',
    expand: 'course',
  })
}

export async function listMyTeacherEnrollments(): Promise<TeacherEnrollmentRecord[]> {
  const user = requireTeacher()
  return pb.collection(collections.enrollments).getFullList<TeacherEnrollmentRecord>({
    filter: `group.teacher = "${quote(user.id)}" && status = "ACTIVE"`,
    sort: 'group.name,student.name',
    expand: 'student,group,group.course',
  })
}

export async function listMyTeacherUpcomingClasses(limit = 50): Promise<ClassRecord[]> {
  const user = requireTeacher()
  const now = new Date().toISOString()
  const result = await pb.collection(collections.classes).getList<ClassRecord>(1, limit, {
    filter: `teacher = "${quote(user.id)}" && status = "SCHEDULED" && starts_at >= "${quote(now)}"`,
    sort: 'starts_at',
    expand: 'group,group.course',
  })
  return result.items
}

export async function listMyTeacherRecentClasses(limit = 100): Promise<ClassRecord[]> {
  const user = requireTeacher()
  const result = await pb.collection(collections.classes).getList<ClassRecord>(1, limit, {
    filter: `teacher = "${quote(user.id)}" && status = "COMPLETED"`,
    sort: '-starts_at',
    expand: 'group,group.course',
  })
  return result.items
}

export async function listMyTeacherMaterials(limit = 100): Promise<MaterialRecord[]> {
  const user = requireTeacher()
  const result = await pb.collection(collections.materials).getList<MaterialRecord>(1, limit, {
    filter: `teacher = "${quote(user.id)}"`,
    sort: '-created',
  })
  return result.items
}

export async function createTeacherMaterial(input: {
  title: string
  description?: string
  file: File
  target: TeacherTarget
  published?: boolean
}): Promise<MaterialRecord> {
  const teacher = requireTeacher()
  const data = new FormData()
  data.set('title', input.title.trim() || input.file.name)
  data.set('description', input.description?.trim() || '')
  data.set('file', input.file)
  data.set('teacher', teacher.id)
  data.set('visibility', input.target.type)
  data.set('published', input.published === false ? 'false' : 'true')

  if (input.target.type === 'GROUP') data.set('group', input.target.id)
  else data.set('student', input.target.id)

  return pb.collection(collections.materials).create<MaterialRecord>(data)
}

export async function deleteTeacherMaterial(record: MaterialRecord): Promise<boolean> {
  const teacher = requireTeacher()
  if (record.teacher !== teacher.id) throw new Error('No puedes eliminar material de otro profesor.')
  return pb.collection(collections.materials).delete(record.id)
}

export function getTeacherMaterialDownloadUrl(record: MaterialRecord): Promise<string> {
  const teacher = requireTeacher()
  if (record.teacher !== teacher.id) return Promise.reject(new Error('No puedes abrir material de otro profesor.'))
  return protectedFileUrl(record, record.file)
}

export async function listMyTeacherAssignments(limit = 100): Promise<AssignmentRecord[]> {
  const user = requireTeacher()
  const result = await pb.collection(collections.assignments).getList<AssignmentRecord>(1, limit, {
    filter: `teacher = "${quote(user.id)}"`,
    sort: '-created',
  })
  return result.items
}

export async function createTeacherAssignment(input: {
  title: string
  description?: string
  target: TeacherTarget
  dueAt?: string
  attachment?: File
  status?: 'DRAFT' | 'PUBLISHED'
}): Promise<AssignmentRecord> {
  const teacher = requireTeacher()
  const data = new FormData()
  data.set('title', input.title.trim())
  data.set('description', input.description?.trim() || '')
  data.set('teacher', teacher.id)
  data.set('status', input.status || 'PUBLISHED')
  if (input.dueAt) data.set('due_at', input.dueAt)
  if (input.attachment) data.set('attachment', input.attachment)

  if (input.target.type === 'GROUP') data.set('group', input.target.id)
  else data.set('student', input.target.id)

  return pb.collection(collections.assignments).create<AssignmentRecord>(data)
}

export async function updateTeacherAssignmentStatus(record: AssignmentRecord, status: AssignmentRecord['status']): Promise<AssignmentRecord> {
  const teacher = requireTeacher()
  if (record.teacher !== teacher.id) throw new Error('No puedes modificar tareas de otro profesor.')
  return pb.collection(collections.assignments).update<AssignmentRecord>(record.id, { status })
}

export async function deleteTeacherAssignment(record: AssignmentRecord): Promise<boolean> {
  const teacher = requireTeacher()
  if (record.teacher !== teacher.id) throw new Error('No puedes eliminar tareas de otro profesor.')
  return pb.collection(collections.assignments).delete(record.id)
}

export function getTeacherAssignmentAttachmentUrl(record: AssignmentRecord): Promise<string> {
  const teacher = requireTeacher()
  if (record.teacher !== teacher.id) return Promise.reject(new Error('No puedes abrir tareas de otro profesor.'))
  return protectedFileUrl(record, record.attachment)
}

export async function listMyTeacherSubmissions(limit = 100): Promise<SubmissionRecord[]> {
  requireTeacher()
  const result = await pb.collection(collections.assignmentSubmissions).getList<SubmissionRecord>(1, limit, {
    sort: '-submitted_at',
    expand: 'assignment,student',
  })
  return result.items
}

export async function reviewTeacherSubmission(record: SubmissionRecord, input: {
  feedback: string
  grade?: string
  status: 'REVIEWED' | 'RETURNED'
}): Promise<SubmissionRecord> {
  requireTeacher()
  return pb.collection(collections.assignmentSubmissions).update<SubmissionRecord>(record.id, {
    teacher_feedback: input.feedback.trim(),
    grade_text: input.grade?.trim() || '',
    status: input.status,
  })
}

export function getTeacherSubmissionFileUrl(record: SubmissionRecord): Promise<string> {
  requireTeacher()
  return protectedFileUrl(record, record.file)
}

export async function getTeacherDashboardSnapshot() {
  requireTeacher()
  const [profile, groups, enrollments, upcomingClasses, recentClasses, materials, assignments, submissions] = await Promise.all([
    getMyTeacherProfile(),
    listMyTeacherGroups(),
    listMyTeacherEnrollments(),
    listMyTeacherUpcomingClasses(30),
    listMyTeacherRecentClasses(50),
    listMyTeacherMaterials(12),
    listMyTeacherAssignments(30),
    listMyTeacherSubmissions(50),
  ])

  return {
    profile,
    groups,
    enrollments,
    upcomingClasses,
    recentClasses,
    materials,
    assignments,
    submissions,
  }
}
