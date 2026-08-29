import { getCurrentUser } from './auth'
import { pb } from './client'

export type JitsiRoomResult = {
  provider: 'jitsi'
  existing: boolean
  roomName: string
  joinUrl: string
}

export type JitsiJoinAuthorization = {
  provider: 'jitsi'
  authorized: true
  domain: 'meet.jit.si'
  roomName: string
  displayName: string
  userRole: 'student' | 'teacher' | 'admin'
}

export async function createJitsiRoom(classId: string): Promise<JitsiRoomResult> {
  const user = getCurrentUser()
  if (!user || (user.role !== 'ADMIN' && user.role !== 'TEACHER')) {
    throw new Error('Solo Administración o el profesor pueden preparar una sala Jitsi.')
  }
  return pb.send<JitsiRoomResult>(`/api/language-school/jitsi/classes/${encodeURIComponent(classId)}/room`, {
    method: 'POST',
  })
}

export async function getJitsiJoinAuthorization(classId: string): Promise<JitsiJoinAuthorization> {
  const user = getCurrentUser()
  if (!user) throw new Error('Se requiere una sesión activa para entrar en clase.')
  return pb.send<JitsiJoinAuthorization>(`/api/language-school/jitsi/classes/${encodeURIComponent(classId)}/join`, {
    method: 'POST',
  })
}

