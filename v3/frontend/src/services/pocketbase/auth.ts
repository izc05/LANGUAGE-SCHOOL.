import { ClientResponseError } from 'pocketbase'
import { collections } from './collections'
import { pb } from './client'
import { asAppUser, type AppUser } from './types'

export type LoginCredentials = {
  email: string
  password: string
}

export async function loginWithPassword({ email, password }: LoginCredentials): Promise<AppUser> {
  const normalizedEmail = email.trim().toLowerCase()
  const result = await pb.collection(collections.users).authWithPassword(normalizedEmail, password)
  const user = asAppUser(result.record)

  if (!user) {
    pb.authStore.clear()
    throw new Error('La cuenta autenticada no tiene un rol válido de Language School.')
  }

  if (user.status !== 'ACTIVE') {
    pb.authStore.clear()
    throw new Error('La cuenta no está activa. Contacta con la academia.')
  }

  return user
}

export async function refreshAuthentication(): Promise<AppUser | null> {
  if (!pb.authStore.isValid) return null

  try {
    const result = await pb.collection(collections.users).authRefresh()
    return asAppUser(result.record)
  } catch {
    pb.authStore.clear()
    return null
  }
}

export function logout(): void {
  pb.authStore.clear()
}

export function getCurrentUser(): AppUser | null {
  return asAppUser(pb.authStore.record)
}

export function getLoginErrorMessage(error: unknown): string {
  if (error instanceof ClientResponseError) {
    if (error.status === 400 || error.status === 401) return 'Email o contraseña incorrectos.'
    if (error.status === 0) return 'No se puede conectar con el servidor de la academia.'
  }

  if (error instanceof Error && error.message) return error.message
  return 'No se ha podido iniciar sesión.'
}
