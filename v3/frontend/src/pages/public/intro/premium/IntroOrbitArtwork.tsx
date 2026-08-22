import { lazy, Suspense, useEffect, useState } from 'react'
import './intro-rotating-globe.css'

const PremiumOrbitAirplane = lazy(() => import('./PremiumOrbitAirplane'))
const PremiumRotatingGlobe = lazy(() => import('./PremiumRotatingGlobe'))

type IntroOrbitArtworkProps = {
  withPlane?: boolean
}

export default function IntroOrbitArtwork({ withPlane = true }: IntroOrbitArtworkProps) {
  const [showEnhancedArtwork, setShowEnhancedArtwork] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setShowEnhancedArtwork(true), 140)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="intro-orbit-stage">
      <div className="intro-orbit-sphere" aria-hidden="true" />

      {showEnhancedArtwork && (
        <Suspense fallback={null}>
          {withPlane && <PremiumOrbitAirplane />}
          <PremiumRotatingGlobe />
        </Suspense>
      )}

      <section className="premium-brand-lockup intro-orbit-brand" aria-label="Language School Rocío Ruiz">
        <span className="premium-brand-language">LANGUAGE</span>
        <strong className="premium-brand-school">School</strong>
        <div className="premium-brand-divider" aria-hidden="true" />
        <span className="premium-brand-rocio">ROCÍO RUIZ</span>
      </section>
    </div>
  )
}
