import { getCurrentUser } from './auth'
import { collections } from './collections'
import { pb } from './client'
import { listMyTeacherEnrollments } from './teacherPortal'
import type { StudentFileRecord, StudentProfileRecord } from './studentPortal'

function requireTeacher() {
  const user = getCurrentUser()
  if (!user || user.role !== 'TEACHER') throw new Error('Se requiere una sesión de profesor activa.')
  return user
}

function quote(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export async function assertStudentInMyTeacherScope(studentId: string): Promise<void> {
  requireTeacher()
  const enrollments = await listMyTeacherEnrollments()
  if (!enrollments.some((item) => item.student === studentId && item.status === 'ACTIVE')) {
    throw new Error('El alumno no pertenece a ninguno de tus grupos activos.')
  }
}

export async function getMyAuthorizedStudentProfile(studentId: string): Promise<StudentProfileRecord | null> {
  await assertStudentInMyTeacherScope(studentId)
  try {
    return await pb.collection(collections.studentProfiles).getFirstListItem<StudentProfileRecord>(`user = "${quote(studentId)}"`)
  } catch (error: unknown) {
    const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: unknown }).status) : 0
    if (status === 404) return null
    throw error
  }
}

export async function listMyAuthorizedStudentFiles(studentId: string, limit = 50): Promise<StudentFileRecord[]> {
  await assertStudentInMyTeacherScope(studentId)
  const result = await pb.collection(collections.studentFiles).getList<StudentFileRecord>(1, limit, {
    filter: `student = "${quote(studentId)}" && status = "ACTIVE"`,
    sort: '-created',
  })
  return result.items
}

export async function getAuthorizedStudentFileDownloadUrl(record: StudentFileRecord): Promise<string> {
  await assertStudentInMyTeacherScope(record.student)
  if (!record.file) return ''
  const token = await pb.files.getToken()
  return pb.files.getURL(record, record.file, { token, download: true })
}
