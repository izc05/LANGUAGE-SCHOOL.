function OrbitPlaneIcon() {
  return (
    <svg viewBox="0 0 96 64" aria-hidden="true" focusable="false">
      <path
        className="intro-orbit-plane-body"
        d="M10 30.5c0-2.9 3.2-4.9 7.2-4.9h19.1L51.8 9.8h8.4l-7.7 15.8h20.7c6.3 0 12.7 2.4 17.6 6.4-4.9 4-11.3 6.4-17.6 6.4H52.5l7.7 15.8h-8.4L36.3 38.4H17.2c-4 0-7.2-2-7.2-4.9v-3Z"
      />
      <path className="intro-orbit-plane-tail" d="M20 25.6 13.5 16h7l11 9.6H20Z" />
      <path className="intro-orbit-plane-tail" d="M20 38.4 13.5 48h7l11-9.6H20Z" />
      <path className="intro-orbit-plane-stripe" d="M19 31h57c3.6 0 7 .5 10.2 1.4-3.2.9-6.6 1.4-10.2 1.4H19c-2.6 0-4.7-.6-5.9-1.4 1.2-.8 3.3-1.4 5.9-1.4Z" />
      <circle className="intro-orbit-plane-window" cx="68" cy="29.1" r="1.25" />
      <circle className="intro-orbit-plane-window" cx="73" cy="29.1" r="1.25" />
      <circle className="intro-orbit-plane-window" cx="78" cy="29.5" r="1.2" />
    </svg>
  )
}

export default function IntroOrbitArtwork() {
  return (
    <div className="intro-orbit-stage">
      <div className="intro-orbit-sphere" aria-hidden="true" />

      <div className="intro-orbit-track" data-testid="intro-orbit-plane" aria-hidden="true">
        <div className="intro-orbit-arm">
          <span className="intro-orbit-plane">
            <OrbitPlaneIcon />
          </span>
        </div>
      </div>

      <section className="premium-brand-lockup intro-orbit-brand" aria-label="Language School Rocío Ruiz">
        <span className="premium-brand-language">LANGUAGE</span>
        <strong className="premium-brand-school">School</strong>
        <div className="premium-brand-divider" aria-hidden="true" />
        <span className="premium-brand-rocio">ROCÍO RUIZ</span>
      </section>
    </div>
  )
}
