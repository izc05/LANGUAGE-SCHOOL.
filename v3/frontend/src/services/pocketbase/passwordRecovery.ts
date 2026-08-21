import { ClientResponseError } from 'pocketbase'
import { collections } from './collections'
import { pb } from './client'

export async function requestPasswordRecovery(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) throw new Error('Introduce tu email.')
  await pb.collection(collections.users).requestPasswordReset(normalizedEmail)
}

export async function confirmPasswordRecovery(input: {
  token: string
  password: string
  passwordConfirm: string
}): Promise<void> {
  const token = input.token.trim()
  if (!token) throw new Error('El enlace de recuperación no contiene un token válido.')
  if (input.password.length < 8) throw new Error('La nueva contraseña debe tener al menos 8 caracteres.')
  if (input.password !== input.passwordConfirm) throw new Error('Las contraseñas no coinciden.')

  await pb.collection(collections.users).confirmPasswordReset(
    token,
    input.password,
    input.passwordConfirm,
  )
}

export function getPasswordRecoveryErrorMessage(error: unknown): string {
  if (error instanceof ClientResponseError) {
    if (error.status === 0) return 'No se puede conectar con el servidor de la academia.'
    if (error.status === 400) return 'El enlace no es válido o ha caducado. Solicita uno nuevo.'
    if (error.status >= 500) return 'El servicio de recuperación no está disponible en este momento.'
  }

  if (error instanceof Error && error.message) return error.message
  return 'No se ha podido completar la recuperación de la cuenta.'
}
