import PremiumOrbitAirplane from './PremiumOrbitAirplane'
import PremiumRotatingGlobe from './PremiumRotatingGlobe'
import './intro-rotating-globe.css'

type IntroOrbitArtworkProps = {
  withPlane?: boolean
}

export default function IntroOrbitArtwork({ withPlane = true }: IntroOrbitArtworkProps) {
  return (
    <div className="intro-orbit-stage">
      {withPlane && <PremiumOrbitAirplane />}
      <div className="intro-orbit-sphere" aria-hidden="true" />
      <PremiumRotatingGlobe />

      <section className="premium-brand-lockup intro-orbit-brand" aria-label="Language School Rocío Ruiz">
        <span className="premium-brand-language">LANGUAGE</span>
        <strong className="premium-brand-school">School</strong>
        <div className="premium-brand-divider" aria-hidden="true" />
        <span className="premium-brand-rocio">ROCÍO RUIZ</span>
      </section>
    </div>
  )
}
