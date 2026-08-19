import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type PropsWithChildren,
} from 'react'
import { useNavigate } from 'react-router'

export const CLOUD_PORTAL_WHITEOUT_MS = 2650
export const CLOUD_PORTAL_DURATION_MS = 3050

type CloudPortalAction = () => void | Promise<void>

type CloudPortalTransitionProps = {
  onWhiteout: () => void
  onComplete: () => void
}

type CloudPortalContextValue = {
  isTransitioning: boolean
  startCloudPortal: (action: CloudPortalAction) => Promise<boolean>
}

const CloudPortalContext = createContext<CloudPortalContextValue | null>(null)

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function isStudentClassroomPath(pathname: string): boolean {
  return /^\/alumno\/aula\/[^/]+\/?$/.test(pathname)
}

export function CloudPortalProvider({ children }: PropsWithChildren) {
  const navigate = useNavigate()
  const [TransitionComponent, setTransitionComponent] = useState<ComponentType<CloudPortalTransitionProps> | null>(null)
  const [active, setActive] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [sequence, setSequence] = useState(0)
  const inFlightRef = useRef(false)
  const actionRef = useRef<CloudPortalAction | null>(null)
  const actionFiredRef = useRef(false)

  const reset = useCallback(() => {
    actionRef.current = null
    actionFiredRef.current = false
    inFlightRef.current = false
    setActive(false)
    setPreparing(false)
  }, [])

  const runActionImmediately = useCallback(async (action: CloudPortalAction) => {
    try {
      await action()
    } finally {
      reset()
    }
  }, [reset])

  const startCloudPortal = useCallback(async (action: CloudPortalAction): Promise<boolean> => {
    if (inFlightRef.current) return false

    inFlightRef.current = true
    actionRef.current = action
    actionFiredRef.current = false
    setPreparing(true)

    if (prefersReducedMotion()) {
      await runActionImmediately(action)
      return true
    }

    try {
      const module = await import('../../components/CloudPortalTransition')
      setTransitionComponent(() => module.default)
      setSequence((value) => value + 1)
      setActive(true)
      setPreparing(false)
      return true
    } catch {
      await runActionImmediately(action)
      return true
    }
  }, [runActionImmediately])

  useEffect(() => {
    const handleInternalClassroomLink = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) return

      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement)) return
      if ((anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return

      let url: URL
      try {
        url = new URL(anchor.href, window.location.href)
      } catch {
        return
      }

      if (url.origin !== window.location.origin || !isStudentClassroomPath(url.pathname)) return

      event.preventDefault()
      if (inFlightRef.current) return
      const destination = `${url.pathname}${url.search}${url.hash}`
      void startCloudPortal(() => navigate(destination))
    }

    document.addEventListener('click', handleInternalClassroomLink, true)
    return () => document.removeEventListener('click', handleInternalClassroomLink, true)
  }, [navigate, startCloudPortal])

  const handleWhiteout = useCallback(() => {
    if (actionFiredRef.current) return
    actionFiredRef.current = true
    const action = actionRef.current
    if (!action) return

    void Promise.resolve(action()).catch(() => {
      // La transición nunca debe bloquear la aplicación si la acción de destino falla.
    })
  }, [])

  const handleComplete = useCallback(() => {
    reset()
  }, [reset])

  const value: CloudPortalContextValue = {
    isTransitioning: preparing || active,
    startCloudPortal,
  }

  return (
    <CloudPortalContext.Provider value={value}>
      {children}
      {active && TransitionComponent && (
        <TransitionComponent
          key={sequence}
          onWhiteout={handleWhiteout}
          onComplete={handleComplete}
        />
      )}
    </CloudPortalContext.Provider>
  )
}

export function useCloudPortal(): CloudPortalContextValue {
  const value = useContext(CloudPortalContext)
  if (!value) throw new Error('useCloudPortal debe utilizarse dentro de CloudPortalProvider')
  return value
}
