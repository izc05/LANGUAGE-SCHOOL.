import { type FormEvent, useEffect, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  demoAboutContent,
  getEditableAboutContent,
  saveAboutContent,
  type AboutPageContent,
  type AboutValue,
} from '../../services/pocketbase/siteContent'
import { adminNav } from './adminNav'

function updateValue(values: AboutValue[], index: number, patch: Partial<AboutValue>): AboutValue[] {
  return values.map((value, currentIndex) => currentIndex === index ? { ...value, ...patch } : value)
}

export default function AdminAboutEditor() {
  const { isDemoMode } = useAuth()
  const [content, setContent] = useState<AboutPageContent>(demoAboutContent)
  const [loading, setLoading] = useState(!isDemoMode)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    getEditableAboutContent()
      .then((result) => { if (mounted) setContent(result.content) })
      .catch(() => { if (mounted) setError('No se ha podido cargar la página Sobre nosotros.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode])

  function setField<K extends keyof AboutPageContent>(key: K, value: AboutPageContent[K]) {
    setContent((current) => ({ ...current, [key]: value }))
    setMessage(null)
    setError(null)
  }

  async function save(publish: boolean) {
    setError(null)
    setMessage(null)

    if (isDemoMode) {
      setMessage(`Modo demo: ${publish ? 'publicación' : 'borrador'} simulado.`)
      return
    }

    setSaving(true)
    try {
      await saveAboutContent(content, publish)
      setMessage(publish ? 'Sobre nosotros publicado.' : 'Borrador guardado.')
    } catch {
      setError('No se ha podido guardar la página.')
    } finally {
      setSaving(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void save(true)
  }

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page">
        <header className="cms-page-heading">
          <div>
            <span className="eyebrow">CMS · SOBRE NOSOTROS</span>
            <h2>Historia, enfoque y valores</h2>
            <p>Todo este contenido se publica desde PocketBase y puede modificarse sin tocar GitHub.</p>
          </div>
          <a className="button button-ghost" href="/sobre-nosotros" target="_blank" rel="noreferrer">Vista pública ↗</a>
        </header>

        {loading && <div className="cms-notice">Cargando contenido…</div>}
        {message && <div className="cms-notice success-notice">{message}</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        <form className="about-admin-layout" onSubmit={handleSubmit}>
          <section className="panel cms-form">
            <div className="panel-heading"><div><span className="eyebrow">CABECERA</span><h3>Presentación</h3></div></div>
            <label className="field-stack"><span>Etiqueta</span><input value={content.eyebrow} onChange={(event) => setField('eyebrow', event.target.value)} /></label>
            <label className="field-stack"><span>Título principal</span><textarea rows={3} value={content.title} onChange={(event) => setField('title', event.target.value)} /></label>
            <label className="field-stack"><span>Introducción</span><textarea rows={4} value={content.intro} onChange={(event) => setField('intro', event.target.value)} /></label>
          </section>

          <section className="panel cms-form">
            <div className="panel-heading"><div><span className="eyebrow">HISTORIA</span><h3>Cómo enseñamos</h3></div></div>
            <label className="field-stack"><span>Título</span><textarea rows={2} value={content.storyTitle} onChange={(event) => setField('storyTitle', event.target.value)} /></label>
            {content.storyParagraphs.map((paragraph, index) => (
              <label className="field-stack" key={index}><span>Párrafo {index + 1}</span><textarea rows={4} value={paragraph} onChange={(event) => {
                const next = [...content.storyParagraphs]
                next[index] = event.target.value
                setField('storyParagraphs', next)
              }} /></label>
            ))}
          </section>

          <section className="panel cms-form about-values-admin">
            <div className="panel-heading"><div><span className="eyebrow">VALORES</span><h3>Tres ideas clave</h3></div></div>
            {content.values.map((value, index) => (
              <div className="about-value-editor" key={index}>
                <label className="field-stack"><span>Valor {index + 1}</span><input value={value.title} onChange={(event) => setField('values', updateValue(content.values, index, { title: event.target.value }))} /></label>
                <label className="field-stack"><span>Explicación</span><textarea rows={3} value={value.text} onChange={(event) => setField('values', updateValue(content.values, index, { text: event.target.value }))} /></label>
              </div>
            ))}
          </section>

          <section className="panel cms-form">
            <div className="panel-heading"><div><span className="eyebrow">CIERRE</span><h3>Llamada a la acción</h3></div></div>
            <label className="field-stack"><span>Título</span><input value={content.closingTitle} onChange={(event) => setField('closingTitle', event.target.value)} /></label>
            <label className="field-stack"><span>Texto</span><textarea rows={3} value={content.closingText} onChange={(event) => setField('closingText', event.target.value)} /></label>
            <div className="teacher-public-actions">
              <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Publicar cambios'}</button>
              <button className="button button-ghost" type="button" disabled={saving} onClick={() => void save(false)}>Guardar borrador</button>
            </div>
          </section>
        </form>
      </div>
    </DashboardShell>
  )
}
