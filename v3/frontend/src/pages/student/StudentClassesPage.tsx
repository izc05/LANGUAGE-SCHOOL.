import { useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import PortalEmptyState from '../../components/PortalEmptyState'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  listMyAttendance,
  listMyRecentClasses,
  listMyUpcomingClasses,
  type AttendanceRecord,
  type ClassDeliveryMode,
  type ClassRecord,
} from '../../services/pocketbase/studentPortal'
import { studentNav } from './studentNav'

type ClassView = {
  id: string
  startsAt: string
  endsAt: string
  topic: string
  groupName: string
  courseTitle: string
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'
  deliveryMode: ClassDeliveryMode
  locationText: string
  onlineJoinUrl: string
}

const demoUpcoming: ClassView[] = [
  { id: 'demo-u1', startsAt: '2026-08-20T18:00:00+02:00', endsAt: '2026-08-20T19:00:00+02:00', topic: 'Travel & experiences', groupName: 'B1 Evening', courseTitle: 'Adult English B1', status: 'SCHEDULED', deliveryMode: 'HYBRID', locationText: 'Aula 2', onlineJoinUrl: 'https://example.com/language-school-class' },
  { id: 'demo-u2', startsAt: '2026-08-25T18:00:00+02:00', endsAt: '2026-08-25T19:00:00+02:00', topic: 'Airport situations', groupName: 'B1 Evening', courseTitle: 'Adult English B1', status: 'SCHEDULED', deliveryMode: 'IN_PERSON', locationText: 'Aula 1', onlineJoinUrl: '' },
]

const demoRecent: ClassView[] = [
  { id: 'demo-r1', startsAt: '2026-08-11T18:00:00+02:00', endsAt: '2026-08-11T19:00:00+02:00', topic: 'Past experiences', groupName: 'B1 Evening', courseTitle: 'Adult English B1', status: 'COMPLETED', deliveryMode: 'ONLINE', locationText: '', onlineJoinUrl: '' },
  { id: 'demo-r2', startsAt: '2026-08-06T18:00:00+02:00', endsAt: '2026-08-06T19:00:00+02:00', topic: 'Travel vocabulary', groupName: 'B1 Evening', courseTitle: 'Adult English B1', status: 'COMPLETED', deliveryMode: 'IN_PERSON', locationText: 'Aula 2', onlineJoinUrl: '' },
]

function toView(record: ClassRecord): ClassView {
  return {
    id: record.id,
    startsAt: record.starts_at,
    endsAt: record.ends_at,
    topic: record.topic || 'Clase de inglés',
    groupName: record.expand?.group?.name || 'Tu grupo',
    courseTitle: record.expand?.group?.expand?.course?.title || record.expand?.group?.expand?.course?.level || 'Language School',
    status: record.status,
    deliveryMode: record.delivery_mode || 'IN_PERSON',
    locationText: record.location_text || '',
    onlineJoinUrl: record.online_join_url || '',
  }
}

function modeLabel(mode: ClassDeliveryMode): string {
  if (mode === 'ONLINE') return 'Online'
  if (mode === 'HYBRID') return 'Híbrida'
  return 'Presencial'
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha pendiente'
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: '2-digit', month: 'long' }).format(date)
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'
  return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(date)
}

function ClassDelivery({ item, upcoming = false }: { item: ClassView; upcoming?: boolean }) {
  return (
    <div className="student-class-delivery">
      <span className={`class-mode class-mode-${item.deliveryMode.toLowerCase()}`}>{modeLabel(item.deliveryMode)}</span>
      {item.deliveryMode !== 'ONLINE' && <span className="student-class-location">📍 {item.locationText || 'Aula pendiente'}</span>}
      {upcoming && item.deliveryMode !== 'IN_PERSON' && (
        item.onlineJoinUrl
          ? <a className="student-online-class-link" href={item.onlineJoinUrl} target="_blank" rel="noreferrer">Entrar en clase online ↗</a>
          : <span className="student-online-pending">Acceso online pendiente</span>
      )}
    </div>
  )
}

export default function StudentClassesPage() {
  const { isDemoMode } = useAuth()
  const [upcoming, setUpcoming] = useState<ClassView[]>(isDemoMode ? demoUpcoming : [])
  const [recent, setRecent] = useState<ClassView[]>(isDemoMode ? demoRecent : [])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(!isDemoMode)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    Promise.all([listMyUpcomingClasses(50), listMyRecentClasses(100), listMyAttendance(100)])
      .then(([upcomingRecords, recentRecords, attendanceRecords]) => {
        if (!mounted) return
        setUpcoming(upcomingRecords.map(toView))
        setRecent(recentRecords.map(toView))
        setAttendance(attendanceRecords)
      })
      .catch(() => {
        if (mounted) setError('No se ha podido cargar tu calendario de clases. Inténtalo de nuevo en unos segundos.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [isDemoMode])

  const attendanceMap = useMemo(() => new Map(attendance.map((item) => [item.class, item.status])), [attendance])

  return (
    <DashboardShell role="Alumno" name="Alumno" nav={[...studentNav]}>
      <div className="dashboard-content student-files-page student-classes-campus-page">
        <header className="student-page-heading">
          <div><span className="eyebrow">CALENDARIO</span><h2>Mis clases</h2><p>Consulta cuándo es tu próxima sesión, si es presencial u online y entra al aula cuando esté disponible.</p></div>
          <div className="private-space-badge"><strong>{upcoming.length}</strong><span>próximas clases</span></div>
        </header>

        {loading && <div className="cms-notice" role="status">Cargando clases…</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        <section className="panel student-class-section">
          <div className="panel-heading"><div><span className="eyebrow">PRÓXIMAS</span><h3>Tu agenda</h3></div></div>
          <div className="student-class-list student-class-list-delivery">
            {upcoming.map((item) => (
              <article key={item.id}>
                <div className="student-class-date"><strong>{formatDate(item.startsAt)}</strong><span>{formatTime(item.startsAt)} – {formatTime(item.endsAt)}</span></div>
                <div className="student-class-main"><h4>{item.topic}</h4><p>{item.courseTitle} · {item.groupName}</p><ClassDelivery item={item} upcoming /></div>
                <span className="status info">Programada</span>
              </article>
            ))}
            {!loading && upcoming.length === 0 && (
              <PortalEmptyState
                compact
                title="No hay próximas clases programadas"
                description="Cuando la academia programe tu siguiente sesión aparecerá aquí con fecha, horario y modalidad."
                action={{ label: 'Revisar material', to: '/alumno/material' }}
              />
            )}
          </div>
        </section>

        <section className="panel student-class-section">
          <div className="panel-heading"><div><span className="eyebrow">HISTORIAL</span><h3>Clases realizadas</h3></div></div>
          <div className="student-class-list student-class-list-delivery">
            {recent.map((item) => {
              const attendanceStatus = attendanceMap.get(item.id)
              return (
                <article key={item.id}>
                  <div className="student-class-date"><strong>{formatDate(item.startsAt)}</strong><span>{formatTime(item.startsAt)} – {formatTime(item.endsAt)}</span></div>
                  <div className="student-class-main"><h4>{item.topic}</h4><p>{item.courseTitle} · {item.groupName}</p><ClassDelivery item={item} /></div>
                  <span className={`status ${attendanceStatus === 'ABSENT' ? 'warning' : 'success'}`}>{attendanceStatus === 'ABSENT' ? 'Ausente' : attendanceStatus === 'JUSTIFIED' ? 'Justificada' : attendanceStatus === 'PRESENT' ? 'Asistió' : 'Realizada'}</span>
                </article>
              )
            })}
            {!loading && recent.length === 0 && (
              <PortalEmptyState
                compact
                title="Tu historial empezará con la primera clase"
                description="Aquí verás las sesiones realizadas, su modalidad y, cuando exista registro, el estado de asistencia."
              />
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  )
}
