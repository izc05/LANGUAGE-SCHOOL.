import { getCurrentUser } from './auth'
import { collections } from './collections'
import { pb } from './client'
import type { ClassDeliveryMode, ClassRecord } from './studentPortal'
import type { OnlineClassProvider } from '../../utils/onlineClassProvider'
import { normalizeProviderUrl } from '../../utils/onlineClassProvider'

function requireAdmin() {
  const user = getCurrentUser()
  if (!user || user.role !== 'ADMIN') throw new Error('Se requiere una sesión de administrador activa.')
  return user
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
    videoProvider: OnlineClassProvider
    locationText?: string
    onlineJoinUrl?: string
    meetingRoom?: string
  },
): Promise<ClassRecord> {
  requireAdmin()
  const locationText = input.deliveryMode === 'ONLINE' ? '' : input.locationText?.trim() || ''
  const videoProvider = input.deliveryMode === 'IN_PERSON' ? '' : input.videoProvider
  const onlineJoinUrl = input.deliveryMode === 'IN_PERSON'
    ? ''
    : input.videoProvider === 'JITSI'
      ? normalizeProviderUrl('JITSI', input.onlineJoinUrl)
      : normalizeProviderUrl(input.videoProvider, input.onlineJoinUrl)
  const meetingRoom = input.deliveryMode !== 'IN_PERSON' && input.videoProvider === 'JITSI'
    ? input.meetingRoom?.trim() || ''
    : ''

  return pb.collection(collections.classes).update<ClassRecord>(record.id, {
    delivery_mode: input.deliveryMode,
    location_text: locationText,
    video_provider: videoProvider,
    online_join_url: onlineJoinUrl,
    meeting_room: meetingRoom,
  }, { expand: 'group,group.course,teacher' })
}
