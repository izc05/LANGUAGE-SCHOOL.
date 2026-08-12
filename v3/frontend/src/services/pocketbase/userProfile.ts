import { isDemoMode } from '../../config/environment'
import { getCurrentUser } from './auth'
import { collections } from './collections'
import { pb } from './client'
import type { AppUser } from './types'

export type UserProfileInput = {
  name: string
  surname: string
  phone: string
  avatar?: File | null
}

export function getUserAvatarUrl(user: AppUser, thumb = '300x300'): string {
  if (!user.avatar) return ''
  return pb.files.getURL(user, user.avatar, { thumb })
}

export async function updateMyUserProfile(input: UserProfileInput): Promise<AppUser> {
  const current = getCurrentUser()
  if (!current) throw new Error('Debes iniciar sesión para actualizar tu perfil.')

  if (isDemoMode) {
    return {
      ...current,
      name: input.name.trim(),
      surname: input.surname.trim(),
      phone: input.phone.trim(),
    }
  }

  const data = new FormData()
  data.set('name', input.name.trim())
  data.set('surname', input.surname.trim())
  data.set('phone', input.phone.trim())
  if (input.avatar) data.set('avatar', input.avatar)

  const updated = await pb.collection(collections.users).update<AppUser>(current.id, data)

  // Keep AuthProvider and every open view synchronized with the updated auth
  // record without issuing a new token.
  pb.authStore.save(pb.authStore.token, updated)
  return updated
}
