import { useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import PortalEmptyState from '../../components/PortalEmptyState'
import { useAuth } from '../../features/auth/AuthProvider'
import { listMyNotifications, markMyNotificationRead, type NotificationRecord } from '../../services/pocketbase/studentPortal'
import { studentNav } from './studentNav'

type NoticeView = {
  id: string
  title: string
  body: string
  type: NotificationRecord['type']
  readAt: string
  created: string
  record?: NotificationRecord
}

const demoNotices: NoticeView[] = [
  { id: 'demo-1', title: 'Nuevo material disponible', body: 'Ya tienes la ficha Unit 04 · Travel en tu apartado Material.', type: 'MATERIAL', readAt: '', created: '2026-08-12T17:30:00+02:00' },
  { id: 'demo-2', title: 'Próxima clase', body: 'Recuerda tu clase de mañana a las 18:00.', type: 'CLASS', readAt: '', created: '2026-08-12T12:00:00+02:00' },
  { id: 'demo-3', title: 'Tarea revisada', body: 'Tu profesor ha revisado Vocabulary review.', type: 'ASSIGNMENT', readAt: '2026-08-11T18:00:00+02:00', created: '2026-08-11T16:00:00+02:00' },
]

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Reciente'
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

function typeLabel(value: NoticeView['type']): string {
  if (value === 'CLASS') return 'Clase'
  if (value === 'MATERIAL') return 'Material'
  if (value === 'ASSIGNMENT') return 'Tarea'
  if (value === 'SYSTEM') return 'Sistema'
  return 'General'
}

export default function StudentNotificationsPage() {
  const { isDemoMode } = useAuth()
  const [notices, setNotices] = useState<NoticeView[]>(isDemoMode ? demoNotices : [])
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL')
  const [loading, setLoading] = useState(!isDemoMode)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    listMyNotifications(100)
      .then((records) => {
        if (!mounted) return
        setNotices(records.map((record) => ({
          id: record.id,
          title: record.title,
          body: record.body,
          type: record.type,
          readAt: record.read_at,
          created: record.created,
          record,
        })))
      })
      .catch(() => {
        if (mounted) setError('No se han podido cargar tus avisos. Inténtalo de nuevo en unos segundos.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [isDemoMode])

  const unread = notices.filter((item) => !item.readAt).length
  const visible = useMemo(() => filter === 'UNREAD' ? notices.filter((item) => !item.readAt) : notices, [filter, notices])

  async function markRead(item: NoticeView) {
    if (item.readAt) return

    if (isDemoMode || !item.record) {
      setNotices((current) => current.map((notice) => notice.id === item.id ? { ...notice, readAt: new Date().toISOString() } : notice))
      return
    }

    try {
      const updated = await markMyNotificationRead(item.record)
      setNotices((current) => current.map((notice) => notice.id === item.id ? { ...notice, readAt: updated.read_at, record: updated } : notice))
    } catch {
      setError('No se ha podido marcar el aviso como leído.')
    }
  }

  return (
    <DashboardShell role="Alumno" name="Alumno" nav={[...studentNav]}>
      <div className="dashboard-content student-files-page">
        <header className="student-page-heading">
          <div><span className="eyebrow">COMUNICACIONES</span><h2>Avisos</h2><p>Novedades sobre clases, material, tareas y comunicaciones de la academia.</p></div>
          <div className="private-space-badge"><strong>{unread}</strong><span>sin leer</span></div>
        </header>

        {loading && <div className="cms-notice" role="status">Cargando avisos…</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        <section className="panel media-toolbar-panel">
          <div className="filter-pills">
            <button type="button" className={filter === 'ALL' ? 'active' : ''} onClick={() => setFilter('ALL')}>Todos</button>
            <button type="button" className={filter === 'UNREAD' ? 'active' : ''} onClick={() => setFilter('UNREAD')}>Sin leer · {unread}</button>
          </div>
        </section>

        <section className="panel student-notice-list">
          {visible.map((item) => (
            <article key={item.id} className={item.readAt ? 'read' : 'unread'} onClick={() => void markRead(item)}>
              <span className="student-notice-dot" />
              <div>
                <div className="student-notice-meta"><span>{typeLabel(item.type)}</span><small>{formatDate(item.created)}</small></div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
              <span className={`status ${item.readAt ? 'success' : 'info'}`}>{item.readAt ? 'Leído' : 'Nuevo'}</span>
            </article>
          ))}
          {!loading && visible.length === 0 && (
            <PortalEmptyState
              title={filter === 'UNREAD' ? 'No tienes avisos pendientes' : 'Todavía no hay avisos'}
              description={filter === 'UNREAD' ? 'Has leído todas las comunicaciones disponibles.' : 'Las novedades sobre clases, material y tareas aparecerán aquí.'}
              action={filter === 'UNREAD' ? { label: 'Ver todos', to: '/alumno/avisos' } : undefined}
            />
          )}
        </section>
      </div>
    </DashboardShell>
  )
}
