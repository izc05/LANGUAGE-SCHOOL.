import { lazy, Suspense, useState } from 'react'
import IntroSceneErrorBoundary from './intro/premium/IntroSceneErrorBoundary'
import './intro/premium/premium-intro.css'
import './intro/premium/intro-orbit-refresh.css'

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
    <div className="intro-orbit-stage">
      <div className="intro-orbit-sphere" aria-hidden="true" />
      <section className="premium-brand-lockup intro-orbit-brand" aria-label="Language School Rocío Ruiz">
        <span className="premium-brand-language">LANGUAGE</span>
        <strong className="premium-brand-school">School</strong>
        <div className="premium-brand-divider" aria-hidden="true" />
        <span className="premium-brand-rocio">ROCÍO RUIZ</span>
      </section>
    </div>
  )
}

function IntroLoadingFallback() {
  return (
    <main className="premium-intro intro-orbit-refresh brand-visible actions-visible settled" aria-busy="true">
      <div className="intro-orbit-ambient" aria-hidden="true" />
      <LightweightOrbitLockup />
      <div className="premium-entry-actions intro-orbit-actions" role="status">
        <p className="premium-instruction">Preparando la entrada…</p>
      </div>
    </main>
  )
}

function HomeLoadingFallback() {
  return <div className="intro-loading" role="status">Preparando Language School…</div>
}

function StaticIntroFallback({ onEnter }: { onEnter: () => void }) {
  const [transitioning, setTransitioning] = useState(false)

  function startEnter() {
    if (transitioning) return
    setTransitioning(true)
    window.setTimeout(onEnter, SAFE_ENTER_TRANSITION_MS)
  }

  const classes = [
    'premium-intro',
    'intro-orbit-refresh',
    'brand-visible',
    'actions-visible',
    'settled',
    transitioning ? 'is-transitioning' : '',
  ].filter(Boolean).join(' ')

  return (
    <main className={classes}>
      <div className="intro-orbit-ambient" aria-hidden="true" />
      <LightweightOrbitLockup />

      <div className="premium-entry-actions intro-orbit-actions">
        <p className="premium-instruction">Bienvenido a Language School</p>
        <button
          className="premium-enter-button intro-enter-button"
          type="button"
          onClick={startEnter}
          disabled={transitioning}
        >
          <span>{transitioning ? 'ENTRANDO…' : 'ENTRAR'}</span>
          {!transitioning && <span aria-hidden="true" className="premium-enter-arrow">↗</span>}
        </button>
      </div>

      <div className="intro-orbit-transition" aria-hidden="true" />
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
