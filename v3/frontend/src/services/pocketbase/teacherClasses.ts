import { getCurrentUser } from './auth'
import { collections } from './collections'
import { pb } from './client'
import type { AttendanceRecord, ClassRecord } from './studentPortal'
import type { TeacherEnrollmentRecord, TeacherGroupRecord } from './teacherPortal'
import { listMyTeacherGroups } from './teacherPortal'

function requireTeacher() {
  const user = getCurrentUser()
  if (!user || user.role !== 'TEACHER') throw new Error('Se requiere una sesión de profesor activa.')
  return user
}

function quote(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

async function assertMyGroup(groupId: string): Promise<TeacherGroupRecord> {
  const groups = await listMyTeacherGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) throw new Error('El grupo no pertenece al profesor autenticado.')
  return group
}

async function assertClassOwner(record: ClassRecord): Promise<void> {
  const teacher = requireTeacher()
  if (record.teacher !== teacher.id) throw new Error('La clase no pertenece al profesor autenticado.')
  await assertMyGroup(record.group)
}

export async function listMyTeacherClasses(limit = 120): Promise<ClassRecord[]> {
  const teacher = requireTeacher()
  const result = await pb.collection(collections.classes).getList<ClassRecord>(1, limit, {
    filter: `teacher = "${quote(teacher.id)}"`,
    sort: '-starts_at',
    expand: 'group,group.course',
  })
  return result.items
}

export async function createTeacherClass(input: {
  groupId: string
  startsAt: string
  endsAt: string
  topic: string
  description?: string
}): Promise<ClassRecord> {
  const teacher = requireTeacher()
  await assertMyGroup(input.groupId)

  const startsAt = new Date(input.startsAt)
  const endsAt = new Date(input.endsAt)
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    throw new Error('La fecha final debe ser posterior al inicio de la clase.')
  }

  return pb.collection(collections.classes).create<ClassRecord>({
    group: input.groupId,
    teacher: teacher.id,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    topic: input.topic.trim(),
    description: input.description?.trim() || '',
    status: 'SCHEDULED',
  }, { expand: 'group,group.course' })
}

export async function updateTeacherClassStatus(
  record: ClassRecord,
  status: ClassRecord['status'],
): Promise<ClassRecord> {
  await assertClassOwner(record)
  return pb.collection(collections.classes).update<ClassRecord>(record.id, { status }, { expand: 'group,group.course' })
}

export async function listAuthorizedStudentsForClass(record: ClassRecord): Promise<TeacherEnrollmentRecord[]> {
  await assertClassOwner(record)
  return pb.collection(collections.enrollments).getFullList<TeacherEnrollmentRecord>({
    filter: `group = "${quote(record.group)}" && status = "ACTIVE"`,
    sort: 'student.name,student.surname',
    expand: 'student,group,group.course',
  })
}

export async function listAttendanceForClass(record: ClassRecord): Promise<AttendanceRecord[]> {
  await assertClassOwner(record)
  return pb.collection(collections.attendance).getFullList<AttendanceRecord>({
    filter: `class = "${quote(record.id)}"`,
    sort: 'created',
  })
}

async function assertStudentInClassGroup(record: ClassRecord, studentId: string): Promise<void> {
  await assertClassOwner(record)
  try {
    await pb.collection(collections.enrollments).getFirstListItem(
      `group = "${quote(record.group)}" && student = "${quote(studentId)}" && status = "ACTIVE"`,
    )
  } catch {
    throw new Error('El alumno no tiene matrícula activa en el grupo de esta clase.')
  }
}

export async function setTeacherAttendance(input: {
  classRecord: ClassRecord
  studentId: string
  status: AttendanceRecord['status']
  notes?: string
}): Promise<AttendanceRecord> {
  await assertStudentInClassGroup(input.classRecord, input.studentId)

  let current: AttendanceRecord | null = null
  try {
    current = await pb.collection(collections.attendance).getFirstListItem<AttendanceRecord>(
      `class = "${quote(input.classRecord.id)}" && student = "${quote(input.studentId)}"`,
    )
  } catch (error: unknown) {
    const status = typeof error === 'object' && error && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : 0
    if (status !== 404) throw error
  }

  if (current) {
    return pb.collection(collections.attendance).update<AttendanceRecord>(current.id, {
      status: input.status,
      notes: input.notes?.trim() || '',
    })
  }

  return pb.collection(collections.attendance).create<AttendanceRecord>({
    class: input.classRecord.id,
    student: input.studentId,
    status: input.status,
    notes: input.notes?.trim() || '',
  })
}
