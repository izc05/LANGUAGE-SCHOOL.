import { useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import PortalEmptyState from '../../components/PortalEmptyState'
import { useAuth } from '../../features/auth/AuthProvider'
import { type NotificationRecord } from '../../services/pocketbase/studentPortal'
import { listMyTeacherNotifications, markMyTeacherNotificationRead } from '../../services/pocketbase/teacherPortal'
import { teacherNav } from './teacherNav'

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
  { id: 'demo-1', title: 'Reunión de coordinación', body: 'La reunión semanal de profesorado será el jueves a las 13:30.', type: 'GENERAL', readAt: '', created: '2026-08-12T17:30:00+02:00' },
  { id: 'demo-2', title: 'Actualización del aula', body: 'Hay nuevo material de apoyo disponible para las clases de esta semana.', type: 'MATERIAL', readAt: '2026-08-11T16:00:00+02:00', created: '2026-08-11T16:00:00+02:00' },
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

export default function TeacherNotificationsPage() {
  const { isDemoMode } = useAuth()
  const [notices, setNotices] = useState<NoticeView[]>(isDemoMode ? demoNotices : [])
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL')
  const [loading, setLoading] = useState(!isDemoMode)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    listMyTeacherNotifications(100)
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
      const updated = await markMyTeacherNotificationRead(item.record)
      setNotices((current) => current.map((notice) => notice.id === item.id ? { ...notice, readAt: updated.read_at, record: updated } : notice))
    } catch {
      setError('No se ha podido marcar el aviso como leído.')
    }
  }

  return (
    <DashboardShell role="Profesor" name="Profesor" nav={[...teacherNav]}>
      <div className="dashboard-content student-files-page student-notifications-phase10f teacher-notifications-page">
        <header className="student-page-heading student-notifications-heading10">
          <div><span className="eyebrow">COMUNICACIONES</span><h2>Avisos</h2><p>Comunicaciones de coordinación, clases y recursos de la academia.</p></div>
          <div className="private-space-badge"><strong>{unread}</strong><span>{unread === 1 ? 'aviso sin leer' : 'avisos sin leer'}</span></div>
        </header>

        {loading && <div className="cms-notice" role="status">Cargando avisos…</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        <section className="panel media-toolbar-panel student-notifications-toolbar10" aria-label="Filtrar avisos">
          <div className="filter-pills">
            <button type="button" className={filter === 'ALL' ? 'active' : ''} onClick={() => setFilter('ALL')}>Todos</button>
            <button type="button" className={filter === 'UNREAD' ? 'active' : ''} onClick={() => setFilter('UNREAD')}>Sin leer · {unread}</button>
          </div>
        </section>

        <section className="panel student-notice-list student-notice-list10" aria-label="Lista de avisos">
          {visible.map((item) => (
            <article key={item.id} className={item.readAt ? 'read' : 'unread'}>
              <span className="student-notice-dot" aria-hidden="true" />
              <div className="student-notice-copy10">
                <div className="student-notice-meta"><span>{typeLabel(item.type)}</span><small>{formatDate(item.created)}</small></div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                {!item.readAt && <div className="student-notice-actions10"><button type="button" onClick={() => void markRead(item)}>Marcar como leído</button></div>}
              </div>
              <span className={`status ${item.readAt ? 'success' : 'info'}`}>{item.readAt ? 'Leído' : 'Nuevo'}</span>
            </article>
          ))}
          {!loading && visible.length === 0 && (
            <PortalEmptyState
              title={filter === 'UNREAD' ? 'No tienes avisos pendientes' : 'Todavía no hay avisos'}
              description={filter === 'UNREAD' ? 'Has leído todas las comunicaciones disponibles.' : 'Las comunicaciones de coordinación aparecerán aquí.'}
              action={filter === 'UNREAD' ? { label: 'Ver todos', to: '/profesor/avisos' } : undefined}
            />
          )}
        </section>
      </div>
    </DashboardShell>
  )
}
