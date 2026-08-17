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
  cover_image: string
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
  expand?: { course?: CourseRecord }
}

export type EnrollmentRecord = RecordModel & {
  student: string
  group: string
  status: 'ACTIVE' | 'PAUSED' | 'FINISHED' | 'CANCELLED'
  joined_at: string
  ended_at: string
  expand?: { group?: GroupRecord }
}

export type ClassRecord = RecordModel & {
  group: string
  teacher: string
  starts_at: string
  ends_at: string
  topic: string
  description: string
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'
  expand?: { group?: GroupRecord }
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
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
}

export type AssignmentSubmissionRecord = RecordModel & {
  assignment: string
  student: string
  text: string
  attachment: string
  submitted_at: string
  status: 'DRAFT' | 'SUBMITTED' | 'REVIEWED'
  feedback: string
  score: number | null
}

export type NotificationRecord = RecordModel & {
  title: string
  body: string
  audience: 'ALL' | 'STUDENT' | 'TEACHER' | 'ADMIN' | 'USER'
  user: string
  created_by: string
  active: boolean
  starts_at: string
  ends_at: string
}

function requireStudent() {
  const user = getCurrentUser()
  if (!user || user.role !== 'STUDENT') throw new Error('Se requiere una sesión de alumno activa.')
  return user
}

export async function getStudentProfile(): Promise<StudentProfileRecord | null> {
  const user = requireStudent()
  try {
    return await pb.collection(collections.studentProfiles).getFirstListItem<StudentProfileRecord>(`user = "${user.id}"`)
  } catch (error: unknown) {
    const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: unknown }).status) : 0
    if (status === 404) return null
    throw error
  }
}

export async function listStudentEnrollments(): Promise<EnrollmentRecord[]> {
  const user = requireStudent()
  return pb.collection(collections.enrollments).getFullList<EnrollmentRecord>({
    filter: `student = "${user.id}"`, sort: '-joined_at', expand: 'group,group.course',
  })
}

export async function listStudentClasses(): Promise<ClassRecord[]> {
  requireStudent()
  return pb.collection(collections.classes).getFullList<ClassRecord>({ sort: 'starts_at', expand: 'group' })
}

export async function listStudentMaterials(): Promise<MaterialRecord[]> {
  requireStudent()
  return pb.collection(collections.materials).getFullList<MaterialRecord>({ filter: 'published = true', sort: '-created' })
}

export async function listStudentAssignments(): Promise<AssignmentRecord[]> {
  requireStudent()
  return pb.collection(collections.assignments).getFullList<AssignmentRecord>({ filter: 'status = "PUBLISHED"', sort: 'due_at' })
}

export async function listStudentSubmissions(): Promise<AssignmentSubmissionRecord[]> {
  const user = requireStudent()
  return pb.collection(collections.assignmentSubmissions).getFullList<AssignmentSubmissionRecord>({ filter: `student = "${user.id}"`, sort: '-submitted_at' })
}

export async function listStudentNotifications(): Promise<NotificationRecord[]> {
  requireStudent()
  const now = new Date().toISOString()
  return pb.collection(collections.notifications).getFullList<NotificationRecord>({
    filter: `active = true && (starts_at = "" || starts_at <= "${now}") && (ends_at = "" || ends_at >= "${now}")`, sort: '-created',
  })
}
