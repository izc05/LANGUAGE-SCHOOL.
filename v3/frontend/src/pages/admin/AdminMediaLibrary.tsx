import { type ChangeEvent, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import { adminNav } from './adminNav'

type MediaItem = {
  id: number
  name: string
  usage: string
  type: string
}

const initialMedia: MediaItem[] = [
  { id: 1, name: 'hero-academy.jpg', usage: 'Portada', type: 'JPG' },
  { id: 2, name: 'kids-class.webp', usage: 'Programa Kids', type: 'WEBP' },
  { id: 3, name: 'teacher-laura.jpg', usage: 'Profesores', type: 'JPG' },
  { id: 4, name: 'blog-speaking.jpg', usage: 'Blog', type: 'JPG' },
  { id: 5, name: 'exam-preparation.webp', usage: 'Exámenes', type: 'WEBP' },
  { id: 6, name: 'classroom-detail.jpg', usage: 'Academia', type: 'JPG' },
]

export default function AdminMediaLibrary() {
  const [items, setItems] = useState(initialMedia)
  const [filter, setFilter] = useState('Todas')
  const [lastUpload, setLastUpload] = useState<string | null>(null)

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const extension = file.name.split('.').pop()?.toUpperCase() || 'IMG'
    setItems((current) => [
      { id: Date.now(), name: file.name, usage: 'Sin asignar', type: extension },
      ...current,
    ])
    setLastUpload(file.name)
  }

  const filtered = filter === 'Todas' ? items : items.filter((item) => item.usage === filter)

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page">
        <header className="cms-page-heading">
          <div>
            <span className="eyebrow">CMS · MULTIMEDIA</span>
            <h2>Biblioteca de imágenes</h2>
            <p>Un único lugar para reutilizar fotografías en la portada, programas, profesores y artículos del blog.</p>
          </div>
          <label className="button button-primary media-upload-button">
            + Subir imagen
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleUpload} />
          </label>
        </header>

        {lastUpload && (
          <div className="cms-notice success-notice"><strong>Imagen añadida a la demo:</strong> {lastUpload}. Al conectar PocketBase se subirá al SSD.</div>
        )}

        <section className="panel media-toolbar-panel">
          <div className="media-toolbar">
            <div className="filter-pills">
              {['Todas', 'Portada', 'Blog', 'Profesores', 'Academia'].map((option) => (
                <button key={option} className={filter === option ? 'active' : ''} type="button" onClick={() => setFilter(option)}>{option}</button>
              ))}
            </div>
            <label className="media-search"><span>Buscar</span><input placeholder="Nombre de archivo..." /></label>
          </div>
        </section>

        <section className="media-grid-admin">
          {filtered.map((item, index) => (
            <article className="media-card-admin" key={item.id}>
              <div className={`media-card-visual media-tone-${(index % 4) + 1}`}>
                <span>{item.type}</span>
              </div>
              <div className="media-card-info">
                <div><strong>{item.name}</strong><small>{item.usage}</small></div>
                <button type="button" aria-label={`Opciones de ${item.name}`}>•••</button>
              </div>
              <div className="media-card-actions">
                <button type="button">Usar imagen</button>
                <button type="button">Detalles</button>
              </div>
            </article>
          ))}
        </section>

        <section className="panel storage-panel">
          <div>
            <span className="eyebrow">ALMACENAMIENTO</span>
            <h3>Preparado para el SSD de la Raspberry Pi</h3>
            <p>Las imágenes públicas estarán gestionadas por PocketBase. Los archivos privados de alumnos tendrán reglas distintas y nunca se mezclarán con esta biblioteca pública.</p>
          </div>
          <div className="storage-meter">
            <div><span>Demo de capacidad</span><strong>1.8 GB / 80 GB</strong></div>
            <div className="progress-line"><span style={{ width: '8%' }} /></div>
            <small>El valor real se calculará en el servidor.</small>
          </div>
        </section>
      </div>
    </DashboardShell>
  )
}
