import { getCurrentUser } from './auth'
import { collections } from './collections'
import { pb } from './client'
import type { AdminGroupRecord } from './adminAcademic'
import type { GroupDeliveryMode, GroupRecord, GroupTargetLevel } from './studentPortal'

type AdminGroupPatch = Partial<{
  name: string
  course: string
  teacher: string
  academic_year: string
  schedule_text: string
  capacity: number
  target_level: GroupTargetLevel
  default_delivery_mode: GroupDeliveryMode
  status: GroupRecord['status']
}>

type AdminGroupUpdateOptions = {
  reassignFutureScheduledClasses?: boolean
}

function requireAdmin() {
  const user = getCurrentUser()
  if (!user || user.role !== 'ADMIN') throw new Error('Se requiere una sesión de administrador activa.')
}

export async function updateAdminGroup(
  record: AdminGroupRecord,
  patch: AdminGroupPatch,
  options?: AdminGroupUpdateOptions,
): Promise<AdminGroupRecord> {
  requireAdmin()
  const teacherChanged = typeof patch.teacher === 'string' && patch.teacher !== record.teacher
  const reassignDecision = options?.reassignFutureScheduledClasses

  if (teacherChanged && typeof reassignDecision !== 'boolean') {
    throw new Error('Indica si las clases futuras programadas deben reasignarse al nuevo profesor.')
  }

  await pb.send(`/api/language-school/admin/academic/groups/${record.id}/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patch,
      ...(teacherChanged ? { reassignFutureScheduledClasses: reassignDecision } : {}),
    }),
  })

  return pb.collection(collections.groups).getOne<AdminGroupRecord>(record.id, {
    expand: 'course,teacher',
  })
}
