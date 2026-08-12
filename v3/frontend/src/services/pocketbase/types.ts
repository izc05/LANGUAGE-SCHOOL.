import type { RecordModel } from 'pocketbase'

export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT'
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'

export type AppUser = RecordModel & {
  email: string
  name: string
  surname: string
  role: UserRole
  status: UserStatus
  avatar?: string
  phone?: string
}

export type AuthSnapshot = {
  user: AppUser | null
  isAuthenticated: boolean
  role: UserRole | null
}

export function isUserRole(value: unknown): value is UserRole {
  return value === 'ADMIN' || value === 'TEACHER' || value === 'STUDENT'
}

export function asAppUser(record: RecordModel | null): AppUser | null {
  if (!record || !isUserRole(record.role)) return null
  return record as AppUser
}
