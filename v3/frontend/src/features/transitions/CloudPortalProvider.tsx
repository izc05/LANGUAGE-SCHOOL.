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
import { isDemoMode } from '../../config/environment'

export const CLOUD_PORTAL_WHITEOUT_MS = 2650
export const CLOUD_PORTAL_DURATION_MS = 3050
export const CLOUD_PORTAL_REDUCED_WHITEOUT_MS = 420
export const CLOUD_PORTAL_REDUCED_DURATION_MS = 720
const CLOUD_PORTAL_IMAGE_URL = '/visuals/intro-pink-clouds.webp'

type CloudPortalAction = () => void | Promise<void>

type CloudPortalTransitionProps = {
  onWhiteout: () => void
  onComplete: () => void
  reducedMotion: boolean
}

type CloudPortalContextValue = {
  isTransitioning: boolean
  startCloudPortal: (action: CloudPortalAction) => Promise<boolean>
}

const CloudPortalContext = createContext<CloudPortalContextValue | null>(null)

function forceCloudReview(): boolean {
  if (!isDemoMode || typeof window === 'undefined') return false
  try {
    return new URLSearchParams(window.location.search).get('reviewClouds') === '1'
  } catch {
    return false
  }
}

function prefersReducedMotion(): boolean {
  if (forceCloudReview()) return false
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function isStudentClassroomPath(pathname: string): boolean {
  return /^\/alumno\/aula\/[^/]+\/?$/.test(pathname)
}

function EmergencyCloudPortalTransition({ onWhiteout, onComplete }: CloudPortalTransitionProps) {
  useEffect(() => {
    const whiteoutTimer = window.setTimeout(onWhiteout, 180)
    const completeTimer = window.setTimeout(onComplete, 360)
    return () => {
      window.clearTimeout(whiteoutTimer)
      window.clearTimeout(completeTimer)
    }
  }, [onComplete, onWhiteout])

  return (
    <div
      data-cloud-portal="active"
      data-cloud-portal-motion="fallback"
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'radial-gradient(circle, rgba(255,255,255,.96), rgba(244,237,243,.9))',
        pointerEvents: 'all',
      }}
    />
  )
}

export function CloudPortalProvider({ children }: PropsWithChildren) {
  const navigate = useNavigate()
  const [TransitionComponent, setTransitionComponent] = useState<ComponentType<CloudPortalTransitionProps> | null>(null)
  const [active, setActive] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [sequence, setSequence] = useState(0)
  const inFlightRef = useRef(false)
  const actionRef = useRef<CloudPortalAction | null>(null)
  const actionFiredRef = useRef(false)

  useEffect(() => {
    const preloadTimer = window.setTimeout(() => {
      void import('../../components/CloudPortalTransition')
      const image = new Image()
      image.decoding = 'async'
      image.src = CLOUD_PORTAL_IMAGE_URL
    }, 400)

    return () => window.clearTimeout(preloadTimer)
  }, [])

  const reset = useCallback(() => {
    actionRef.current = null
    actionFiredRef.current = false
    inFlightRef.current = false
    setActive(false)
    setPreparing(false)
  }, [])

  const startCloudPortal = useCallback(async (action: CloudPortalAction): Promise<boolean> => {
    if (inFlightRef.current) return false

    inFlightRef.current = true
    actionRef.current = action
    actionFiredRef.current = false
    setPreparing(true)
    const reduced = prefersReducedMotion()
    setReducedMotion(reduced)

    try {
      const module = await import('../../components/CloudPortalTransition')
      setTransitionComponent(() => module.default)
      setSequence((value) => value + 1)
      setActive(true)
      setPreparing(false)
      return true
    } catch {
      setTransitionComponent(() => EmergencyCloudPortalTransition)
      setReducedMotion(true)
      setSequence((value) => value + 1)
      setActive(true)
      setPreparing(false)
      return true
    }
  }, [])

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
          reducedMotion={reducedMotion}
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
