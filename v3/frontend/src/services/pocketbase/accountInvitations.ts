import { getCurrentUser } from './auth'
import { pb } from './client'
import type { UserStatus } from './types'

export type AdminAccountInvitationStatus = 'NONE' | 'PENDING' | 'EXPIRED' | 'USED' | 'REVOKED'
export type InvitableAccountRole = 'ADMIN' | 'STUDENT' | 'TEACHER'

export type AdminAccountInvitationStatusResponse = {
  userId: string
  accountStatus: UserStatus
  invitationStatus: AdminAccountInvitationStatus
  invitationId?: string
  expiresAt?: string
  sentAt?: string | null
  usedAt?: string | null
  revokedAt?: string | null
}

export type AdminAccountInvitationIssueResponse = {
  userId: string
  invitationId: string
  status: 'PENDING'
  expiresAt: string
  activationUrl: string
  emailSent: boolean
}

export type AdminAccountInvitationRevokeResponse = {
  userId: string
  status: 'REVOKED'
}

export type AccountActivationResponse = {
  success: true
  userId: string
}

export type AdminAccountInvitationCreateInput = {
  role: InvitableAccountRole
  email: string
  name: string
  surname: string
  phone?: string
  birthDate?: string
  guardianName?: string
  guardianPhone?: string
  bio?: string
  specialties?: string[]
  publicProfile?: boolean
  activationBaseUrl?: string
}

function requireAdmin() {
  const user = getCurrentUser()
  if (!user || user.role !== 'ADMIN') throw new Error('Se requiere una sesión de administrador activa.')
  return user
}

function resolveActivationBaseUrl(explicit?: string): string {
  const value = explicit?.trim().replace(/\/+$/, '') || ''
  if (value) return value
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

export async function activateAccountInvitation(input: {
  token: string
  password: string
  passwordConfirm: string
}): Promise<AccountActivationResponse> {
  return pb.send<AccountActivationResponse>('/api/language-school/account/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: input.token.trim(),
      password: input.password,
      passwordConfirm: input.passwordConfirm,
    }),
  })
}

export async function issueAdminAccountInvitation(
  input: AdminAccountInvitationCreateInput,
): Promise<AdminAccountInvitationIssueResponse> {
  requireAdmin()
  return pb.send<AdminAccountInvitationIssueResponse>('/api/language-school/admin/accounts/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role: input.role,
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
      surname: input.surname.trim(),
      phone: input.phone?.trim() || '',
      birthDate: input.birthDate || '',
      guardianName: input.guardianName?.trim() || '',
      guardianPhone: input.guardianPhone?.trim() || '',
      bio: input.bio?.trim() || '',
      specialties: input.specialties || [],
      publicProfile: Boolean(input.publicProfile),
      activationBaseUrl: resolveActivationBaseUrl(input.activationBaseUrl),
    }),
  })
}

export async function getAdminAccountInvitationStatus(userId: string): Promise<AdminAccountInvitationStatusResponse> {
  requireAdmin()
  return pb.send<AdminAccountInvitationStatusResponse>('/api/language-school/admin/accounts/invite/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
}

export async function reissueAdminAccountInvitation(
  userId: string,
  activationBaseUrl?: string,
): Promise<AdminAccountInvitationIssueResponse> {
  requireAdmin()
  return pb.send<AdminAccountInvitationIssueResponse>('/api/language-school/admin/accounts/invite/resend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, activationBaseUrl: resolveActivationBaseUrl(activationBaseUrl) }),
  })
}

export async function revokeAdminAccountInvitation(userId: string): Promise<AdminAccountInvitationRevokeResponse> {
  requireAdmin()
  return pb.send<AdminAccountInvitationRevokeResponse>('/api/language-school/admin/accounts/invite/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
}
