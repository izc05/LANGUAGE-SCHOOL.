import { getCurrentUser } from './auth'
import { pb } from './client'
import type { UserStatus } from './types'

export type AdminAccountInvitationStatus = 'NONE' | 'PENDING' | 'EXPIRED' | 'USED' | 'REVOKED'

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
