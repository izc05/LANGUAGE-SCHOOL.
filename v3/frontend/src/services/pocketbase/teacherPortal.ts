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

function requireTeacher() {
  const user = getCurrentUser()
  if (!user || user.role !== 'TEACHER') throw new Error('Se requiere una sesión de profesor activa.')
  return user
}

function quote(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
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

export async function listMyTeacherAssignments(limit = 100): Promise<AssignmentRecord[]> {
  const user = requireTeacher()
  const result = await pb.collection(collections.assignments).getList<AssignmentRecord>(1, limit, {
    filter: `teacher = "${quote(user.id)}"`,
    sort: '-created',
  })
  return result.items
}

export async function listMyTeacherSubmissions(limit = 100): Promise<SubmissionRecord[]> {
  requireTeacher()
  const result = await pb.collection(collections.assignmentSubmissions).getList<SubmissionRecord>(1, limit, {
    sort: '-submitted_at',
    expand: 'assignment,student',
  })
  return result.items
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
