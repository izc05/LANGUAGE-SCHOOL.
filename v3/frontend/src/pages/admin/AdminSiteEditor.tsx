import { type ChangeEvent, type FormEvent, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import { adminNav } from './adminNav'

export default function AdminSiteEditor() {
  const [heroTitle, setHeroTitle] = useState('Inglés que te acompaña dentro y fuera del aula.')
  const [heroSubtitle, setHeroSubtitle] = useState(
    'Clases cercanas, objetivos claros y un espacio privado para continuar aprendiendo entre sesiones.',
  )
  const [primaryCta, setPrimaryCta] = useState('Reservar clase de prueba')
  const [secondaryCta, setSecondaryCta] = useState('Ver programas')
  const [imageName, setImageName] = useState('hero-academy.jpg')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setImageName(file.name)
    setPreviewUrl(URL.createObjectURL(file))
    setSaved(false)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaved(true)
  }

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page">
        <header className="cms-page-heading">
          <div>
            <span className="eyebrow">CMS · PÁGINA WEB</span>
            <h2>Editar portada</h2>
            <p>
              Esta interfaz ya representa el flujo final del administrador. Al conectar PocketBase, guardar actualizará la
              colección de contenido y la imagen se almacenará en el servidor.
            </p>
          </div>
          <a className="button button-ghost" href="/" target="_blank" rel="noreferrer">Vista pública ↗</a>
        </header>

        <div className="cms-editor-grid">
          <form className="panel cms-form" onSubmit={handleSubmit}>
            <div className="panel-heading">
              <div><span className="eyebrow">HERO</span><h3>Mensaje principal</h3></div>
              <span className={`status ${saved ? 'success' : 'info'}`}>{saved ? 'Cambios guardados' : 'Borrador local'}</span>
            </div>

            <label className="field-stack">
              <span>Título principal</span>
              <textarea value={heroTitle} onChange={(event) => { setHeroTitle(event.target.value); setSaved(false) }} rows={3} />
              <small>{heroTitle.length}/110 caracteres recomendados</small>
            </label>

            <label className="field-stack">
              <span>Texto de presentación</span>
              <textarea value={heroSubtitle} onChange={(event) => { setHeroSubtitle(event.target.value); setSaved(false) }} rows={4} />
            </label>

            <div className="field-grid-two">
              <label className="field-stack">
                <span>Botón principal</span>
                <input value={primaryCta} onChange={(event) => { setPrimaryCta(event.target.value); setSaved(false) }} />
              </label>
              <label className="field-stack">
                <span>Botón secundario</span>
                <input value={secondaryCta} onChange={(event) => { setSecondaryCta(event.target.value); setSaved(false) }} />
              </label>
            </div>

            <div className="field-stack">
              <span>Imagen principal</span>
              <label className="upload-dropzone">
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImage} />
                <strong>Cambiar imagen</strong>
                <small>JPG, PNG o WebP · después se guardará en PocketBase</small>
              </label>
              <div className="selected-file"><span>IMG</span><div><strong>{imageName}</strong><small>Imagen seleccionada para la portada</small></div></div>
            </div>

            <div className="cms-form-actions">
              <button className="button button-primary" type="submit">Guardar cambios</button>
              <button className="button button-ghost" type="button" onClick={() => setSaved(false)}>Guardar borrador</button>
            </div>
          </form>

          <aside className="cms-preview-panel">
            <div className="preview-browser-bar"><i /><i /><i /><span>Vista previa de portada</span></div>
            <div className="cms-hero-preview">
              <div className="cms-hero-preview-copy">
                <span className="eyebrow">LANGUAGE SCHOOL</span>
                <h1>{heroTitle || 'Título de portada'}</h1>
                <p>{heroSubtitle || 'Texto de presentación de la academia.'}</p>
                <div className="hero-actions">
                  <span className="button button-primary">{primaryCta || 'Botón principal'}</span>
                  <span className="button button-ghost">{secondaryCta || 'Botón secundario'}</span>
                </div>
              </div>
              <div className="cms-image-preview" style={previewUrl ? { backgroundImage: `url(${previewUrl})` } : undefined}>
                {!previewUrl && <div><span>IMAGEN</span><strong>{imageName}</strong><small>Vista previa pendiente de imagen real</small></div>}
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
