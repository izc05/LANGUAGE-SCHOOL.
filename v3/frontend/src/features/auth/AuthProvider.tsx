import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { isDemoMode } from '../../config/environment'
import {
  getCurrentUser,
  loginWithPassword,
  logout as clearAuth,
  refreshAuthentication,
  resendMfaOtp,
  verifyMfaWithOtp,
  type LoginResult,
  type MfaChallenge,
} from '../../services/pocketbase/auth'
import { pb } from '../../services/pocketbase/client'
import type { AppUser } from '../../services/pocketbase/types'

type AuthContextValue = {
  user: AppUser | null
  ready: boolean
  isAuthenticated: boolean
  isDemoMode: boolean
  login: (email: string, password: string) => Promise<LoginResult>
  verifyMfa: (challenge: MfaChallenge, code: string) => Promise<AppUser>
  resendMfa: (challenge: MfaChallenge) => Promise<MfaChallenge>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => getCurrentUser())
  const [ready, setReady] = useState(isDemoMode)

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange(() => {
      setUser(getCurrentUser())
    }, true)

    if (!isDemoMode) {
      refreshAuthentication()
        .then(setUser)
        .finally(() => setReady(true))
    }

    return unsubscribe
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    ready,
    isAuthenticated: Boolean(user && pb.authStore.isValid),
    isDemoMode,
    async login(email: string, password: string) {
      const result = await loginWithPassword({ email, password })
      if (result.kind === 'AUTHENTICATED') setUser(result.user)
      return result
    },
    async verifyMfa(challenge: MfaChallenge, code: string) {
      const authenticatedUser = await verifyMfaWithOtp({
        mfaId: challenge.mfaId,
        otpId: challenge.otpId,
        code,
      })
      setUser(authenticatedUser)
      return authenticatedUser
    },
    async resendMfa(challenge: MfaChallenge) {
      return resendMfaOtp(challenge)
    },
    logout() {
      clearAuth()
      setUser(null)
    },
  }), [ready, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth debe utilizarse dentro de AuthProvider.')
  return value
}
