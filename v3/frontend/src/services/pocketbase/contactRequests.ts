import type { RecordModel } from 'pocketbase'
import { isDemoMode } from '../../config/environment'
import { collections } from './collections'
import { pb } from './client'

export type ContactRequestStatus = 'NEW' | 'CONTACTED' | 'CLOSED'

export type ContactRequestRecord = RecordModel & {
  name: string
  email: string
  phone: string
  interest: string
  message: string
  status: ContactRequestStatus
  placement_attempt?: string
  placement_level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | ''
  placement_score?: number
  created: string
  updated: string
}

export const demoContactRequests: ContactRequestRecord[] = [
  {
    id: 'demo-contact-1',
    collectionId: 'demo',
    collectionName: collections.contactRequests,
    expand: {},
    name: 'María Demo',
    email: 'maria@example.com',
    phone: '600 000 000',
    interest: 'Preparación B1',
    message: 'Quiero información sobre horarios y grupos disponibles.',
    status: 'NEW',
    placement_attempt: '',
    placement_level: '',
    placement_score: 0,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  },
]

function requireAdmin() {
  if (isDemoMode) return
  const user = pb.authStore.record
  if (!user || user.role !== 'ADMIN') throw new Error('Se requiere una sesión ADMIN.')
}

function statusFilter(status?: ContactRequestStatus | 'ALL'): string {
  if (!status || status === 'ALL') return ''
  return `status = "${status}"`
}

export async function listContactRequests(status: ContactRequestStatus | 'ALL' = 'ALL'): Promise<ContactRequestRecord[]> {
  if (isDemoMode) {
    return status === 'ALL' ? demoContactRequests : demoContactRequests.filter((item) => item.status === status)
  }
  requireAdmin()
  return pb.collection(collections.contactRequests).getFullList<ContactRequestRecord>({
    filter: statusFilter(status),
    sort: '-created',
  })
}

export async function countNewContactRequests(): Promise<number> {
  if (isDemoMode) return demoContactRequests.filter((item) => item.status === 'NEW').length
  requireAdmin()
  const result = await pb.collection(collections.contactRequests).getList<ContactRequestRecord>(1, 1, {
    filter: 'status = "NEW"',
    fields: 'id',
  })
  return result.totalItems
}

export async function updateContactRequestStatus(
  id: string,
  status: ContactRequestStatus,
): Promise<ContactRequestRecord> {
  requireAdmin()
  return pb.collection(collections.contactRequests).update<ContactRequestRecord>(id, { status })
}
