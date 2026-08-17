import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import { isDemoMode } from '../../config/environment'
import {
  demoSiteSettings,
  getSiteSettings,
  saveSiteSettings,
  settingsToInput,
  type SiteSettingsInput,
} from '../../services/pocketbase/siteManagement'
import { adminNav } from './adminNav'

const allowedLogoTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])
const maxLogoBytes = 5 * 1024 * 1024

export default function AdminSettingsPage() {
  const [form, setForm] = useState<SiteSettingsInput>(demoSiteSettings)
  const [logo, setLogo] = useState<File | null>(null)
  const [logoName, setLogoName] = useState('Sin nuevo logo seleccionado')
  const [loading, setLoading] = useState(!isDemoMode)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    getSiteSettings()
      .then((record) => { if (mounted) setForm(settingsToInput(record)) })
      .catch(() => { if (mounted) setError('No se ha podido cargar la configuración general. Inténtalo de nuevo en unos segundos.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  function setField<K extends keyof SiteSettingsInput>(key: K, value: SiteSettingsInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setNotice(null)
    setError(null)
  }

  function handleLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setNotice(null)
    setError(null)

    if (file && !allowedLogoTypes.has(file.type)) {
      setLogo(null)
      setLogoName('Sin nuevo logo seleccionado')
      event.target.value = ''
      setError('El logo debe estar en formato PNG, JPG o WEBP.')
      return
    }

    if (file && file.size > maxLogoBytes) {
      setLogo(null)
      setLogoName('Sin nuevo logo seleccionado')
      event.target.value = ''
      setError('El logo supera el límite de 5 MB.')
      return
    }

    setLogo(file)
    setLogoName(file?.name ?? 'Sin nuevo logo seleccionado')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)

    if (!form.academyName.trim()) {
      setError('El nombre de la academia es obligatorio.')
      return
    }

    if (isDemoMode) {
      setNotice('Configuración preparada en la demostración. No se ha guardado ningún cambio real.')
      return
    }

    setSaving(true)
    try {
      await saveSiteSettings(form, logo)
      setLogo(null)
      setLogoName('Sin nuevo logo seleccionado')
      setNotice('Configuración general guardada correctamente.')
    } catch {
      setError('No se ha podido guardar la configuración. Comprueba tu sesión y vuelve a intentarlo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page admin-settings-page">
        <header className="cms-page-heading">
          <div>
            <span className="eyebrow">CMS · CONFIGURACIÓN</span>
            <h2>Identidad y contacto</h2>
            <p>Centraliza aquí los datos públicos de la academia, los canales de contacto, el consentimiento y la identificación legal.</p>
          </div>
          <span className="status info">Configuración global</span>
        </header>

        {loading && <div className="cms-notice" role="status">Cargando configuración…</div>}
        {notice && <div className="cms-notice success-notice" role="status">{notice}</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        <form className="admin-settings-grid" onSubmit={handleSubmit}>
          <section className="panel cms-form">
            <div className="panel-heading"><div><span className="eyebrow">MARCA</span><h3>Identidad de la academia</h3></div></div>
            <label className="field-stack"><span>Nombre</span><input value={form.academyName} onChange={(event) => setField('academyName', event.target.value)} required /></label>
            <label className="field-stack"><span>Logo</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogo} /></label>
            <div className="settings-file-note"><strong>{logoName}</strong><small>PNG, JPG o WEBP · máximo 5 MB. El logo anterior se conserva si no seleccionas otro.</small></div>
            <label className="field-stack"><span>Dirección</span><textarea rows={3} value={form.address} onChange={(event) => setField('address', event.target.value)} placeholder="Dirección o localidad" /><small>También actualiza el mapa público de Contacto.</small></label>
          </section>

          <section className="panel cms-form">
            <div className="panel-heading"><div><span className="eyebrow">CONTACTO</span><h3>Canales públicos</h3></div></div>
            <label className="field-stack"><span>Email</span><input type="email" autoComplete="email" value={form.email} onChange={(event) => setField('email', event.target.value)} placeholder="info@..." /></label>
            <div className="field-row">
              <label className="field-stack"><span>Teléfono</span><input type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setField('phone', event.target.value)} /></label>
              <label className="field-stack"><span>WhatsApp</span><input type="tel" value={form.whatsapp} onChange={(event) => setField('whatsapp', event.target.value)} placeholder="34618218187" /></label>
            </div>
            <label className="settings-toggle-row"><span><strong>Botón flotante de WhatsApp</strong><small>Permite mostrar u ocultar el acceso rápido en toda la web pública.</small></span><input type="checkbox" checked={form.whatsappEnabled} onChange={(event) => setField('whatsappEnabled', event.target.checked)} /></label>
            <label className="field-stack"><span>Mensaje inicial de WhatsApp</span><textarea rows={3} value={form.whatsappMessage} onChange={(event) => setField('whatsappMessage', event.target.value)} placeholder="Hola, quiero información..." /></label>
            <label className="field-stack"><span>Instagram</span><input type="url" value={form.instagram} onChange={(event) => setField('instagram', event.target.value)} placeholder="https://instagram.com/..." /></label>
            <label className="field-stack"><span>Facebook</span><input type="url" value={form.facebook} onChange={(event) => setField('facebook', event.target.value)} /></label>
            <label className="field-stack"><span>YouTube</span><input type="url" value={form.youtube} onChange={(event) => setField('youtube', event.target.value)} /></label>
          </section>

          <section className="panel cms-form admin-settings-privacy-panel">
            <div className="panel-heading"><div><span className="eyebrow">COOKIES</span><h3>Consentimiento y servicios externos</h3></div></div>
            <label className="settings-toggle-row"><span><strong>Mostrar panel de cookies</strong><small>Si está activo, Google Maps y futuros servicios opcionales esperan el consentimiento correspondiente.</small></span><input type="checkbox" checked={form.cookieBannerEnabled} onChange={(event) => setField('cookieBannerEnabled', event.target.checked)} /></label>
            <label className="field-stack"><span>Texto breve del panel</span><textarea rows={4} value={form.cookieIntro} onChange={(event) => setField('cookieIntro', event.target.value)} /></label>
            <div className="settings-legal-note"><strong>Consentimiento real</strong><p>Las categorías opcionales permanecen bloqueadas hasta que el visitante decida. Google Maps depende de Preferencias y el usuario puede cambiar su decisión desde el footer.</p></div>
          </section>

          <section className="panel cms-form admin-settings-legal-panel">
            <div className="panel-heading"><div><span className="eyebrow">LEGAL Y PRIVACIDAD</span><h3>Identificación y textos públicos</h3></div></div>
            <p className="muted">Estos datos alimentan automáticamente el Aviso legal y la Política de privacidad. Completa los datos reales del titular antes de publicar en producción.</p>
            <label className="field-stack"><span>Titular / responsable legal</span><input value={form.legalOwnerName} onChange={(event) => setField('legalOwnerName', event.target.value)} placeholder="Nombre y apellidos o razón social" /><small>No confundas la marca comercial con el titular jurídico si son distintos.</small></label>
            <div className="field-row">
              <label className="field-stack"><span>NIF / CIF</span><input value={form.legalTaxId} onChange={(event) => setField('legalTaxId', event.target.value)} placeholder="NIF o CIF real" /></label>
              <label className="field-stack"><span>Datos registrales, si procede</span><input value={form.legalRegistryDetails} onChange={(event) => setField('legalRegistryDetails', event.target.value)} placeholder="Registro, tomo, folio, hoja..." /></label>
            </div>
            <div className="settings-legal-note"><strong>Plantillas estructuradas incluidas</strong><p>La web ya presenta responsable, finalidades, bases jurídicas, conservación, destinatarios, derechos, cookies y condiciones de uso. Los campos siguientes sirven para añadir particularidades propias de la academia.</p></div>
            <label className="field-stack"><span>Texto adicional · Política de cookies</span><textarea rows={6} value={form.cookiePolicyText} onChange={(event) => setField('cookiePolicyText', event.target.value)} placeholder="Información adicional específica sobre cookies o proveedores..." /></label>
            <label className="field-stack"><span>Texto adicional · Política de privacidad</span><textarea rows={6} value={form.privacyPolicyText} onChange={(event) => setField('privacyPolicyText', event.target.value)} placeholder="Cláusulas o tratamientos específicos de la academia..." /></label>
            <label className="field-stack"><span>Texto adicional · Aviso legal</span><textarea rows={6} value={form.legalNoticeText} onChange={(event) => setField('legalNoticeText', event.target.value)} placeholder="Autorizaciones, datos profesionales u otras condiciones específicas..." /></label>
          </section>

          <div className="admin-settings-submit-row">
            <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar configuración'}</button>
            {isDemoMode && <small className="muted">Vista de demostración: no se guardan cambios reales.</small>}
          </div>
        </form>
      </div>
    </DashboardShell>
  )
}
