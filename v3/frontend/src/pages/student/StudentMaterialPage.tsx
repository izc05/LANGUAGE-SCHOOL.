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
  created: string
  record?: MaterialRecord
}

type MaterialSort = 'RECENT' | 'TITLE' | 'TYPE'

const demoMaterials: MaterialView[] = [
  { id: 'demo-1', title: 'Unit 04 · Travel', description: 'Ficha principal de vocabulario y speaking.', file: 'unit-04-travel.pdf', visibility: 'GROUP', created: '2026-08-18T09:00:00Z' },
  { id: 'demo-2', title: 'Airport announcements', description: 'Listening de práctica para la próxima clase.', file: 'airport-listening.mp3', visibility: 'GROUP', created: '2026-08-17T16:30:00Z' },
  { id: 'demo-3', title: 'Writing template', description: 'Plantilla para preparar el writing de esta semana.', file: 'writing-template.docx', visibility: 'STUDENT', created: '2026-08-15T10:00:00Z' },
]

function extension(filename: string): string {
  return filename.split('.').pop()?.slice(0, 4).toUpperCase() || 'FILE'
}

function visibilityLabel(value: MaterialView['visibility']): string {
  if (value === 'STUDENT') return 'Solo para ti'
  if (value === 'GROUP') return 'Tu grupo'
  return 'Tu curso'
}

function formatPublished(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }).format(date)
}

function compareMaterials(a: MaterialView, b: MaterialView, sort: MaterialSort): number {
  if (sort === 'TITLE') return a.title.localeCompare(b.title, 'es', { sensitivity: 'base' })
  if (sort === 'TYPE') {
    const typeDifference = extension(a.file).localeCompare(extension(b.file), 'es', { sensitivity: 'base' })
    return typeDifference || a.title.localeCompare(b.title, 'es', { sensitivity: 'base' })
  }
  return new Date(b.created).getTime() - new Date(a.created).getTime()
}

export default function StudentMaterialPage() {
  const { isDemoMode } = useAuth()
  const [materials, setMaterials] = useState<MaterialView[]>(isDemoMode ? demoMaterials : [])
  const [filter, setFilter] = useState<'ALL' | MaterialView['visibility']>('ALL')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<MaterialSort>('RECENT')
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
          created: record.created,
          record,
        })))
      })
      .catch(() => {
        if (mounted) setError('No se ha podido cargar tu material. Inténtalo de nuevo en unos segundos.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [isDemoMode])

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    return materials
      .filter((item) => {
        const matchesFilter = filter === 'ALL' || item.visibility === filter
        const matchesSearch = !query || `${item.title} ${item.description} ${item.file}`.toLowerCase().includes(query)
        return matchesFilter && matchesSearch
      })
      .sort((a, b) => compareMaterials(a, b, sort))
  }, [filter, materials, search, sort])

  const showFeatured = !search.trim() && filter === 'ALL' && sort === 'RECENT' && visible.length > 0
  const featured = showFeatured ? visible[0] : null
  const libraryItems = featured ? visible.slice(1) : visible

  const personalCount = materials.filter((item) => item.visibility === 'STUDENT').length
  const groupCount = materials.filter((item) => item.visibility === 'GROUP').length
  const courseCount = materials.filter((item) => item.visibility === 'COURSE').length

  async function download(item: MaterialView) {
    setError(null)
    setMessage(null)
    if (isDemoMode || !item.record) {
      setMessage('La descarga real no está disponible en la demostración.')
      return
    }

    try {
      const url = await getMaterialDownloadUrl(item.record)
      window.location.assign(url)
    } catch {
      setError('No se ha podido preparar la descarga de este material. Inténtalo de nuevo.')
    }
  }

  return (
    <DashboardShell role="Alumno" name="Alumno" nav={[...studentNav]}>
      <div className="dashboard-content student-files-page student-material-phase10d">
        <header className="student-page-heading student-material-heading10">
          <div><span className="eyebrow">TU BIBLIOTECA</span><h2>Material</h2><p>Empieza por lo último que ha publicado la academia y encuentra después cualquier recurso por ámbito, nombre o tipo de archivo.</p></div>
          <div className="private-space-badge"><strong>{materials.length}</strong><span>{materials.length === 1 ? 'recurso disponible' : 'recursos disponibles'}</span></div>
        </header>

        <section className="student-material-overview10" aria-label="Resumen del material">
          <div><small>SOLO PARA TI</small><strong>{personalCount}</strong></div>
          <div><small>TU GRUPO</small><strong>{groupCount}</strong></div>
          <div><small>TU CURSO</small><strong>{courseCount}</strong></div>
        </section>

        {loading && <div className="cms-notice" role="status">Cargando material…</div>}
        {message && <div className="cms-notice success-notice" role="status">{message}</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        {!loading && featured && (
          <section className="student-material-featured10" aria-labelledby="student-material-featured-title">
            <div className="student-material-featured-type"><span>{extension(featured.file)}</span><small>ÚLTIMO RECURSO</small></div>
            <div className="student-material-featured-copy">
              <div className="student-material-featured-meta"><span className="eyebrow">{visibilityLabel(featured.visibility)}</span><span>Publicado · {formatPublished(featured.created)}</span></div>
              <h3 id="student-material-featured-title">{featured.title}</h3>
              <p>{featured.description || 'Material publicado para continuar tu aprendizaje.'}</p>
              <small>{featured.file}</small>
            </div>
            <button className="button button-primary" type="button" onClick={() => void download(featured)}>Descargar recurso</button>
          </section>
        )}

        <section className="panel media-toolbar-panel student-material-toolbar10" aria-label="Buscar y ordenar material">
          <div className="media-toolbar">
            <div className="filter-pills" aria-label="Filtrar material por ámbito">
              {[
                ['ALL', 'Todo'],
                ['STUDENT', 'Solo para mí'],
                ['GROUP', 'Mi grupo'],
                ['COURSE', 'Mi curso'],
              ].map(([value, label]) => (
                <button key={value} type="button" className={filter === value ? 'active' : ''} onClick={() => setFilter(value as typeof filter)}>{label}</button>
              ))}
            </div>
            <div className="student-material-tools10">
              <label className="student-material-sort10"><span>Ordenar</span><select value={sort} onChange={(event) => setSort(event.target.value as MaterialSort)}><option value="RECENT">Más recientes</option><option value="TITLE">Título A–Z</option><option value="TYPE">Tipo de archivo</option></select></label>
              <label className="media-search"><span>Buscar</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Título, descripción o archivo..." /></label>
            </div>
          </div>
        </section>

        <div className="student-material-library-heading10">
          <div><span className="eyebrow">{featured ? 'MÁS RECURSOS' : 'BIBLIOTECA'}</span><h3>{libraryItems.length} {libraryItems.length === 1 ? 'resultado' : 'resultados'}</h3></div>
          {(search.trim() || filter !== 'ALL' || sort !== 'RECENT') && <button type="button" className="student-material-reset10" onClick={() => { setSearch(''); setFilter('ALL'); setSort('RECENT') }}>Limpiar filtros</button>}
        </div>

        <section className="student-resource-grid student-resource-grid10">
          {libraryItems.map((item) => (
            <article className="panel student-resource-card student-resource-card10" key={item.id}>
              <div className="student-resource-card-top10">
                <div className="student-resource-icon">{extension(item.file)}</div>
                <span>{formatPublished(item.created)}</span>
              </div>
              <div className="student-resource-copy">
                <span className="eyebrow">{visibilityLabel(item.visibility)}</span>
                <h3>{item.title}</h3>
                <p>{item.description || 'Material publicado por tu profesor.'}</p>
                <small>{item.file}</small>
              </div>
              <button className="button button-ghost button-small" type="button" onClick={() => void download(item)}>Descargar</button>
            </article>
          ))}
          {!loading && libraryItems.length === 0 && !featured && (
            <div className="panel portal-empty-inline student-material-empty10">
              <strong>{search.trim() || filter !== 'ALL' ? 'No hay resultados con estos filtros' : 'Todavía no tienes material publicado'}</strong>
              <p>{search.trim() || filter !== 'ALL' ? 'Prueba a cambiar la búsqueda o seleccionar Todo.' : 'Cuando tu profesor publique un recurso aparecerá aquí automáticamente.'}</p>
              {(search.trim() || filter !== 'ALL' || sort !== 'RECENT') && <button type="button" className="button button-ghost button-small" onClick={() => { setSearch(''); setFilter('ALL'); setSort('RECENT') }}>Ver todo</button>}
            </div>
          )}
          {!loading && featured && libraryItems.length === 0 && (
            <div className="panel portal-empty-inline student-material-empty10"><strong>Este es tu único recurso disponible</strong><p>Cuando se publique más material aparecerá aquí, debajo del recurso más reciente.</p></div>
          )}
        </section>
      </div>
    </DashboardShell>
  )
}
