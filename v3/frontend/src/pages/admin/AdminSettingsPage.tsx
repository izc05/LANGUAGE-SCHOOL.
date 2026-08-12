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
      .catch(() => { if (mounted) setError('No se ha podido cargar la configuración de PocketBase.') })
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
    setLogo(file)
    setLogoName(file?.name ?? 'Sin nuevo logo seleccionado')
    setNotice(null)
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
      setNotice('Modo demo: configuración guardada únicamente en esta vista.')
      return
    }

    setSaving(true)
    try {
      await saveSiteSettings(form, logo)
      setLogo(null)
      setLogoName('Sin nuevo logo seleccionado')
      setNotice('Configuración general guardada en PocketBase.')
    } catch {
      setError('No se ha podido guardar la configuración. Revisa la sesión ADMIN y la conexión.')
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
            <p>Centraliza aquí los datos que después reutilizarán la cabecera, contacto, footer y metadatos de la web.</p>
          </div>
          <span className="status info">Configuración global</span>
        </header>

        {loading && <div className="cms-notice">Cargando configuración…</div>}
        {notice && <div className="cms-notice success-notice">{notice}</div>}
        {error && <div className="cms-notice" role="alert">{error}</div>}

        <form className="admin-settings-grid" onSubmit={handleSubmit}>
          <section className="panel cms-form">
            <div className="panel-heading"><div><span className="eyebrow">MARCA</span><h3>Identidad de la academia</h3></div></div>
            <label className="field-stack"><span>Nombre</span><input value={form.academyName} onChange={(event) => setField('academyName', event.target.value)} required /></label>
            <label className="field-stack"><span>Logo</span><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogo} /></label>
            <div className="settings-file-note"><strong>{logoName}</strong><small>PNG, JPG, WEBP o SVG. El logo anterior se conserva si no seleccionas otro.</small></div>
            <label className="field-stack"><span>Dirección</span><textarea rows={3} value={form.address} onChange={(event) => setField('address', event.target.value)} placeholder="Dirección o localidad" /></label>
          </section>

          <section className="panel cms-form">
            <div className="panel-heading"><div><span className="eyebrow">CONTACTO</span><h3>Canales públicos</h3></div></div>
            <label className="field-stack"><span>Email</span><input type="email" value={form.email} onChange={(event) => setField('email', event.target.value)} placeholder="info@..." /></label>
            <div className="field-row">
              <label className="field-stack"><span>Teléfono</span><input value={form.phone} onChange={(event) => setField('phone', event.target.value)} /></label>
              <label className="field-stack"><span>WhatsApp</span><input value={form.whatsapp} onChange={(event) => setField('whatsapp', event.target.value)} /></label>
            </div>
            <label className="field-stack"><span>Instagram</span><input type="url" value={form.instagram} onChange={(event) => setField('instagram', event.target.value)} placeholder="https://instagram.com/..." /></label>
            <label className="field-stack"><span>Facebook</span><input type="url" value={form.facebook} onChange={(event) => setField('facebook', event.target.value)} /></label>
            <label className="field-stack"><span>YouTube</span><input type="url" value={form.youtube} onChange={(event) => setField('youtube', event.target.value)} /></label>
            <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar configuración'}</button>
            {isDemoMode && <small className="muted">Modo demo: no se guarda ningún dato real.</small>}
          </section>
        </form>
      </div>
    </DashboardShell>
  )
}
