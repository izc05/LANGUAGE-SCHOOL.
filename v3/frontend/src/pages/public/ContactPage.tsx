import { type FormEvent, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import SiteShell from '../../components/SiteShell'
import { isDemoMode } from '../../config/environment'
import { hasCookieConsent, requestCookieSettings, subscribeCookieConsent } from '../../services/cookieConsent'
import { demoSiteSettings } from '../../services/pocketbase/siteManagement'
import { getPublicSettings, submitContactRequest, type PublicSettings } from '../../services/pocketbase/publicAcademy'
import { getPublishedHomeVisualUrl } from '../../services/pocketbase/siteContent'

const DEFAULT_ACADEMY_ADDRESS = 'Calle Luis Carvajal, 23, Jódar, Jaén'

export default function ContactPage() {
  const [searchParams] = useSearchParams()
  const [settings, setSettings] = useState<PublicSettings>({ ...demoSiteSettings, logoUrl: '' })
  const [heroPhoto, setHeroPhoto] = useState('')
  const [externalContentAllowed, setExternalContentAllowed] = useState(() => hasCookieConsent('preferences'))
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [interest, setInterest] = useState(searchParams.get('interes') || '')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const contactVisual = `${import.meta.env.BASE_URL}visuals/contact-conversation.svg`

  useEffect(() => {
    let mounted = true
    Promise.all([
      getPublicSettings(),
      getPublishedHomeVisualUrl('contactHeroMediaId'),
    ]).then(([value, photo]) => {
      if (!mounted) return
      setSettings(value)
      setHeroPhoto(photo)
    }).catch(() => undefined)
    return () => { mounted = false }
  }, [])

  useEffect(() => subscribeCookieConsent(() => setExternalContentAllowed(hasCookieConsent('preferences'))), [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice(null)
    setError(null)

    if (!name.trim() || !email.trim() || !message.trim()) {
      setError('Completa nombre, email y mensaje.')
      return
    }

    setSending(true)
    try {
      await submitContactRequest({ name, email, phone, interest, message })
      setNotice(isDemoMode ? 'Modo demo: solicitud simulada correctamente.' : 'Solicitud enviada. Nos pondremos en contacto contigo.')
      setName('')
      setEmail('')
      setPhone('')
      setMessage('')
    } catch {
      setError('No se ha podido enviar la solicitud. Inténtalo de nuevo más tarde.')
    } finally {
      setSending(false)
    }
  }

  const configuredAddress = settings.address.trim()
  const mapAddress = !configuredAddress || configuredAddress.toLowerCase() === 'jódar, jaén' ? DEFAULT_ACADEMY_ADDRESS : configuredAddress
  const mapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(mapAddress)}&output=embed`
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapAddress)}`
  const canLoadMap = !settings.cookieBannerEnabled || externalContentAllowed

  return (
    <SiteShell>
      <div className="contact-premium-v2">
        <section className="contact-v2-hero contact-v2-hero-editorial">
          <div className="container contact-v2-hero-grid">
            <div className="contact-v2-hero-copy">
              <span className="eyebrow">CONTACTO · LANGUAGE SCHOOL</span>
              <h1>Cuéntanos qué quieres conseguir.</h1>
              <p>Edad, nivel aproximado, objetivo o simplemente una duda. Con esa información podemos darte una primera orientación útil.</p>
              <div className="contact-v2-direct" aria-label="Datos de contacto de la academia">
                {settings.phone && <a href={`tel:${settings.phone}`}><small>TELÉFONO</small><strong>{settings.phone}</strong></a>}
                {settings.email && <a href={`mailto:${settings.email}`}><small>EMAIL</small><strong>{settings.email}</strong></a>}
                <a href={directionsUrl} target="_blank" rel="noreferrer"><small>ACADEMIA</small><strong>{mapAddress}</strong></a>
              </div>
              <a className="button button-primary contact-v2-hero-cta" href="#solicitud-contacto">Enviar una consulta</a>
            </div>
            <div className={`contact-v2-hero-visual${heroPhoto ? ' has-cms-photo' : ''}`} style={heroPhoto ? { backgroundImage: `linear-gradient(180deg, rgba(53,25,39,.03), rgba(53,25,39,.19)), url(${heroPhoto})` } : undefined}>
              {!heroPhoto && <img src={contactVisual} alt="Ilustración editorial de una conversación en Language School" />}
              <div className="contact-v2-floating-note"><small>LANGUAGE SCHOOL · JÓDAR</small><strong>Una primera conversación sencilla.</strong></div>
            </div>
          </div>
        </section>

        <section className="section contact-v2-main-section" id="solicitud-contacto">
          <div className="container contact-v2-grid">
            <form className="contact-v2-form" onSubmit={handleSubmit}>
              <div className="contact-v2-form-heading">
                <span className="eyebrow">SOLICITUD</span><h2>Quiero información</h2><p>Cuanto mejor conozcamos tu objetivo, más útil será la primera respuesta.</p>
              </div>
              {notice && <div className="cms-notice success-notice" role="status">{notice}</div>}
              {error && <div className="cms-notice" role="alert">{error}</div>}
              <div className="contact-v2-fields">
                <label className="field-stack"><span>Nombre</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label>
                <div className="field-row">
                  <label className="field-stack"><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
                  <label className="field-stack"><span>Teléfono</span><input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
                </div>
                <label className="field-stack"><span>Me interesa</span><input value={interest} onChange={(event) => setInterest(event.target.value)} placeholder="Kids, B1, conversación..." /></label>
                <label className="field-stack"><span>Mensaje</span><textarea rows={6} value={message} onChange={(event) => setMessage(event.target.value)} required /></label>
              </div>
              <button className="button button-primary" type="submit" disabled={sending}>{sending ? 'Enviando…' : 'Enviar solicitud'}</button>
              <small className="contact-v2-form-note">{isDemoMode ? 'Modo demo: el envío se simula y no genera una solicitud real.' : 'La academia recibirá esta solicitud para poder ponerse en contacto contigo.'}</small>
            </form>

            <aside className="contact-v2-info">
              <div className="contact-v2-info-heading"><span className="eyebrow">{settings.academyName || 'ACADEMIA'}</span><h2>También puedes encontrarnos aquí.</h2><p>Elige el canal que te resulte más cómodo.</p></div>
              <div className="contact-v2-info-list">
                <div><span>01</span><strong>Ubicación</strong><p>{mapAddress}</p></div>
                {settings.email && <div><span>02</span><strong>Email</strong><a href={`mailto:${settings.email}`}>{settings.email}</a></div>}
                {settings.phone && <div><span>03</span><strong>Teléfono</strong><a href={`tel:${settings.phone}`}>{settings.phone}</a></div>}
                {settings.whatsapp && <div><span>04</span><strong>WhatsApp</strong><p>{settings.whatsapp}</p></div>}
                {settings.instagram && <div><span>05</span><strong>Instagram</strong><a href={settings.instagram} target="_blank" rel="noreferrer">Abrir Instagram ↗</a></div>}
              </div>
              <div className="contact-v2-info-footer"><span aria-hidden="true">↗</span><p>Escríbenos por el canal que prefieras y te responderemos lo antes posible.</p></div>
            </aside>
          </div>
        </section>

        <section className="contact-v2-map-section" aria-labelledby="academy-location-title">
          <div className="container">
            <div className="contact-v2-map-heading"><div><span className="eyebrow">DÓNDE ESTAMOS</span><h2 id="academy-location-title">Ven a conocernos.</h2></div><p>Language School está en el centro de Jódar. Puedes abrir la ubicación directamente para calcular tu ruta.</p></div>
            {canLoadMap ? (
              <div className="contact-v2-map-card">
                <iframe title={`Mapa de Language School en ${mapAddress}`} src={mapEmbedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
                <div className="contact-v2-map-overlay">
                  <span className="contact-v2-map-pin" aria-hidden="true">⌖</span>
                  <div><small>LANGUAGE SCHOOL · ROCÍO RUIZ</small><strong>{mapAddress}</strong><span>Jódar · Jaén</span></div>
                  <a className="button button-primary" href={directionsUrl} target="_blank" rel="noreferrer">Cómo llegar ↗</a>
                </div>
              </div>
            ) : (
              <div className="external-consent-placeholder">
                <div>
                  <span className="eyebrow">CONTENIDO EXTERNO</span>
                  <h3>El mapa espera tu permiso.</h3>
                  <p>Google Maps solo se cargará si aceptas la categoría Preferencias. Mientras tanto puedes consultar la dirección sin enviar datos al servicio externo.</p>
                  <button className="button button-primary" type="button" onClick={requestCookieSettings}>Configurar cookies</button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="section contact-v2-process-section">
          <div className="container contact-v2-process">
            <div><span className="eyebrow">¿QUÉ PASA DESPUÉS?</span><h2>Una conversación sencilla, sin presión.</h2></div>
            <div className="contact-v2-process-grid">
              <article><span>01</span><strong>Nos cuentas</strong><p>Objetivo, edad o nivel aproximado y lo que necesitas mejorar.</p></article>
              <article><span>02</span><strong>Te orientamos</strong><p>Revisamos qué programa o enfoque puede encajar mejor contigo.</p></article>
              <article><span>03</span><strong>Decides</strong><p>Con la información clara, eliges si quieres dar el siguiente paso.</p></article>
            </div>
          </div>
        </section>
      </div>
    </SiteShell>
  )
}
