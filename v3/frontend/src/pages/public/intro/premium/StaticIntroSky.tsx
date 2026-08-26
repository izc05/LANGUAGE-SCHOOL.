import './static-intro-sky.css'

export default function StaticIntroSky({ transitioning = false }: { transitioning?: boolean }) {
  return (
    <div className={`premium-static-sky${transitioning ? ' is-transitioning' : ''}`} aria-hidden="true">
      <div className="premium-static-cloud cloud-a"><i /><i /><i /></div>
      <div className="premium-static-cloud cloud-b"><i /><i /><i /></div>
      <div className="premium-static-cloud cloud-c"><i /><i /><i /></div>
      <div className="premium-static-cloud cloud-d"><i /><i /><i /></div>

      <div className="premium-static-plane-wrap">
        <svg className="premium-static-plane" viewBox="0 0 240 96" role="presentation">
          <defs>
            <linearGradient id="planePearl" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.72" stopColor="#f8eef2" />
              <stop offset="1" stopColor="#ddd2d7" />
            </linearGradient>
          </defs>
          <path d="M15 50 105 42 155 8l15 2-25 33 65 4c12 1 20 6 20 11s-8 10-20 11l-65 4 25 13-15 2-50-14-90-8c-9-1-14-5-14-8s5-7 14-8Z" fill="url(#planePearl)" stroke="#d9cbd1" strokeWidth="2" />
          <path d="m108 44 38-31 11 1-24 31ZM108 72l38 11 11-2-24-11Z" fill="#d62974" opacity=".92" />
          <path d="M26 56h176" stroke="#d62974" strokeWidth="4" strokeLinecap="round" opacity=".9" />
          <ellipse cx="185" cy="54" rx="22" ry="8" fill="#3b2632" opacity=".9" />
          <circle cx="214" cy="57" r="3" fill="#f4a7c8" />
        </svg>
      </div>

      <div className="premium-cloud-wipe wipe-left"><i /><i /><i /></div>
      <div className="premium-cloud-wipe wipe-right"><i /><i /><i /></div>
      <div className="premium-cloud-wipe wipe-center"><i /><i /><i /></div>
    </div>
  )
}
