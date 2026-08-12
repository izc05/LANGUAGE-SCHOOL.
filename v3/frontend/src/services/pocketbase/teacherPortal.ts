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
  specialties: string[] | string
  public_photo: string
  public_profile: boolean
  active: boolean
  display_name: string
  headline: string
  sort_order: number
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
    filter: `group.teacher = "${quote(user.id)}"`,
    sort: '-joined_at',
    expand: 'student,group,group.course',
  })
}

export async function listMyTeacherClasses(limit = 100): Promise<ClassRecord[]> {
  const user = requireTeacher()
  const result = await pb.collection(collections.classes).getList<ClassRecord>(1, limit, {
    filter: `teacher = "${quote(user.id)}"`,
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
    expand: 'course,group,student',
  })
  return result.items
}

export async function listMyTeacherAssignments(limit = 100): Promise<AssignmentRecord[]> {
  const user = requireTeacher()
  const result = await pb.collection(collections.assignments).getList<AssignmentRecord>(1, limit, {
    filter: `teacher = "${quote(user.id)}"`,
    sort: '-created',
    expand: 'group,student',
  })
  return result.items
}

export async function listMyTeacherSubmissions(limit = 100): Promise<SubmissionRecord[]> {
  const user = requireTeacher()
  const result = await pb.collection(collections.assignmentSubmissions).getList<SubmissionRecord>(1, limit, {
    filter: `assignment.teacher = "${quote(user.id)}"`,
    sort: '-submitted_at',
    expand: 'assignment,student',
  })
  return result.items
}

export async function getTeacherMaterialDownloadUrl(record: MaterialRecord): Promise<string> {
  return protectedFileUrl(record, record.file)
}

export async function getTeacherSubmissionDownloadUrl(record: SubmissionRecord): Promise<string> {
  return protectedFileUrl(record, record.file)
}
