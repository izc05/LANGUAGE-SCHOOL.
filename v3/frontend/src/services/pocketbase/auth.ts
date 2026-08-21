import { ClientResponseError } from 'pocketbase'
import { collections } from './collections'
import { pb } from './client'
import { asAppUser, type AppUser } from './types'

export type LoginCredentials = {
  email: string
  password: string
}

export type MfaChallenge = {
  kind: 'MFA_REQUIRED'
  email: string
  mfaId: string
  otpId: string
}

export type LoginResult =
  | { kind: 'AUTHENTICATED'; user: AppUser }
  | MfaChallenge

export type MfaVerification = {
  mfaId: string
  otpId: string
  code: string
}

function validateAuthenticatedUser(record: unknown): AppUser {
  const user = asAppUser(record as Parameters<typeof asAppUser>[0])

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

function readMfaId(error: unknown): string | null {
  if (!(error instanceof ClientResponseError)) return null
  const response = error.response as { mfaId?: unknown } | undefined
  return typeof response?.mfaId === 'string' && response.mfaId ? response.mfaId : null
}

export async function loginWithPassword({ email, password }: LoginCredentials): Promise<LoginResult> {
  const normalizedEmail = email.trim().toLowerCase()

  try {
    const result = await pb.collection(collections.users).authWithPassword(normalizedEmail, password)
    return { kind: 'AUTHENTICATED', user: validateAuthenticatedUser(result.record) }
  } catch (error) {
    const mfaId = readMfaId(error)
    if (!mfaId) throw error

    // PocketBase intentionally does not issue a valid auth token after the
    // first factor when MFA applies. Request the second factor only after the
    // password has already been accepted by the server.
    pb.authStore.clear()
    const otp = await pb.collection(collections.users).requestOTP(normalizedEmail)
    return { kind: 'MFA_REQUIRED', email: normalizedEmail, mfaId, otpId: otp.otpId }
  }
}

export async function verifyMfaWithOtp({ mfaId, otpId, code }: MfaVerification): Promise<AppUser> {
  const normalizedCode = code.trim()
  const result = await pb.collection(collections.users).authWithOTP(otpId, normalizedCode, { mfaId })
  return validateAuthenticatedUser(result.record)
}

export async function resendMfaOtp(challenge: MfaChallenge): Promise<MfaChallenge> {
  const otp = await pb.collection(collections.users).requestOTP(challenge.email)
  return { ...challenge, otpId: otp.otpId }
}

export async function refreshAuthentication(): Promise<AppUser | null> {
  if (!pb.authStore.isValid) return null

  try {
    const result = await pb.collection(collections.users).authRefresh()
    return validateAuthenticatedUser(result.record)
  } catch {
    pb.authStore.clear()
    return null
  }
}

export function logout(): void {
  pb.authStore.clear()
}

export function getCurrentUser(): AppUser | null {
  const user = asAppUser(pb.authStore.record)
  return user?.status === 'ACTIVE' ? user : null
}

export function getLoginErrorMessage(error: unknown): string {
  if (error instanceof ClientResponseError) {
    if (error.status === 429) return 'Demasiados intentos. Espera unos minutos antes de volver a probar.'
    if (error.status === 400 || error.status === 401) return 'Email o contraseña incorrectos.'
    if (error.status === 0) return 'No se puede conectar con el servidor de la academia.'
  }

  if (error instanceof Error && error.message) return error.message
  return 'No se ha podido iniciar sesión.'
}

export function getMfaErrorMessage(error: unknown): string {
  if (error instanceof ClientResponseError) {
    if (error.status === 429) return 'Demasiados intentos. Espera unos minutos antes de solicitar o probar otro código.'
    if (error.status === 400 || error.status === 401) return 'El código no es válido o ha caducado. Solicita uno nuevo y vuelve a intentarlo.'
    if (error.status === 0) return 'No se puede conectar con el servidor de la academia.'
  }

  if (error instanceof Error && error.message) return error.message
  return 'No se ha podido verificar el código de seguridad.'
}
