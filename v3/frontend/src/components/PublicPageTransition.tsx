import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import '../styles/public-page-transition.css'

type TransitionPhase = 'idle' | 'covering' | 'holding' | 'revealing'

const COVER_MS = 260
const HOLD_MS = 115
const REVEAL_MS = 390

function isPublicSitePath(pathname: string) {
  return !/^\/(admin|alumno|profesor)(?:\/|$)/.test(pathname)
}

function isPlainPrimaryClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

export default function PublicPageTransition() {
  const location = useLocation()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<TransitionPhase>('idle')
  const phaseRef = useRef<TransitionPhase>('idle')
  const currentPathRef = useRef(location.pathname)
  const routedByTransitionRef = useRef(false)
  const mountedRef = useRef(false)
  const timersRef = useRef<number[]>([])

  const setTransitionPhase = (nextPhase: TransitionPhase) => {
    phaseRef.current = nextPhase
    setPhase(nextPhase)
  }

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer))
      timersRef.current = []
    }
  }, [])

  useEffect(() => {
    currentPathRef.current = location.pathname

    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }

    if (routedByTransitionRef.current) {
      routedByTransitionRef.current = false
      return
    }

    if (!isPublicSitePath(location.pathname) || phaseRef.current !== 'idle') return

    // Browser back/forward and programmatic public navigation still receive a
    // short branded reveal, without delaying the navigation itself.
    setTransitionPhase('revealing')
    const timer = window.setTimeout(() => setTransitionPhase('idle'), REVEAL_MS)
    timersRef.current.push(timer)
  }, [location.key, location.pathname])

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!isPlainPrimaryClick(event) || event.defaultPrevented || phaseRef.current !== 'idle') return
      if (!isPublicSitePath(currentPathRef.current)) return

      const target = event.target
      if (!(target instanceof Element)) return

      const anchor = target.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      if (anchor.dataset.noPageTransition === 'true') return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return

      let nextUrl: URL
      try {
        nextUrl = new URL(anchor.href, window.location.href)
      } catch {
        return
      }

      if (nextUrl.origin !== window.location.origin || !isPublicSitePath(nextUrl.pathname)) return

      const currentUrl = new URL(window.location.href)
      const sameDestination =
        nextUrl.pathname === currentUrl.pathname &&
        nextUrl.search === currentUrl.search &&
        nextUrl.hash === currentUrl.hash
      if (sameDestination) return

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reducedMotion) return

      event.preventDefault()
      setTransitionPhase('covering')

      const coverTimer = window.setTimeout(() => {
        routedByTransitionRef.current = true
        setTransitionPhase('holding')
        navigate(`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`)

        const holdTimer = window.setTimeout(() => {
          setTransitionPhase('revealing')

          const revealTimer = window.setTimeout(() => setTransitionPhase('idle'), REVEAL_MS)
          timersRef.current.push(revealTimer)
        }, HOLD_MS)

        timersRef.current.push(holdTimer)
      }, COVER_MS)

      timersRef.current.push(coverTimer)
    }

    document.addEventListener('click', onDocumentClick, true)
    return () => document.removeEventListener('click', onDocumentClick, true)
  }, [navigate])

  return (
    <div
      className={`public-page-transition public-page-transition--${phase}`}
      aria-hidden="true"
      data-testid="public-page-transition"
    >
      <div className="public-page-transition__wash" />
      <div className="public-page-transition__veil public-page-transition__veil--left" />
      <div className="public-page-transition__veil public-page-transition__veil--right" />
      <div className="public-page-transition__streak" />
      <div className="public-page-transition__mark">
        <span />
        <i>♥</i>
        <span />
      </div>
    </div>
  )
}
