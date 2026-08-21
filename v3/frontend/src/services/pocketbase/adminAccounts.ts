import { getCurrentUser } from './auth'
import { collections } from './collections'
import { pb } from './client'
import type { AppUser, UserStatus } from './types'
import {
  getAdminAccountInvitationStatus,
  issueAdminAccountInvitation,
  reissueAdminAccountInvitation,
  revokeAdminAccountInvitation,
  type AdminAccountInvitationIssueResponse,
  type AdminAccountInvitationStatus,
} from './accountInvitations'

export type AdminAccountRow = {
  id: string
  email: string
  name: string
  surname: string
  phone: string
  status: UserStatus
  invitationStatus: AdminAccountInvitationStatus
  invitationExpiresAt?: string
  invitationSentAt?: string | null
}

function requireAdmin() {
  const user = getCurrentUser()
  if (!user || user.role !== 'ADMIN') throw new Error('Se requiere una sesión de administrador activa.')
  return user
}

export async function listAdminAccounts(): Promise<AdminAccountRow[]> {
  requireAdmin()
  const accounts = await pb.collection(collections.users).getFullList<AppUser>({
    filter: 'role = "ADMIN"',
    sort: 'name,surname,email',
    fields: 'id,email,name,surname,phone,role,status,verified,created,updated',
  })

  return Promise.all(accounts.map(async (account) => {
    let invitationStatus: AdminAccountInvitationStatus = 'NONE'
    let invitationExpiresAt: string | undefined
    let invitationSentAt: string | null | undefined

    if (account.status === 'INVITED') {
      const invitation = await getAdminAccountInvitationStatus(account.id)
      invitationStatus = invitation.invitationStatus
      invitationExpiresAt = invitation.expiresAt
      invitationSentAt = invitation.sentAt
    }

    return {
      id: account.id,
      email: account.email,
      name: account.name,
      surname: account.surname,
      phone: account.phone || '',
      status: account.status,
      invitationStatus,
      invitationExpiresAt,
      invitationSentAt,
    }
  }))
}

export async function inviteAdminAccount(input: {
  email: string
  name: string
  surname: string
  phone?: string
}): Promise<AdminAccountInvitationIssueResponse> {
  requireAdmin()
  return issueAdminAccountInvitation({
    role: 'ADMIN',
    email: input.email,
    name: input.name,
    surname: input.surname,
    phone: input.phone,
  })
}

export async function resendAdminAccountInvitation(userId: string): Promise<AdminAccountInvitationIssueResponse> {
  requireAdmin()
  return reissueAdminAccountInvitation(userId)
}

export async function revokeAdminInvitation(userId: string): Promise<void> {
  requireAdmin()
  await revokeAdminAccountInvitation(userId)
}
