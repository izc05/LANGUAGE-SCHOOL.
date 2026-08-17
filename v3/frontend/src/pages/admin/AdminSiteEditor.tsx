import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router'
import CmsImagePickerCard from '../../components/CmsImagePickerCard'
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
  type HomeVisualContent,
} from '../../services/pocketbase/siteContent'
import { adminNav } from './adminNav'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const homeVisualSlots: Array<{ key: keyof HomeVisualContent; label: string; hint: string }> = [
  { key: 'kidsMediaId', label: 'Kids', hint: 'Tarjeta de programa para 6–12 años' },
  { key: 'teensMediaId', label: 'Teens', hint: 'Tarjeta de adolescentes / instituto' },
  { key: 'universityMediaId', label: 'Universidad', hint: 'Young adults, Erasmus y estudios' },
  { key: 'adultsMediaId', label: 'Adultos', hint: 'English for life / conversación' },
  { key: 'examsMediaId', label: 'Exámenes', hint: 'Preparación y certificación' },
  { key: 'methodMediaId', label: 'Método', hint: 'Fotografía del bloque Nuestro método' },
  { key: 'journalMediaId', label: 'English Journal', hint: 'Imagen principal del bloque Blog en Home' },
]

const publicPageVisualSlots: Array<{ key: keyof HomeVisualContent; label: string; hint: string }> = [
  { key: 'teachersHeroMediaId', label: 'Profesores', hint: 'Imagen principal de la página Equipo docente' },
  { key: 'aboutHeroMediaId', label: 'Sobre nosotros', hint: 'Imagen principal de la historia de la academia' },
  { key: 'pricingHeroMediaId', label: 'Tarifas', hint: 'Imagen principal de la página de precios' },
  { key: 'blogHeroMediaId', label: 'Blog', hint: 'Imagen principal de Language School Journal' },
  { key: 'contactHeroMediaId', label: 'Contacto', hint: 'Imagen principal antes del formulario y el mapa' },
]

function releaseObjectUrl(value: string | null) {
  if (value?.startsWith('blob:')) URL.revokeObjectURL(value)
}

function cleanAltText(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()
}

export default function AdminSiteEditor() {
  const [heroEyebrow, setHeroEyebrow] = useState(demoHomeContent.hero.eyebrow)
  const [heroTitle, setHeroTitle] = useState(demoHomeContent.hero.title)
  const [heroSubtitle, setHeroSubtitle] = useState(demoHomeContent.hero.subtitle)
  const [primaryCta, setPrimaryCta] = useState(demoHomeContent.hero.primaryCta)
  const [secondaryCta, setSecondaryCta] = useState(demoHomeContent.hero.secondaryCta)
  const [heroMediaId, setHeroMediaId] = useState(demoHomeContent.hero.mediaId)
  const [visuals, setVisuals] = useState<HomeVisualContent>({ ...demoHomeContent.visuals })
  const [mediaOptions, setMediaOptions] = useState<MediaRecord[]>([])
  const [imageName, setImageName] = useState('Sin imagen seleccionada')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showHeroPicker, setShowHeroPicker] = useState(false)
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
        setVisuals(content.visuals)
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

  function addMediaOption(record: MediaRecord) {
    setMediaOptions((current) => current.some((item) => item.id === record.id) ? current : [record, ...current])
  }

  async function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || uploadingImage) return

    markDirty()

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError('La imagen principal debe ser JPG, PNG o WebP.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('La imagen principal supera el límite de 8 MB.')
      return
    }

    releaseObjectUrl(previewUrl)

    if (isDemoMode) {
      setHeroMediaId('')
      setImageName(file.name)
      setPreviewUrl(URL.createObjectURL(file))
      setNotice('Modo demo: imagen preparada únicamente para la vista previa.')
      return
    }

    setUploadingImage(true)
    try {
      const record = await createMedia({
        title: file.name,
        file,
        altText: cleanAltText(file.name),
        usage: 'WEBSITE',
        mediaType: 'IMAGE',
      })
      addMediaOption(record)
      setHeroMediaId(record.id)
      setImageName(record.title || record.file)
      setPreviewUrl(getMediaUrl(record, '800x600'))
      setShowHeroPicker(false)
      setNotice('Imagen subida a Multimedia y seleccionada para la portada. Publica los cambios para activarla.')
    } catch {
      setError('No se ha podido subir la imagen. Puedes volver a intentarlo o elegir una existente.')
    } finally {
      setUploadingImage(false)
    }
  }

  function selectExistingMedia(id: string) {
    markDirty()
    releaseObjectUrl(previewUrl)
    setHeroMediaId(id)

    if (!id) {
      setImageName('Sin imagen seleccionada')
      setPreviewUrl(null)
      setNotice('Imagen quitada. Al publicar volverá el fallback premium de la portada.')
      setShowHeroPicker(false)
      return
    }

    const record = mediaOptions.find((item) => item.id === id)
    if (!record) return
    setImageName(record.title || record.file)
    setPreviewUrl(getMediaUrl(record, '800x600'))
    setNotice('Imagen de Multimedia seleccionada. Publica los cambios para activarla.')
  }

  function removeHeroImage() {
    selectExistingMedia('')
  }

  function selectVisualMedia(key: keyof HomeVisualContent, id: string) {
    markDirty()
    setVisuals((current) => ({ ...current, [key]: id }))
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
      visuals,
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
      setNotice(publish ? 'Portada e imágenes publicadas correctamente.' : 'Borrador guardado correctamente.')
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

  function renderVisualCards(slots: Array<{ key: keyof HomeVisualContent; label: string; hint: string }>) {
    return slots.map((slot) => (
      <CmsImagePickerCard
        key={slot.key}
        slotKey={slot.key}
        label={slot.label}
        hint={slot.hint}
        selectedId={visuals[slot.key]}
        mediaOptions={mediaOptions}
        disabled={loading || saving}
        demoMode={isDemoMode}
        onUploaded={addMediaOption}
        onSelect={(id) => selectVisualMedia(slot.key, id)}
      />
    ))
  }

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page">
        <header className="cms-page-heading">
          <div>
            <span className="eyebrow">CMS · PÁGINA WEB</span>
            <h2>Editar web pública</h2>
            <p>Edita la portada y gestiona las imágenes principales de la web sin salir de esta pantalla.</p>
          </div>
          <a className="button button-ghost" href="/" target="_blank" rel="noreferrer">Vista pública ↗</a>
        </header>

        {loading && <div className="cms-notice">Cargando contenido de la portada…</div>}
        {notice && <div className="cms-notice success-notice" role="status">{notice}</div>}
        {error && <div className="cms-notice" role="alert">{error}</div>}

        <div className="cms-editor-grid">
          <form className="panel cms-form" onSubmit={handleSubmit}>
            <div className="panel-heading">
              <div><span className="eyebrow">HERO</span><h3>Mensaje principal</h3></div>
              <span className={`status ${saved ? 'success' : 'info'}`}>{saved ? 'Publicado' : 'Cambios sin publicar'}</span>
            </div>

            <label className="field-stack"><span>Etiqueta superior</span><input value={heroEyebrow} onChange={(event) => { setHeroEyebrow(event.target.value); markDirty() }} /></label>
            <label className="field-stack"><span>Título principal</span><textarea value={heroTitle} onChange={(event) => { setHeroTitle(event.target.value); markDirty() }} rows={3} /><small>{heroTitle.length}/110 caracteres recomendados</small></label>
            <label className="field-stack"><span>Texto de presentación</span><textarea value={heroSubtitle} onChange={(event) => { setHeroSubtitle(event.target.value); markDirty() }} rows={4} /></label>

            <div className="field-grid-two">
              <label className="field-stack"><span>Botón principal</span><input value={primaryCta} onChange={(event) => { setPrimaryCta(event.target.value); markDirty() }} /></label>
              <label className="field-stack"><span>Botón secundario</span><input value={secondaryCta} onChange={(event) => { setSecondaryCta(event.target.value); markDirty() }} /></label>
            </div>

            <div className="field-stack hero-image-management">
              <span>Imagen principal</span>
              <div className="hero-image-actions">
                <label className={`button button-primary cms-image-upload-button${uploadingImage ? ' is-loading' : ''}`}>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImage} disabled={uploadingImage || saving || loading} aria-label="Subir/Cambiar imagen: Portada principal" />
                  {uploadingImage ? 'Subiendo…' : heroMediaId || previewUrl ? 'Cambiar imagen' : 'Subir imagen'}
                </label>
                <button className="button button-ghost" type="button" onClick={() => setShowHeroPicker((current) => !current)} disabled={uploadingImage || saving || loading || mediaOptions.length === 0} aria-expanded={showHeroPicker}>Elegir de Multimedia</button>
                {(heroMediaId || previewUrl) && <button className="cms-image-remove" type="button" onClick={removeHeroImage} disabled={uploadingImage || saving || loading}>Quitar imagen</button>}
              </div>

              {showHeroPicker && !isDemoMode && mediaOptions.length > 0 && (
                <label className="cms-image-existing-picker"><span>Imagen existente</span><select value={heroMediaId} onChange={(event) => selectExistingMedia(event.target.value)} aria-label="Elegir imagen existente para Portada principal"><option value="">Usar fallback premium</option>{mediaOptions.map((item) => <option key={item.id} value={item.id}>{item.title || item.file}</option>)}</select></label>
              )}

              <div className="selected-file"><span>IMG</span><div><strong>{imageName}</strong><small>{heroMediaId ? 'Vinculada a la portada · guardada en Multimedia' : previewUrl ? 'Vista previa local' : 'Fallback premium activo'}</small></div></div>
              <small>JPG, PNG o WebP · máximo 8 MB · las nuevas imágenes se registran en Multimedia.</small>
            </div>

            <div className="cms-form-actions">
              <button className="button button-primary" type="submit" disabled={saving || loading || uploadingImage}>{saving ? 'Guardando…' : 'Guardar y publicar'}</button>
              <button className="button button-ghost" type="button" disabled={saving || loading || uploadingImage} onClick={() => void persist(false)}>Guardar borrador</button>
            </div>
          </form>

          <aside className="cms-preview-panel">
            <div className="preview-browser-bar"><i /><i /><i /><span>Vista previa de portada</span></div>
            <div className="cms-hero-preview">
              <div className="cms-hero-preview-copy">
                <span className="eyebrow">{heroEyebrow || 'LANGUAGE SCHOOL'}</span><h1>{heroTitle || 'Título de portada'}</h1><p>{heroSubtitle || 'Texto de presentación de la academia.'}</p>
                <div className="hero-actions"><span className="button button-primary">{primaryCta || 'Botón principal'}</span><span className="button button-ghost">{secondaryCta || 'Botón secundario'}</span></div>
              </div>
              <div className="cms-image-preview" style={previewUrl ? { backgroundImage: `url(${previewUrl})` } : undefined}>{!previewUrl && <div><span>FALLBACK</span><strong>Visual premium</strong><small>Sube o selecciona una imagen para sustituirlo</small></div>}</div>
            </div>
          </aside>
        </div>

        <section className="panel cms-section-list home-visual-admin-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">IMÁGENES DE LA HOME</span><h3>Visuales por sección</h3><p className="muted">Sube o cambia cada imagen directamente. Todo archivo nuevo se registra primero en Biblioteca Multimedia.</p></div>
            <Link className="button button-ghost" to="/admin/multimedia">Abrir Multimedia</Link>
          </div>
          <div className="home-visual-admin-grid">{renderVisualCards(homeVisualSlots)}</div>
        </section>

        <section className="panel cms-section-list home-visual-admin-panel public-page-visual-admin-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">IMÁGENES DE PÁGINAS</span><h3>Portadas de la web pública</h3><p className="muted">Profesores, Sobre nosotros, Tarifas, Blog y Contacto se gestionan aquí con el mismo flujo. Quitar una selección recupera el fallback premium.</p></div>
            <span className="status info">5 páginas</span>
          </div>
          <div className="home-visual-admin-grid">{renderVisualCards(publicPageVisualSlots)}</div>
          <div className="cms-form-actions"><button className="button button-primary" type="button" disabled={saving || loading || uploadingImage} onClick={() => void persist(true)}>{saving ? 'Publicando…' : 'Publicar cambios de imágenes'}</button></div>
        </section>

        <section className="panel cms-section-list">
          <div className="panel-heading"><div><span className="eyebrow">GESTIÓN WEB</span><h3>Contenido conectado</h3></div><span className="status success">CMS activo</span></div>
          <div className="cms-section-cards">
            <button type="button"><b>01</b><span><strong>Programas</strong><small>Imágenes generales y portadas específicas por curso</small></span><em>Activo</em></button>
            <button type="button"><b>02</b><span><strong>Metodología</strong><small>Imagen principal seleccionable o subible desde aquí</small></span><em>Activo</em></button>
            <button type="button"><b>03</b><span><strong>Profesores</strong><small>Foto individual y portada pública configurables</small></span><em>Activo</em></button>
            <button type="button"><b>04</b><span><strong>Contacto</strong><small>Imagen, datos, dirección y mapa conectado</small></span><em>Activo</em></button>
          </div>
        </section>
      </div>
    </DashboardShell>
  )
}
