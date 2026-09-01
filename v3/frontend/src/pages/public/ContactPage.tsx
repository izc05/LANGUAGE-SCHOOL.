import { type FormEvent, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import SiteShell from '../../components/SiteShell'
import { isDemoMode } from '../../config/environment'
import { demoSiteSettings } from '../../services/pocketbase/siteManagement'
import { getPublicSettings, submitContactRequest, type PublicSettings } from '../../services/pocketbase/publicAcademy'

export default function ContactPage() {
  const [searchParams] = useSearchParams()
  const [settings, setSettings] = useState<PublicSettings>({ ...demoSiteSettings, logoUrl: '' })
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [interest, setInterest] = useState(searchParams.get('interes') || '')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    getPublicSettings().then((value) => { if (mounted) setSettings(value) }).catch(() => undefined)
    return () => { mounted = false }
  }, [])

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

  return (
    <SiteShell>
      <section className="public-page-hero">
        <div className="container public-page-hero-inner">
          <span className="eyebrow">CONTACTO</span>
          <h1>Cuéntanos qué quieres conseguir.</h1>
          <p>Déjanos tus datos y tu objetivo. La academia podrá revisar tu solicitud y ponerse en contacto contigo.</p>
        </div>
      </section>

      <section className="section section-soft">
        <div className="container public-contact-grid">
          <form className="panel public-contact-form" onSubmit={handleSubmit}>
            <div className="panel-heading"><div><span className="eyebrow">SOLICITUD</span><h2>Quiero información</h2></div></div>
            {notice && <div className="cms-notice success-notice" role="status">{notice}</div>}
            {error && <div className="cms-notice" role="alert">{error}</div>}
            <label className="field-stack"><span>Nombre</span><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required /></label>
            <div className="field-row">
              <label className="field-stack"><span>Email</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
              <label className="field-stack"><span>Teléfono</span><input type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
            </div>
            <label className="field-stack"><span>Me interesa</span><input autoComplete="off" value={interest} onChange={(event) => setInterest(event.target.value)} placeholder="Kids, B1, conversación..." /></label>
            <label className="field-stack"><span>Mensaje</span><textarea autoComplete="off" rows={6} value={message} onChange={(event) => setMessage(event.target.value)} required /></label>
            <button className="button button-primary" type="submit" disabled={sending}>{sending ? 'Enviando…' : 'Enviar solicitud'}</button>
            <small className="muted">Este formulario todavía no está abierto para solicitudes reales.</small>
          </form>

          <aside className="panel public-contact-info">
            <span className="eyebrow">{settings.academyName || 'ACADEMIA'}</span>
            <h2>También puedes encontrarnos aquí.</h2>
            {settings.address && <div><strong>Ubicación</strong><span>{settings.address}</span></div>}
            {settings.email && <div><strong>Email</strong><a href={`mailto:${settings.email}`}>{settings.email}</a></div>}
            {settings.phone && <div><strong>Teléfono</strong><a href={`tel:${settings.phone}`}>{settings.phone}</a></div>}
            {settings.whatsapp && <div><strong>WhatsApp</strong><span>{settings.whatsapp}</span></div>}
            {settings.instagram && <div><strong>Instagram</strong><a href={settings.instagram} target="_blank" rel="noreferrer">Abrir Instagram ↗</a></div>}
            <p>Escríbenos por el canal que prefieras y te responderemos lo antes posible.</p>
          </aside>
        </div>
      </section>
    </SiteShell>
  )
}
