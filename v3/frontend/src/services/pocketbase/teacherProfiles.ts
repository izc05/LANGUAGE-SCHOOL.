import { isDemoMode } from '../../config/environment'
import { collections } from './collections'
import { pb } from './client'
import type { TeacherProfileRecord } from './teacherPortal'

export type PublicTeacherProfile = TeacherProfileRecord & {
  display_name: string
  headline: string
  sort_order: number
}

export const demoPublicTeachers: PublicTeacherProfile[] = [
  {
    id: 'demo-rocio',
    collectionId: 'demo',
    collectionName: collections.teacherProfiles,
    created: '',
    updated: '',
    expand: {},
    user: '',
    bio: 'Acompañamiento cercano, práctica útil y objetivos claros para que el inglés se convierta en una herramienta real.',
    specialties: ['Speaking', 'Exámenes', 'Adultos'],
    public_photo: '',
    public_profile: true,
    active: true,
    display_name: 'Rocío Ruiz',
    headline: 'Dirección académica · English Teacher',
    sort_order: 10,
  },
]

function requireAdmin() {
  if (isDemoMode) return
  const record = pb.authStore.record
  if (!record || record.role !== 'ADMIN') throw new Error('Se requiere una sesión ADMIN.')
}

export function teacherSpecialties(record: TeacherProfileRecord): string[] {
  if (Array.isArray(record.specialties)) {
    return record.specialties.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  }
  if (typeof record.specialties === 'string' && record.specialties.trim()) {
    try {
      const parsed = JSON.parse(record.specialties)
      if (Array.isArray(parsed)) return parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    } catch {
      return record.specialties.split(',').map((value) => value.trim()).filter(Boolean)
    }
  }
  return []
}

export function getTeacherPhotoUrl(record: TeacherProfileRecord, thumb = '800x800'): string {
  if (!record.public_photo) return ''
  return pb.files.getURL(record, record.public_photo, { thumb })
}

export async function listPublicTeacherProfiles(): Promise<PublicTeacherProfile[]> {
  if (isDemoMode) return demoPublicTeachers
  return pb.collection(collections.teacherProfiles).getFullList<PublicTeacherProfile>({
    filter: 'public_profile = true && active = true',
    sort: 'sort_order,display_name',
  })
}

export async function listAdminTeacherProfiles(): Promise<TeacherProfileRecord[]> {
  requireAdmin()
  return pb.collection(collections.teacherProfiles).getFullList<TeacherProfileRecord>({ sort: 'sort_order,display_name' })
}

export async function updateAdminTeacherPublicProfile(
  record: TeacherProfileRecord,
  patch: Partial<Pick<TeacherProfileRecord, 'display_name' | 'headline' | 'bio' | 'specialties' | 'public_profile' | 'active' | 'sort_order'>> & { publicPhoto?: File | null },
): Promise<TeacherProfileRecord> {
  requireAdmin()
  const payload = new FormData()

  if (patch.display_name !== undefined) payload.set('display_name', patch.display_name.trim())
  if (patch.headline !== undefined) payload.set('headline', patch.headline.trim())
  if (patch.bio !== undefined) payload.set('bio', patch.bio.trim())
  if (patch.specialties !== undefined) payload.set('specialties', JSON.stringify(Array.isArray(patch.specialties) ? patch.specialties : teacherSpecialties({ ...record, specialties: patch.specialties })))
  if (patch.public_profile !== undefined) payload.set('public_profile', String(patch.public_profile))
  // `active` is intentionally account-owned and is never sent by profile editors.
  if (patch.sort_order !== undefined) payload.set('sort_order', String(patch.sort_order))
  if (patch.publicPhoto) payload.set('public_photo', patch.publicPhoto)

  return pb.collection(collections.teacherProfiles).update<TeacherProfileRecord>(record.id, payload)
}
