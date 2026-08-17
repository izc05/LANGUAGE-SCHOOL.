import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  readCookieConsent,
  subscribeCookieSettingsRequest,
  writeCookieConsent,
} from '../services/cookieConsent'

type CookieConsentBannerProps = {
  enabled: boolean
  intro: string
}

type OptionalPreferences = {
  preferences: boolean
  analytics: boolean
  marketing: boolean
}

const emptyPreferences: OptionalPreferences = { preferences: false, analytics: false, marketing: false }

export default function CookieConsentBanner({ enabled, intro }: CookieConsentBannerProps) {
  const [visible, setVisible] = useState(false)
  const [configuring, setConfiguring] = useState(false)
  const [preferences, setPreferences] = useState<OptionalPreferences>(emptyPreferences)

  useEffect(() => {
    if (!enabled) {
      setVisible(false)
      return
    }
    const stored = readCookieConsent()
    if (stored) {
      setPreferences({ preferences: stored.preferences, analytics: stored.analytics, marketing: stored.marketing })
      setVisible(false)
    } else {
      setVisible(true)
    }
  }, [enabled])

  useEffect(() => subscribeCookieSettingsRequest(() => {
    const stored = readCookieConsent()
    if (stored) setPreferences({ preferences: stored.preferences, analytics: stored.analytics, marketing: stored.marketing })
    setConfiguring(true)
    setVisible(true)
  }), [])

  if (!enabled || !visible) return null

  function save(next: OptionalPreferences) {
    writeCookieConsent(next)
    setPreferences(next)
    setVisible(false)
    setConfiguring(false)
  }

  return (
    <div className="cookie-consent-layer" role="region" aria-label="Preferencias de privacidad">
      <div className={`cookie-consent-card${configuring ? ' is-configuring' : ''}`}>
        <div className="cookie-consent-copy">
          <span className="eyebrow">PRIVACIDAD · LANGUAGE SCHOOL</span>
          <h2>{configuring ? 'Configura tus preferencias.' : 'Tú decides qué se carga.'}</h2>
          <p>{intro}</p>
          <div className="cookie-consent-links">
            <Link to="/cookies">Política de cookies</Link>
            <Link to="/privacidad">Privacidad</Link>
          </div>
        </div>

        {configuring && (
          <div className="cookie-preferences-grid">
            <label className="cookie-preference is-required">
              <span><strong>Necesarias</strong><small>Sesión, seguridad y preferencias de consentimiento.</small></span>
              <input type="checkbox" checked readOnly disabled />
            </label>
            <label className="cookie-preference">
              <span><strong>Preferencias</strong><small>Permite contenido externo útil, como Google Maps.</small></span>
              <input type="checkbox" checked={preferences.preferences} onChange={(event) => setPreferences((current) => ({ ...current, preferences: event.target.checked }))} />
            </label>
            <label className="cookie-preference">
              <span><strong>Estadística</strong><small>Reservado para analítica si la academia la activa en el futuro.</small></span>
              <input type="checkbox" checked={preferences.analytics} onChange={(event) => setPreferences((current) => ({ ...current, analytics: event.target.checked }))} />
            </label>
            <label className="cookie-preference">
              <span><strong>Marketing</strong><small>Reservado para campañas o contenidos promocionales de terceros.</small></span>
              <input type="checkbox" checked={preferences.marketing} onChange={(event) => setPreferences((current) => ({ ...current, marketing: event.target.checked }))} />
            </label>
          </div>
        )}

        <div className="cookie-consent-actions">
          <button className="button cookie-choice" type="button" onClick={() => save(emptyPreferences)}>Rechazar opcionales</button>
          {configuring ? (
            <button className="button button-primary cookie-choice" type="button" onClick={() => save(preferences)}>Guardar selección</button>
          ) : (
            <button className="button cookie-choice" type="button" onClick={() => setConfiguring(true)}>Configurar</button>
          )}
          <button className="button button-primary cookie-choice" type="button" onClick={() => save({ preferences: true, analytics: true, marketing: true })}>Aceptar todas</button>
        </div>
      </div>
    </div>
  )
}
