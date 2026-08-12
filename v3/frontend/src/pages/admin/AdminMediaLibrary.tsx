import { type ChangeEvent, useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import { isDemoMode } from '../../config/environment'
import {
  createMedia,
  deleteMedia,
  getMediaUrl,
  listMedia,
  type MediaRecord,
  type MediaUsage,
} from '../../services/pocketbase/media'
import { adminNav } from './adminNav'

type MediaItem = {
  id: string
  name: string
  usage: MediaUsage
  type: string
  previewUrl?: string
  record?: MediaRecord
}

const initialMedia: MediaItem[] = [
  { id: 'demo-1', name: 'hero-academy.jpg', usage: 'WEBSITE', type: 'JPG' },
  { id: 'demo-2', name: 'kids-class.webp', usage: 'WEBSITE', type: 'WEBP' },
  { id: 'demo-3', name: 'teacher-laura.jpg', usage: 'WEBSITE', type: 'JPG' },
  { id: 'demo-4', name: 'blog-speaking.jpg', usage: 'BLOG', type: 'JPG' },
  { id: 'demo-5', name: 'exam-preparation.webp', usage: 'WEBSITE', type: 'WEBP' },
  { id: 'demo-6', name: 'classroom-detail.jpg', usage: 'WEBSITE', type: 'JPG' },
]

const usageOptions: Array<{ value: 'ALL' | MediaUsage; label: string }> = [
  { value: 'ALL', label: 'Todas' },
  { value: 'WEBSITE', label: 'Página web' },
  { value: 'BLOG', label: 'Blog' },
  { value: 'INTERNAL', label: 'Interno' },
]

function usageLabel(usage: MediaUsage): string {
  if (usage === 'BLOG') return 'Blog'
  if (usage === 'INTERNAL') return 'Interno'
  return 'Página web'
}

function recordToItem(record: MediaRecord): MediaItem {
  const extension = record.file.split('.').pop()?.toUpperCase() || 'IMG'
  return {
    id: record.id,
    name: record.title || record.file,
    usage: record.usage,
    type: extension,
    previewUrl: getMediaUrl(record, '300x300'),
    record,
  }
}

export default function AdminMediaLibrary() {
  const [items, setItems] = useState<MediaItem[]>(isDemoMode ? initialMedia : [])
  const [filter, setFilter] = useState<'ALL' | MediaUsage>('ALL')
  const [search, setSearch] = useState('')
  const [lastUpload, setLastUpload] = useState<string | null>(null)
  const [loading, setLoading] = useState(!isDemoMode)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isDemoMode) return

    let mounted = true
    listMedia()
      .then((records) => {
        if (mounted) setItems(records.map(recordToItem))
      })
      .catch(() => {
        if (mounted) setError('No se ha podido cargar la biblioteca multimedia de PocketBase.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)
    setLastUpload(null)

    if (isDemoMode) {
      const extension = file.name.split('.').pop()?.toUpperCase() || 'IMG'
      const previewUrl = URL.createObjectURL(file)
      setItems((current) => [
        { id: `demo-${Date.now()}`, name: file.name, usage: filter === 'ALL' ? 'WEBSITE' : filter, type: extension, previewUrl },
        ...current,
      ])
      setLastUpload(`${file.name} · añadido solo a la demo`)
      event.target.value = ''
      return
    }

    setUploading(true)
    try {
      const record = await createMedia({
        title: file.name,
        file,
        altText: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
        usage: filter === 'ALL' ? 'WEBSITE' : filter,
        mediaType: 'IMAGE',
      })
      setItems((current) => [recordToItem(record), ...current])
      setLastUpload(`${file.name} · guardado en PocketBase`)
    } catch {
      setError('No se ha podido subir la imagen. Revisa conexión, formato y permisos ADMIN.')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  async function handleDelete(item: MediaItem) {
    if (!window.confirm(`¿Eliminar ${item.name} de la biblioteca?`)) return

    setError(null)

    if (isDemoMode) {
      setItems((current) => current.filter((candidate) => candidate.id !== item.id))
      setLastUpload(`${item.name} · eliminado de la demo`)
      return
    }

    try {
      await deleteMedia(item.id)
      setItems((current) => current.filter((candidate) => candidate.id !== item.id))
      setLastUpload(`${item.name} · eliminado de PocketBase`)
    } catch {
      setError('No se ha podido eliminar la imagen. Puede estar en uso o faltar permisos.')
    }
  }

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return items.filter((item) => {
      const matchesUsage = filter === 'ALL' || item.usage === filter
      const matchesSearch = !normalizedSearch || item.name.toLowerCase().includes(normalizedSearch)
      return matchesUsage && matchesSearch
    })
  }, [filter, items, search])

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page">
        <header className="cms-page-heading">
          <div>
            <span className="eyebrow">CMS · MULTIMEDIA</span>
            <h2>Biblioteca de imágenes</h2>
            <p>Un único lugar para reutilizar fotografías en la portada, programas, profesores y artículos del blog.</p>
          </div>
          <label className={`button button-primary media-upload-button${uploading ? ' disabled' : ''}`}>
            {uploading ? 'Subiendo…' : '+ Subir imagen'}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleUpload} disabled={uploading} />
          </label>
        </header>

        {loading && <div className="cms-notice">Cargando biblioteca desde PocketBase…</div>}
        {lastUpload && <div className="cms-notice success-notice"><strong>Multimedia:</strong> {lastUpload}</div>}
        {error && <div className="cms-notice">{error}</div>}

        <section className="panel media-toolbar-panel">
          <div className="media-toolbar">
            <div className="filter-pills">
              {usageOptions.map((option) => (
                <button key={option.value} className={filter === option.value ? 'active' : ''} type="button" onClick={() => setFilter(option.value)}>
                  {option.label}
                </button>
              ))}
            </div>
            <label className="media-search"><span>Buscar</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre de archivo..." /></label>
          </div>
        </section>

        <section className="media-grid-admin">
          {filtered.map((item, index) => (
            <article className="media-card-admin" key={item.id}>
              <div
                className={`media-card-visual media-tone-${(index % 4) + 1}`}
                style={item.previewUrl ? { backgroundImage: `url(${item.previewUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
              >
                {!item.previewUrl && <span>{item.type}</span>}
              </div>
              <div className="media-card-info">
                <div><strong>{item.name}</strong><small>{usageLabel(item.usage)} · {item.type}</small></div>
                <button type="button" aria-label={`Opciones de ${item.name}`}>•••</button>
              </div>
              <div className="media-card-actions">
                <button type="button" onClick={() => setLastUpload(`${item.name} · seleccionada para reutilizar en el CMS`)}>Usar imagen</button>
                <button type="button" onClick={() => void handleDelete(item)}>Eliminar</button>
              </div>
            </article>
          ))}
        </section>

        {!loading && filtered.length === 0 && <div className="panel"><p className="muted">No hay imágenes que coincidan con este filtro.</p></div>}

        <section className="panel storage-panel">
          <div>
            <span className="eyebrow">ALMACENAMIENTO</span>
            <h3>{isDemoMode ? 'Preparado para el SSD de la Raspberry Pi' : 'Biblioteca conectada a PocketBase'}</h3>
            <p>Las imágenes públicas están separadas de los archivos privados de alumnos. `student_files` mantiene sus propias reglas y almacenamiento protegido.</p>
          </div>
          <div className="storage-meter">
            <div><span>{isDemoMode ? 'Demo de capacidad' : 'Archivos cargados'}</span><strong>{items.length}</strong></div>
            <div className="progress-line"><span style={{ width: `${Math.min(100, items.length * 2)}%` }} /></div>
            <small>El uso real de disco se medirá en el servidor de la Raspberry.</small>
          </div>
        </section>
      </div>
    </DashboardShell>
  )
}
