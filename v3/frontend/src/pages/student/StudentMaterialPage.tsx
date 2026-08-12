import { useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import { useAuth } from '../../features/auth/AuthProvider'
import { getMaterialDownloadUrl, listMyMaterials, type MaterialRecord } from '../../services/pocketbase/studentPortal'
import { studentNav } from './studentNav'

type MaterialView = {
  id: string
  title: string
  description: string
  file: string
  visibility: 'COURSE' | 'GROUP' | 'STUDENT'
  record?: MaterialRecord
}

const demoMaterials: MaterialView[] = [
  { id: 'demo-1', title: 'Unit 04 · Travel', description: 'Ficha principal de vocabulario y speaking.', file: 'unit-04-travel.pdf', visibility: 'GROUP' },
  { id: 'demo-2', title: 'Airport announcements', description: 'Listening de práctica para la próxima clase.', file: 'airport-listening.mp3', visibility: 'GROUP' },
  { id: 'demo-3', title: 'Writing template', description: 'Plantilla para preparar el writing de esta semana.', file: 'writing-template.docx', visibility: 'STUDENT' },
]

function extension(filename: string): string {
  return filename.split('.').pop()?.slice(0, 4).toUpperCase() || 'FILE'
}

function visibilityLabel(value: MaterialView['visibility']): string {
  if (value === 'STUDENT') return 'Solo para ti'
  if (value === 'GROUP') return 'Tu grupo'
  return 'Tu curso'
}

export default function StudentMaterialPage() {
  const { isDemoMode } = useAuth()
  const [materials, setMaterials] = useState<MaterialView[]>(isDemoMode ? demoMaterials : [])
  const [filter, setFilter] = useState<'ALL' | MaterialView['visibility']>('ALL')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(!isDemoMode)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    listMyMaterials(100)
      .then((records) => {
        if (!mounted) return
        setMaterials(records.map((record) => ({
          id: record.id,
          title: record.title,
          description: record.description,
          file: record.file,
          visibility: record.visibility,
          record,
        })))
      })
      .catch(() => {
        if (mounted) setError('No se ha podido cargar tu material autorizado.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [isDemoMode])

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    return materials.filter((item) => {
      const matchesFilter = filter === 'ALL' || item.visibility === filter
      const matchesSearch = !query || `${item.title} ${item.description} ${item.file}`.toLowerCase().includes(query)
      return matchesFilter && matchesSearch
    })
  }, [filter, materials, search])

  async function download(item: MaterialView) {
    setError(null)
    setMessage(null)
    if (isDemoMode || !item.record) {
      setMessage('La descarga protegida estará disponible cuando PocketBase esté conectado.')
      return
    }

    try {
      const url = await getMaterialDownloadUrl(item.record)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setError('No se ha podido generar el enlace protegido de este material.')
    }
  }

  return (
    <DashboardShell role="Alumno" name="Alumno" nav={[...studentNav]}>
      <div className="dashboard-content student-files-page">
        <header className="student-page-heading">
          <div><span className="eyebrow">APRENDIZAJE</span><h2>Material</h2><p>Recursos publicados para ti, tu grupo o el curso en el que estás matriculado.</p></div>
          <div className="private-space-badge"><strong>{materials.length}</strong><span>recursos disponibles</span></div>
        </header>

        {loading && <div className="cms-notice">Cargando material…</div>}
        {message && <div className="cms-notice success-notice">{message}</div>}
        {error && <div className="cms-notice auth-error">{error}</div>}

        <section className="panel media-toolbar-panel">
          <div className="media-toolbar">
            <div className="filter-pills">
              {[
                ['ALL', 'Todo'],
                ['STUDENT', 'Solo para mí'],
                ['GROUP', 'Mi grupo'],
                ['COURSE', 'Mi curso'],
              ].map(([value, label]) => (
                <button key={value} type="button" className={filter === value ? 'active' : ''} onClick={() => setFilter(value as typeof filter)}>{label}</button>
              ))}
            </div>
            <label className="media-search"><span>Buscar</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Título o archivo..." /></label>
          </div>
        </section>

        <section className="student-resource-grid">
          {visible.map((item) => (
            <article className="panel student-resource-card" key={item.id}>
              <div className="student-resource-icon">{extension(item.file)}</div>
              <div className="student-resource-copy">
                <span className="eyebrow">{visibilityLabel(item.visibility)}</span>
                <h3>{item.title}</h3>
                <p>{item.description || 'Material publicado por tu profesor.'}</p>
                <small>{item.file}</small>
              </div>
              <button className="button button-ghost button-small" type="button" onClick={() => void download(item)}>Descargar</button>
            </article>
          ))}
          {!loading && visible.length === 0 && <div className="panel"><p className="muted">No hay material que coincida con este filtro.</p></div>}
        </section>
      </div>
    </DashboardShell>
  )
}
