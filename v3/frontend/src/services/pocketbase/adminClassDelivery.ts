import { getCurrentUser } from './auth'
import { effectiveVideoProvider, isGoogleMeetUrl } from './classVideo'
import { collections } from './collections'
import { pb } from './client'
import type { ClassDeliveryMode, ClassRecord, ClassVideoProvider } from './studentPortal'

function requireAdmin() {
  const user = getCurrentUser()
  if (!user || user.role !== 'ADMIN') throw new Error('Se requiere una sesión de administrador activa.')
  return user
}

function normalizeOnlineUrl(value: string | undefined, provider: ClassVideoProvider): string {
  const url = value?.trim() || ''
  if (!url) return ''
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') throw new Error()
    if (provider === 'GOOGLE_MEET' && !isGoogleMeetUrl(parsed.toString())) {
      throw new Error('GOOGLE_MEET_HOST')
    }
    return parsed.toString()
  } catch (error) {
    if (error instanceof Error && error.message === 'GOOGLE_MEET_HOST') {
      throw new Error('El enlace de Google Meet debe empezar por https://meet.google.com/.')
    }
    throw new Error('El enlace online debe ser una URL https válida.')
  }
}

export function effectiveDeliveryMode(record: Pick<ClassRecord, 'delivery_mode'>): ClassDeliveryMode {
  return record.delivery_mode || 'IN_PERSON'
}

export { effectiveVideoProvider }

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
    videoProvider: ClassVideoProvider
    locationText?: string
    onlineJoinUrl?: string
  },
): Promise<ClassRecord> {
  requireAdmin()
  const locationText = input.deliveryMode === 'ONLINE' ? '' : input.locationText?.trim() || ''
  const videoProvider = input.deliveryMode === 'IN_PERSON' ? '' : input.videoProvider
  const onlineJoinUrl = input.deliveryMode === 'IN_PERSON' ? '' : normalizeOnlineUrl(input.onlineJoinUrl, input.videoProvider)

  return pb.collection(collections.classes).update<ClassRecord>(record.id, {
    delivery_mode: input.deliveryMode,
    video_provider: videoProvider,
    location_text: locationText,
    online_join_url: onlineJoinUrl,
  }, { expand: 'group,group.course,teacher' })
}
