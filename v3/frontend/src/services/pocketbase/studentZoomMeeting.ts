import { pb } from './client'

export type StudentZoomSdkAuthorization = {
  provider: 'zoom'
  authorized: true
  signature: string
  meetingNumber: string
  password: string
  userName: string
  role: 0
  expiresAt: number
}

export async function getStudentZoomSdkAuthorization(classId: string): Promise<StudentZoomSdkAuthorization> {
  const normalizedClassId = classId.trim()
  if (!normalizedClassId) throw new Error('Falta la clase que se quiere abrir.')
  return pb.send<StudentZoomSdkAuthorization>(`/api/language-school/zoom/classes/${encodeURIComponent(normalizedClassId)}/sdk-auth`, {
    method: 'POST',
  })
}
