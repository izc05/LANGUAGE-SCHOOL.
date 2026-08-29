import type { RecordModel } from 'pocketbase'
import { getCurrentUser } from './auth'
import { pb } from './client'
import type { AssignmentRecord, SubmissionRecord } from './studentPortal'

function requireStudent() {
  const user = getCurrentUser()
  if (!user || user.role !== 'STUDENT') throw new Error('Se requiere una sesión de alumno activa.')
  return user
}

async function protectedUrl(record: RecordModel, filename: string): Promise<string> {
  if (!filename) return ''
  requireStudent()
  const token = await pb.files.getToken()
  return pb.files.getURL(record, filename, { token, download: true })
}

export function getAssignmentAttachmentUrl(record: AssignmentRecord): Promise<string> {
  return protectedUrl(record, record.attachment)
}

export function getSubmissionFileUrl(record: SubmissionRecord): Promise<string> {
  const user = requireStudent()
  if (record.student !== user.id) return Promise.reject(new Error('No puedes abrir entregas de otro alumno.'))
  return protectedUrl(record, record.file)
}
