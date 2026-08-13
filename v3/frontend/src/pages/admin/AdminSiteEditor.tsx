import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import { isDemoMode } from '../../config/environment'
import {
  createMedia,
  getMediaUrl,
  listMedia,
  type MediaRecord,
} from '../../services/pocketbase/media'
import {
  demoHomeContent,
  getEditableHomeContent,
  saveHomeContent,
  type HomePageContent,
} from '../../services/pocketbase/siteContent'
import { adminNav } from './adminNav'

function releaseObjectUrl(value: string | null) {
  if (value?.startsWith('blob:')) URL.revokeObjectURL(value)
}

export default function AdminSiteEditor() {
  const [heroEyebrow, setHeroEyebrow] = useState(demoHomeContent.hero.eyebrow)
  const [heroTitle, setHeroTitle] = useState(demoHomeContent.hero.title)
  const [heroSubtitle, setHeroSubtitle] = useState(demoHomeContent.hero.subtitle)
  const [primaryCta, setPrimaryCta] = useState(demoHomeContent.hero.primaryCta)
  const [secondaryCta, setSecondaryCta] = useState(demoHomeContent.hero.secondaryCta)
  const [heroMediaId, setHeroMediaId] = useState(demoHomeContent.hero.mediaId)
  const [mediaOptions, setMediaOptions] = useState<MediaRecord[]>([])
  const [imageName, setImageName] = useState('Sin imagen seleccionada')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(!isDemoMode)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadEditor() {
      try {
        const [{ content, status }, media] = await Promise.all([
          getEditableHomeContent(),
          isDemoMode ? Promise.resolve<MediaRecord[]>([]) : listMedia('WEBSITE'),
        ])

        if (!mounted) return

        setHeroEyebrow(content.hero.eyebrow)
        setHeroTitle(content.hero.title)
        setHeroSubtitle(content.hero.subtitle)
        setPrimaryCta(content.hero.primaryCta)
        setSecondaryCta(content.hero.secondaryCta)
        setHeroMediaId(content.hero.mediaId)
        setMediaOptions(media)
        setSaved(status === 'PUBLISHED')

        const selectedMedia = media.find((item) => item.id === content.hero.mediaId)
        if (selectedMedia) {
          setImageName(selectedMedia.title || selectedMedia.file)
          setPreviewUrl(getMediaUrl(selectedMedia, '800x600'))
        }

        setNotice(isDemoMode ? 'Modo demo: los cambios todavía no salen del navegador.' : `Contenido cargado · ${status}`)
      } catch {
        if (mounted) setError('No se ha podido cargar el contenido de la portada. No se ha sobrescrito ningún dato.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadEditor()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => () => releaseObjectUrl(previewUrl), [previewUrl])

  function markDirty() {
    setSaved(false)
    setNotice(null)
    setError(null)
  }

  async function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    markDirty()
    releaseObjectUrl(previewUrl)

    if (isDemoMode) {
      setHeroMediaId('')
      setImageName(file.name)
      setPreviewUrl(URL.createObjectURL(file))
      setNotice('Modo demo: imagen preparada únicamente para la vista previa.')
      event.target.value = ''
      return
    }

    setUploadingImage(true)
    try {
      const record = await createMedia({
        title: file.name,
        file,
        altText: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
        usage: 'WEBSITE',
        mediaType: 'IMAGE',
      })
      setMediaOptions((current) => [record, ...current])
      setHeroMediaId(record.id)
      setImageName(record.title || record.file)
      setPreviewUrl(getMediaUrl(record, '800x600'))
      setNotice('Imagen subida a Multimedia y seleccionada para la portada. Publica los cambios para activarla.')
    } catch {
      setError('No se ha podido subir la imagen. Inténtalo de nuevo.')
    } finally {
      setUploadingImage(false)
      event.target.value = ''
    }
  }

  function selectExistingMedia(id: string) {
    markDirty()
    setHeroMediaId(id)

    if (!id) {
      setImageName('Sin imagen seleccionada')
      setPreviewUrl(null)
      return
    }

    const record = mediaOptions.find((item) => item.id === id)
    if (!record) return
    setImageName(record.title || record.file)
    setPreviewUrl(getMediaUrl(record, '800x600'))
  }

  function buildContent(): HomePageContent {
    return {
      hero: {
        eyebrow: heroEyebrow.trim() || demoHomeContent.hero.eyebrow,
        title: heroTitle.trim() || demoHomeContent.hero.title,
        subtitle: heroSubtitle.trim() || demoHomeContent.hero.subtitle,
        primaryCta: primaryCta.trim() || demoHomeContent.hero.primaryCta,
        secondaryCta: secondaryCta.trim() || demoHomeContent.hero.secondaryCta,
        mediaId: heroMediaId,
      },
    }
  }

  async function persist(publish: boolean) {
    setError(null)
    setNotice(null)

    if (isDemoMode) {
      setSaved(publish)
      setNotice(
        publish
          ? 'Modo demo: publicación simulada. Los cambios no se mostrarán en la web.'
          : 'Modo demo: borrador simulado localmente.',
      )
      return
    }

    setSaving(true)
    try {
      await saveHomeContent(buildContent(), publish)
      setSaved(publish)
      setNotice(publish ? 'Portada publicada correctamente.' : 'Borrador guardado correctamente.')
    } catch {
      setError('No se han podido guardar los cambios. Revisa la conexión y que la cuenta tenga rol ADMIN.')
    } finally {
      setSaving(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void persist(true)
  }

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page">
        <header className="cms-page-heading">
          <div>
            <span className="eyebrow">CMS · PÁGINA WEB</span>
            <h2>Editar portada</h2>
            <p>
              Edita aquí el contenido principal de la portada. Puedes guardar un borrador o publicar los cambios para mostrarlos en
              la web.
            </p>
          </div>
          <a className="button button-ghost" href="/" target="_blank" rel="noreferrer">Vista pública ↗</a>
        </header>

        {loading && <div className="cms-notice">Cargando contenido de la portada…</div>}
        {notice && <div className="cms-notice success-notice">{notice}</div>}
        {error && <div className="cms-notice">{error}</div>}

        <div className="cms-editor-grid">
          <form className="panel cms-form" onSubmit={handleSubmit}>
            <div className="panel-heading">
              <div><span className="eyebrow">HERO</span><h3>Mensaje principal</h3></div>
              <span className={`status ${saved ? 'success' : 'info'}`}>{saved ? 'Publicado' : 'Cambios sin publicar'}</span>
            </div>

            <label className="field-stack">
              <span>Etiqueta superior</span>
              <input value={heroEyebrow} onChange={(event) => { setHeroEyebrow(event.target.value); markDirty() }} />
            </label>

            <label className="field-stack">
              <span>Título principal</span>
              <textarea value={heroTitle} onChange={(event) => { setHeroTitle(event.target.value); markDirty() }} rows={3} />
              <small>{heroTitle.length}/110 caracteres recomendados</small>
            </label>

            <label className="field-stack">
              <span>Texto de presentación</span>
              <textarea value={heroSubtitle} onChange={(event) => { setHeroSubtitle(event.target.value); markDirty() }} rows={4} />
            </label>

            <div className="field-grid-two">
              <label className="field-stack">
                <span>Botón principal</span>
                <input value={primaryCta} onChange={(event) => { setPrimaryCta(event.target.value); markDirty() }} />
              </label>
              <label className="field-stack">
                <span>Botón secundario</span>
                <input value={secondaryCta} onChange={(event) => { setSecondaryCta(event.target.value); markDirty() }} />
              </label>
            </div>

            <div className="field-stack">
              <span>Imagen principal</span>
              <label className="upload-dropzone">
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImage} disabled={uploadingImage} />
                <strong>{uploadingImage ? 'Subiendo imagen…' : 'Subir nueva imagen'}</strong>
                <small>JPG, PNG o WebP · se guarda en Multimedia</small>
              </label>

              {!isDemoMode && mediaOptions.length > 0 && (
                <label className="field-stack">
                  <span>O elegir una imagen existente</span>
                  <select value={heroMediaId} onChange={(event) => selectExistingMedia(event.target.value)}>
                    <option value="">Sin imagen</option>
                    {mediaOptions.map((item) => (
                      <option key={item.id} value={item.id}>{item.title || item.file}</option>
                    ))}
                  </select>
                </label>
              )}

              <div className="selected-file"><span>IMG</span><div><strong>{imageName}</strong><small>{heroMediaId ? 'Vinculada a la portada' : 'Vista previa local o sin vincular'}</small></div></div>
            </div>

            <div className="cms-form-actions">
              <button className="button button-primary" type="submit" disabled={saving || loading || uploadingImage}>
                {saving ? 'Guardando…' : 'Guardar y publicar'}
              </button>
              <button className="button button-ghost" type="button" disabled={saving || loading || uploadingImage} onClick={() => void persist(false)}>
                Guardar borrador
              </button>
            </div>
          </form>

          <aside className="cms-preview-panel">
            <div className="preview-browser-bar"><i /><i /><i /><span>Vista previa de portada</span></div>
            <div className="cms-hero-preview">
              <div className="cms-hero-preview-copy">
                <span className="eyebrow">{heroEyebrow || 'LANGUAGE SCHOOL'}</span>
                <h1>{heroTitle || 'Título de portada'}</h1>
                <p>{heroSubtitle || 'Texto de presentación de la academia.'}</p>
                <div className="hero-actions">
                  <span className="button button-primary">{primaryCta || 'Botón principal'}</span>
                  <span className="button button-ghost">{secondaryCta || 'Botón secundario'}</span>
                </div>
              </div>
              <div className="cms-image-preview" style={previewUrl ? { backgroundImage: `url(${previewUrl})` } : undefined}>
                {!previewUrl && <div><span>IMAGEN</span><strong>{imageName}</strong><small>Sube o selecciona una imagen de Multimedia</small></div>}
              </div>
            </div>
          </aside>
        </div>

        <section className="panel cms-section-list">
          <div className="panel-heading"><div><span className="eyebrow">RESTO DE LA HOME</span><h3>Secciones editables</h3></div><span className="status success">Estructura preparada</span></div>
          <div className="cms-section-cards">
            <button type="button"><b>01</b><span><strong>Programas</strong><small>Kids, Teens, Adultos y Exámenes</small></span><em>Editar →</em></button>
            <button type="button"><b>02</b><span><strong>Metodología</strong><small>Pasos, mensajes y beneficios</small></span><em>Editar →</em></button>
            <button type="button"><b>03</b><span><strong>Profesores</strong><small>Foto, nombre, especialidad y bio</small></span><em>Editar →</em></button>
            <button type="button"><b>04</b><span><strong>Contacto</strong><small>Teléfono, email, dirección y horarios</small></span><em>Editar →</em></button>
          </div>
        </section>
      </div>
    </DashboardShell>
  )
}
