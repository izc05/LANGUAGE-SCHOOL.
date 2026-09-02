import { isDemoMode } from '../../config/environment'
import { listAdminUsers } from './adminAcademic'
import { collections } from './collections'
import { pb } from './client'
import type { NotificationRecord } from './studentPortal'
import type { AppUser } from './types'

export type AdminNotificationType = NotificationRecord['type']
export type NotificationRecipientRole = Extract<AppUser['role'], 'STUDENT' | 'TEACHER'>

export type AdminNotificationRecord = NotificationRecord & {
  expand?: {
    recipient?: AppUser
    created_by?: AppUser
  }
}

export type SendAdminNotificationInput = {
  recipientIds: string[]
  title: string
  body: string
  type: AdminNotificationType
}

function requireAdmin(): AppUser {
  const user = pb.authStore.record as AppUser | null
  if (!user || user.role !== 'ADMIN') throw new Error('Se requiere una sesión ADMIN.')
  return user
}

export async function listNotificationRecipients(role: NotificationRecipientRole = 'STUDENT'): Promise<AppUser[]> {
  if (isDemoMode) {
    return [
      {
        id: 'demo-student', collectionId: 'demo', collectionName: collections.users,
        created: '', updated: '', expand: {}, email: role === 'TEACHER' ? 'profesor@demo.local' : 'alumno@demo.local', emailVisibility: false,
        verified: true, name: role === 'TEACHER' ? 'Laura' : 'Emma', surname: 'Demo', role, status: 'ACTIVE', avatar: '', phone: '',
      },
    ]
  }
  requireAdmin()
  return (await listAdminUsers(role)).filter((user) => user.status === 'ACTIVE')
}

export async function listAdminNotifications(limit = 100): Promise<AdminNotificationRecord[]> {
  if (isDemoMode) return []
  requireAdmin()
  const result = await pb.collection(collections.notifications).getList<AdminNotificationRecord>(1, limit, {
    sort: '-created',
    expand: 'recipient,created_by',
  })
  return result.items
}

export async function sendAdminNotifications(input: SendAdminNotificationInput): Promise<number> {
  if (isDemoMode) return input.recipientIds.length
  const admin = requireAdmin()
  const uniqueRecipients = [...new Set(input.recipientIds.filter(Boolean))]
  if (uniqueRecipients.length === 0) throw new Error('Selecciona al menos un destinatario.')

  let sent = 0
  for (const recipient of uniqueRecipients) {
    await pb.collection(collections.notifications).create<NotificationRecord>({
      recipient,
      title: input.title.trim(),
      body: input.body.trim(),
      type: input.type,
      created_by: admin.id,
    })
    sent += 1
  }
  return sent
}
