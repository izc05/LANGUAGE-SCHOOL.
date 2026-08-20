import { useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import MonthlyClassCalendar, { monthForDateKey, todayKey } from '../../components/MonthlyClassCalendar'
import PortalEmptyState from '../../components/PortalEmptyState'
import { useAuth } from '../../features/auth/AuthProvider'
import { listMyTeacherClasses } from '../../services/pocketbase/teacherClasses'
import type { ClassRecord, GroupRecord } from '../../services/pocketbase/studentPortal'
import { teacherNav } from './teacherNav'

const demoGroup: GroupRecord = {
  id: 'agenda-demo-group', collectionId: '', collectionName: 'groups', created: '', updated: '',
  name: 'Adultos B1', course: 'demo-course', teacher: 'demo-teacher', academic_year: '2026/27',
  schedule_text: 'Martes y jueves 18:00', capacity: 10, target_level: 'B1', default_delivery_mode: 'IN_PERSON', status: 'ACTIVE',
}

function demoClasses(): ClassRecord[] {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const at = (day: number, hour: number) => new Date(year, month, day, hour, 0).toISOString()
  return [
    { id: 'agenda-demo-1', collectionId: '', collectionName: 'classes', created: '', updated: '', group: demoGroup.id, teacher: 'demo-teacher', starts_at: at(5, 18), ends_at: at(5, 19), topic: 'Travel & experiences', description: 'Speaking + vocabulary', status: 'COMPLETED', delivery_mode: 'IN_PERSON', location_text: 'Aula 2', expand: { group: demoGroup } },
    { id: 'agenda-demo-2', collectionId: '', collectionName: 'classes', created: '', updated: '', group: demoGroup.id, teacher: 'demo-teacher', starts_at: at(12, 18), ends_at: at(12, 19), topic: 'Past experiences', description: 'Grammar + speaking', status: 'SCHEDULED', delivery_mode: 'HYBRID', location_text: 'Aula 2', expand: { group: demoGroup } },
    { id: 'agenda-demo-3', collectionId: '', collectionName: 'classes', created: '', updated: '', group: demoGroup.id, teacher: 'demo-teacher', starts_at: at(19, 18), ends_at: at(19, 19), topic: 'Listening workshop', description: 'Listening practice', status: 'SCHEDULED', delivery_mode: 'ONLINE', expand: { group: demoGroup } },
    { id: 'agenda-demo-4', collectionId: '', collectionName: 'classes', created: '', updated: '', group: demoGroup.id, teacher: 'demo-teacher', starts_at: at(26, 18), ends_at: at(26, 19), topic: 'Monthly review', description: 'Revisión del mes', status: 'SCHEDULED', delivery_mode: 'IN_PERSON', location_text: 'Aula 2', expand: { group: demoGroup } },
  ]
}

function keyForClass(record: ClassRecord): string {
  const date = new Date(record.starts_at)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dayLabel(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12)
  const label = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function classTime(record: ClassRecord): string {
  const start = new Date(record.starts_at)
  const end = new Date(record.ends_at)
  const fmt = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' })
  return `${fmt.format(start)}–${fmt.format(end)}`
}

function modeLabel(record: ClassRecord): string {
  if (record.delivery_mode === 'ONLINE') return 'Online'
  if (record.delivery_mode === 'HYBRID') return 'Híbrida'
  return 'Presencial'
}

function statusLabel(record: ClassRecord): string {
  if (record.status === 'COMPLETED') return 'Completada'
  if (record.status === 'CANCELLED') return 'Cancelada'
  return 'Programada'
}

export default function TeacherAgendaPage() {
  const { isDemoMode } = useAuth()
  const [classes, setClasses] = useState<ClassRecord[]>(isDemoMode ? demoClasses() : [])
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [month, setMonth] = useState(monthForDateKey(todayKey()))
  const [loading, setLoading] = useState(!isDemoMode)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    listMyTeacherClasses(500)
      .then((records) => { if (mounted) setClasses(records) })
      .catch(() => { if (mounted) setError('No se ha podido cargar tu agenda. Inténtalo de nuevo en unos segundos.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode])

  const selectedClasses = useMemo(
    () => classes.filter((record) => keyForClass(record) === selectedDate).sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [classes, selectedDate],
  )

  const monthCount = useMemo(
    () => classes.filter((record) => {
      const date = new Date(record.starts_at)
      return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth()
    }).length,
    [classes, month],
  )

  return (
    <DashboardShell role="Profesor" name="Profesor" nav={[...teacherNav]}>
      <div className="dashboard-content teacher-portal-page agenda-page teacher-agenda-page">
        <header className="teacher-page-heading">
          <div>
            <span className="eyebrow">PLANIFICACIÓN</span>
            <h2>Agenda</h2>
            <p>Consulta el mes completo y localiza rápidamente qué días tienes clase, a qué hora y con qué grupo.</p>
          </div>
          <div className="private-space-badge"><strong>{monthCount}</strong><span>clases este mes</span></div>
        </header>

        {loading && <div className="cms-notice" role="status">Cargando agenda…</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        <MonthlyClassCalendar
          classes={classes}
          month={month}
          selectedDate={selectedDate}
          onMonthChange={setMonth}
          onSelectDate={setSelectedDate}
        />

        <section className="agenda-day-panel panel">
          <div className="panel-heading">
            <div><span className="eyebrow">DÍA SELECCIONADO</span><h3>{dayLabel(selectedDate)}</h3></div>
            <span className="status info">{selectedClasses.length}</span>
          </div>
          {selectedClasses.length > 0 ? (
            <div className="agenda-class-list">
              {selectedClasses.map((record) => (
                <article className="agenda-class-card" key={record.id}>
                  <time className="agenda-class-time">{classTime(record)}</time>
                  <div className="agenda-class-copy">
                    <strong>{record.topic}</strong>
                    <small>{record.expand?.group?.name || 'Grupo'} · {modeLabel(record)}{record.location_text ? ` · ${record.location_text}` : ''}</small>
                  </div>
                  <span className={`agenda-class-status ${record.status.toLowerCase()}`}>{statusLabel(record)}</span>
                </article>
              ))}
            </div>
          ) : (
            <PortalEmptyState compact title="Sin clases este día" description="Selecciona otro día marcado en el calendario para ver sus clases." />
          )}
        </section>
      </div>
    </DashboardShell>
  )
}
