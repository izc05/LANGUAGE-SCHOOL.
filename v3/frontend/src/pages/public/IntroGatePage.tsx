import { lazy, Suspense, useEffect, useState } from 'react'
import { isDemoMode } from '../../config/environment'
import { useCloudPortal } from '../../features/transitions/CloudPortalProvider'
import IntroSceneErrorBoundary from './intro/premium/IntroSceneErrorBoundary'
import './intro/premium/intro-gate-light.css'

const HomePage = lazy(() => import('./HomePage'))
const IntroPage = lazy(() => import('./intro/IntroPage'))
const INTRO_SESSION_KEY = 'language-school:intro-completed'
let introCompletedForDocument = false

function forceIntroReview(): boolean {
  if (!isDemoMode) return false
  try {
    return new URLSearchParams(window.location.search).get('reviewIntro') === '1'
  } catch {
    return false
  }
}

function introAlreadyCompleted(): boolean {
  if (forceIntroReview()) return false
  if (introCompletedForDocument) return true

  const navigation = window.performance
    .getEntriesByType('navigation')
    .at(0) as PerformanceNavigationTiming | undefined
  if (navigation?.type === 'back_forward') return false

  try {
    if (document.referrer && new URL(document.referrer).origin !== window.location.origin) {
      return false
    }
    return window.sessionStorage.getItem(INTRO_SESSION_KEY) === 'true'
  } catch {
    return false
  }
}

function LightweightOrbitLockup() {
  return (
    <div className="intro-gate-stage">
      <div className="intro-gate-sphere" aria-hidden="true" />
      <section className="intro-gate-brand" aria-label="Language School Rocío Ruiz">
        <span className="intro-gate-language">LANGUAGE</span>
        <strong className="intro-gate-school">School</strong>
        <div className="intro-gate-divider" aria-hidden="true" />
        <span className="intro-gate-rocio">ROCÍO RUIZ</span>
      </section>
    </div>
  )
}

function IntroLoadingFallback() {
  return (
    <main className="intro-gate-light" aria-busy="true">
      <div className="intro-gate-ambient" aria-hidden="true" />
      <LightweightOrbitLockup />
      <div className="intro-gate-actions" role="status">
        <p className="intro-gate-instruction">Preparando la entrada…</p>
      </div>
    </main>
  )
}

function HomeLoadingFallback() {
  return <div className="intro-home-loading" role="status">Preparando Language School…</div>
}

function StaticIntroFallback({ onEnter, transitioning }: { onEnter: () => void; transitioning: boolean }) {
  return (
    <main className="intro-gate-light">
      <div className="intro-gate-ambient" aria-hidden="true" />
      <LightweightOrbitLockup />

      <div className="intro-gate-actions">
        <p className="intro-gate-instruction">Bienvenido a Language School</p>
        <button
          className="intro-gate-enter"
          type="button"
          onClick={onEnter}
          disabled={transitioning}
        >
          <span>{transitioning ? 'ENTRANDO…' : 'ENTRAR'}</span>
          {!transitioning && <span aria-hidden="true">↗</span>}
        </button>
      </div>
    </main>
  )
}

export default function IntroGatePage() {
  const [completed, setCompleted] = useState(introAlreadyCompleted)
  const { isTransitioning, startCloudPortal } = useCloudPortal()

  useEffect(() => {
    const replayAfterExternalReturn = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      introCompletedForDocument = false
      try {
        window.sessionStorage.removeItem(INTRO_SESSION_KEY)
      } catch {
        // La portada puede repetirse aunque el navegador bloquee sessionStorage.
      }
      setCompleted(false)
    }

    window.addEventListener('pageshow', replayAfterExternalReturn)
    return () => window.removeEventListener('pageshow', replayAfterExternalReturn)
  }, [])

  function completeEntry() {
    introCompletedForDocument = true
    try {
      window.sessionStorage.setItem(INTRO_SESSION_KEY, 'true')
    } catch {
      // La portada sigue funcionando aunque el navegador bloquee sessionStorage.
    }
    window.scrollTo({ top: 0, left: 0 })
    setCompleted(true)
  }

  function enterAcademy() {
    if (isTransitioning) return
    void startCloudPortal(completeEntry)
  }

  if (completed) {
    return (
      <Suspense fallback={<HomeLoadingFallback />}>
        <HomePage />
      </Suspense>
    )
  }

  return (
    <IntroSceneErrorBoundary fallback={<StaticIntroFallback onEnter={enterAcademy} transitioning={isTransitioning} />}>
      <Suspense fallback={<IntroLoadingFallback />}>
        <IntroPage onEnter={enterAcademy} transitioning={isTransitioning} />
      </Suspense>
    </IntroSceneErrorBoundary>
  )
}
