import type { RecordModel } from 'pocketbase'
import { getCurrentUser } from './auth'
import { collections } from './collections'
import { pb } from './client'
import type { AppUser } from './types'
import type { TeacherProfileRecord } from './teacherPortal'

function requireAdmin() {
  const user = getCurrentUser()
  if (!user || user.role !== 'ADMIN') throw new Error('Se requiere una sesión de administrador activa.')
  return user
}

function quote(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export type AdminStudentProfilePhase14 = RecordModel & {
  user: string
  birth_date?: string
  guardian_name?: string
  guardian_phone?: string
  notes_private?: string
  active?: boolean
}

async function accountIsActive(userId: string): Promise<boolean> {
  const account = await pb.collection(collections.users).getOne<AppUser>(userId, { fields: 'id,status,role,email,name,surname' })
  return account.status === 'ACTIVE'
}

export async function getAdminStudentProfilePhase14(userId: string): Promise<AdminStudentProfilePhase14 | null> {
  requireAdmin()
  try {
    return await pb.collection(collections.studentProfiles).getFirstListItem<AdminStudentProfilePhase14>(`user = "${quote(userId)}"`)
  } catch (error: unknown) {
    const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: unknown }).status) : 0
    if (status === 404) return null
    throw error
  }
}

export async function saveAdminStudentProfilePhase14(userId: string, patch: {
  birthDate?: string
  guardianName?: string
  guardianPhone?: string
  notesPrivate?: string
  active?: boolean
}): Promise<AdminStudentProfilePhase14> {
  requireAdmin()
  const current = await getAdminStudentProfilePhase14(userId)
  const payload = {
    user: userId,
    birth_date: patch.birthDate || '',
    guardian_name: patch.guardianName?.trim() || '',
    guardian_phone: patch.guardianPhone?.trim() || '',
    notes_private: patch.notesPrivate?.trim() || '',
  }
  if (current) return pb.collection(collections.studentProfiles).update<AdminStudentProfilePhase14>(current.id, payload)
  return pb.collection(collections.studentProfiles).create<AdminStudentProfilePhase14>({
    ...payload,
    active: await accountIsActive(userId),
  })
}

export async function getAdminTeacherProfilePhase14(userId: string): Promise<TeacherProfileRecord | null> {
  requireAdmin()
  try {
    return await pb.collection(collections.teacherProfiles).getFirstListItem<TeacherProfileRecord>(`user = "${quote(userId)}"`)
  } catch (error: unknown) {
    const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: unknown }).status) : 0
    if (status === 404) return null
    throw error
  }
}

export async function saveAdminTeacherProfilePhase14(userId: string, patch: {
  bio?: string
  specialties?: string[]
  publicProfile?: boolean
  active?: boolean
  displayName?: string
  headline?: string
}): Promise<TeacherProfileRecord> {
  requireAdmin()
  const current = await getAdminTeacherProfilePhase14(userId)
  const payload = {
    user: userId,
    bio: patch.bio?.trim() || '',
    specialties: patch.specialties || [],
    public_profile: Boolean(patch.publicProfile),
    display_name: patch.displayName?.trim() || '',
    headline: patch.headline?.trim() || '',
  }
  if (current) return pb.collection(collections.teacherProfiles).update<TeacherProfileRecord>(current.id, payload)
  return pb.collection(collections.teacherProfiles).create<TeacherProfileRecord>({
    ...payload,
    active: await accountIsActive(userId),
  })
}
