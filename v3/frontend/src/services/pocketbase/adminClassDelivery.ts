import { getCurrentUser } from './auth'
import { collections } from './collections'
import { pb } from './client'
import type { ClassDeliveryMode, ClassRecord } from './studentPortal'

function requireAdmin() {
  const user = getCurrentUser()
  if (!user || user.role !== 'ADMIN') throw new Error('Se requiere una sesión de administrador activa.')
  return user
}

function normalizeOnlineUrl(value?: string): string {
  const url = value?.trim() || ''
  if (!url) return ''
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') throw new Error()
    return parsed.toString()
  } catch {
    throw new Error('El enlace online debe ser una URL https válida.')
  }
}

export function effectiveDeliveryMode(record: Pick<ClassRecord, 'delivery_mode'>): ClassDeliveryMode {
  return record.delivery_mode || 'IN_PERSON'
}

export async function listAdminClassesForDelivery(limit = 250): Promise<ClassRecord[]> {
  requireAdmin()
  const result = await pb.collection(collections.classes).getList<ClassRecord>(1, limit, {
    sort: '-starts_at',
    expand: 'group,group.course,teacher',
  })
  return result.items
}

export async function updateAdminClassDelivery(
  record: ClassRecord,
  input: {
    deliveryMode: ClassDeliveryMode
    locationText?: string
    onlineJoinUrl?: string
  },
): Promise<ClassRecord> {
  requireAdmin()
  const locationText = input.deliveryMode === 'ONLINE' ? '' : input.locationText?.trim() || ''
  const onlineJoinUrl = input.deliveryMode === 'IN_PERSON' ? '' : normalizeOnlineUrl(input.onlineJoinUrl)

  return pb.collection(collections.classes).update<ClassRecord>(record.id, {
    delivery_mode: input.deliveryMode,
    location_text: locationText,
    online_join_url: onlineJoinUrl,
  }, { expand: 'group,group.course,teacher' })
}
