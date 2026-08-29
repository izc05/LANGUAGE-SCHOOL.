import { useCallback, useEffect, useState } from 'react'
import { isDemoMode } from '../config/environment'
import { checkBackendHealth } from '../services/pocketbase/health'

export function useBackendHealth() {
  const [unavailable, setUnavailable] = useState(false)
  const [checking, setChecking] = useState(false)

  const retry = useCallback(async () => {
    if (isDemoMode) {
      setUnavailable(false)
      return
    }

    setChecking(true)
    try {
      const health = await checkBackendHealth()
      setUnavailable(!health.ok)
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    void retry()
  }, [retry])

  return { unavailable, checking, retry }
}
