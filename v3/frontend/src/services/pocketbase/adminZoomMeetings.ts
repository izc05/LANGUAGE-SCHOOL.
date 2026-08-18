import type { RecordModel } from 'pocketbase'
import { getCurrentUser } from './auth'
import { collections } from './collections'
import { pb } from './client'

export type ZoomMeetingRecord = RecordModel & {
  class: string
  provider: 'ZOOM'
  external_meeting_id: string
  external_uuid: string
  join_url: string
  meeting_password?: string
  status: 'PENDING' | 'READY' | 'CANCELLED' | 'ERROR'
  created_by: string
}

export type ZoomMeetingCreateResult = {
  provider: 'zoom'
  existing: boolean
  status: ZoomMeetingRecord['status']
  externalMeetingId: string
  joinUrl: string
}

function requireAdmin() {
  const user = getCurrentUser()
  if (!user || user.role !== 'ADMIN') throw new Error('Se requiere una sesión de administrador activa.')
  return user
}

function quote(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export async function getAdminZoomMeetingForClass(classId: string): Promise<ZoomMeetingRecord | null> {
  requireAdmin()
  try {
    return await pb.collection(collections.zoomMeetings).getFirstListItem<ZoomMeetingRecord>(`class = "${quote(classId)}"`)
  } catch (error: unknown) {
    const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: unknown }).status) : 0
    if (status === 404) return null
    throw error
  }
}

export async function createAdminZoomMeeting(classId: string): Promise<ZoomMeetingCreateResult> {
  requireAdmin()
  return pb.send<ZoomMeetingCreateResult>('/api/language-school/zoom/meetings/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classId }),
  })
}
