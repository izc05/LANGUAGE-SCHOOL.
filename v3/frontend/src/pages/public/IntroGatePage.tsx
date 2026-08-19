import { lazy, Suspense, useState } from 'react'
import IntroSceneErrorBoundary from './intro/premium/IntroSceneErrorBoundary'
import './intro/premium/intro-gate-light.css'

const HomePage = lazy(() => import('./HomePage'))
const IntroPage = lazy(() => import('./intro/IntroPage'))
const INTRO_SESSION_KEY = 'language-school:intro-completed'
const SAFE_ENTER_TRANSITION_MS = 520

function introAlreadyCompleted(): boolean {
  try {
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

function StaticIntroFallback({ onEnter }: { onEnter: () => void }) {
  const [transitioning, setTransitioning] = useState(false)

  function startEnter() {
    if (transitioning) return
    setTransitioning(true)
    window.setTimeout(onEnter, SAFE_ENTER_TRANSITION_MS)
  }

  return (
    <main className={`intro-gate-light${transitioning ? ' is-transitioning' : ''}`}>
      <div className="intro-gate-ambient" aria-hidden="true" />
      <LightweightOrbitLockup />

      <div className="intro-gate-actions">
        <p className="intro-gate-instruction">Bienvenido a Language School</p>
        <button
          className="intro-gate-enter"
          type="button"
          onClick={startEnter}
          disabled={transitioning}
        >
          <span>{transitioning ? 'ENTRANDO…' : 'ENTRAR'}</span>
          {!transitioning && <span aria-hidden="true">↗</span>}
        </button>
      </div>

      <div className="intro-gate-transition" aria-hidden="true" />
    </main>
  )
}

export default function IntroGatePage() {
  const [completed, setCompleted] = useState(introAlreadyCompleted)

  function enterAcademy() {
    try {
      window.sessionStorage.setItem(INTRO_SESSION_KEY, 'true')
    } catch {
      // La portada sigue accesible aunque el navegador bloquee sessionStorage.
    }
    window.scrollTo({ top: 0, left: 0 })
    setCompleted(true)
  }

  if (completed) {
    return (
      <Suspense fallback={<HomeLoadingFallback />}>
        <HomePage />
      </Suspense>
    )
  }

  return (
    <IntroSceneErrorBoundary fallback={<StaticIntroFallback onEnter={enterAcademy} />}>
      <Suspense fallback={<IntroLoadingFallback />}>
        <IntroPage onEnter={enterAcademy} />
      </Suspense>
    </IntroSceneErrorBoundary>
  )
}
