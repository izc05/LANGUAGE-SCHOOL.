import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import type { UserRole } from '../../services/pocketbase/types'
import { useAuth } from './AuthProvider'

type RequireRoleProps = {
  allow: UserRole[]
  children: ReactNode
}

function routeForRole(role: UserRole): string {
  if (role === 'ADMIN') return '/admin'
  if (role === 'TEACHER') return '/profesor'
  return '/alumno'
}

export default function RequireRole({ allow, children }: RequireRoleProps) {
  const { ready, user, isAuthenticated, isDemoMode } = useAuth()

  // Demo mode intentionally keeps all preview routes visible while the
  // Raspberry/PocketBase instance is not available yet.
  if (isDemoMode) return <>{children}</>

  if (!ready) {
    return <div className="auth-loading">Comprobando acceso…</div>
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/acceso" replace />
  }

  if (!allow.includes(user.role)) {
    return <Navigate to={routeForRole(user.role)} replace />
  }

  return <>{children}</>
}
