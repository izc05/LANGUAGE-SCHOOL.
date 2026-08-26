import { useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import { useAuth } from '../../features/auth/AuthProvider'
import { getTeacherDashboardSnapshot, type TeacherEnrollmentRecord } from '../../services/pocketbase/teacherPortal'
import type { AssignmentRecord, ClassRecord, SubmissionRecord } from '../../services/pocketbase/studentPortal'
import { teacherNav } from './teacherNav'

type Snapshot = Awaited<ReturnType<typeof getTeacherDashboardSnapshot>>

function sameLocalDay(value: string): boolean {
  const date = new Date(value)
  const today = new Date()
  return !Number.isNaN(date.getTime())
    && date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate()
}

function formatTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '--:--' : new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(date)
}

function TeacherWorkspaceHero({ summary }: { summary: string }) {
  return (
    <section className="teacher-workspace-hero">
      <div>
        <span className="eyebrow">TU ESPACIO DOCENTE</span>
        <h2>Clases, alumnos y correcciones, <em>bien organizados.</em></h2>
        <p>{summary}</p>
      </div>
      <img src={`${import.meta.env.BASE_URL}visuals/teacher-workspace-art.svg`} alt="" aria-hidden="true" />
    </section>
  )
}

function DemoTeacherDashboard() {
  return (
    <DashboardShell role="Profesor" name="Laura" nav={[...teacherNav]}>
      <div className="dashboard-content teacher-dashboard-premium">
        <TeacherWorkspaceHero summary="Todo lo importante del día a mano: grupos activos, próximas clases, entregas y material docente." />
        <section className="metric-grid">
          <article><span>Alumnos activos</span><strong>24</strong><small>4 grupos</small></article>
          <article><span>Clases hoy</span><strong>5</strong><small>Primera · 16:00</small></article>
          <article><span>Entregas nuevas</span><strong>7</strong><small>Por revisar</small></article>
          <article><span>Material</span><strong>18</strong><small>Recursos propios</small></article>
        </section>
        <div className="dashboard-two-columns teacher-columns">
          <section className="panel"><div className="panel-heading"><div><span className="eyebrow">HOY</span><h3>Clases programadas</h3></div></div><div className="schedule-list"><div><time>16:00</time><div><strong>Kids A2</strong><small>8 alumnos</small></div><span className="status info">Próxima</span></div><div><time>18:00</time><div><strong>Adultos B1</strong><small>6 alumnos</small></div><span className="status neutral">Pendiente</span></div></div></section>
          <section className="panel"><div className="panel-heading"><div><span className="eyebrow">CORRECCIONES</span><h3>Entregas recientes</h3></div></div><div className="student-list"><div><span className="avatar-mini">E</span><div><strong>Emma R.</strong><small>Writing · My last trip</small></div><span className="status warning">Revisar</span></div></div></section>
        </div>
      </div>
    </DashboardShell>
  )
}

function ConnectedTeacherDashboard() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    getTeacherDashboardSnapshot()
      .then((result) => { if (mounted) setSnapshot(result) })
      .catch(() => { if (mounted) setError('No se ha podido cargar el espacio del profesor.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const students = useMemo(() => new Set((snapshot?.enrollments || []).map((item: TeacherEnrollmentRecord) => item.student)), [snapshot?.enrollments])
  const todayClasses = (snapshot?.upcomingClasses || []).filter((item: ClassRecord) => sameLocalDay(item.starts_at))
  const pending = (snapshot?.submissions || []).filter((item: SubmissionRecord) => item.status === 'SUBMITTED')
  const assignmentMap = useMemo(() => new Map((snapshot?.assignments || []).map((item: AssignmentRecord) => [item.id, item.title])), [snapshot?.assignments])
  const studentMap = useMemo(() => new Map((snapshot?.enrollments || []).map((item: TeacherEnrollmentRecord) => {
    const record = item.expand?.student
    return [item.student, record ? [record.name, record.surname].filter(Boolean).join(' ') : 'Alumno']
  })), [snapshot?.enrollments])

  const summary = todayClasses.length > 0
    ? `Hoy tienes ${todayClasses.length} ${todayClasses.length === 1 ? 'clase programada' : 'clases programadas'} y ${pending.length} ${pending.length === 1 ? 'entrega pendiente' : 'entregas pendientes'} de revisión.`
    : `Hoy no tienes clases programadas. Tienes ${pending.length} ${pending.length === 1 ? 'entrega pendiente' : 'entregas pendientes'} de revisión.`

  return (
    <DashboardShell role="Profesor" name="Profesor" nav={[...teacherNav]}>
      <div className="dashboard-content teacher-dashboard-premium">
        {loading && <div className="cms-notice">Cargando grupos, clases y entregas…</div>}
        {error && <div className="cms-notice auth-error">{error}</div>}
        {!loading && !error && <>
          <TeacherWorkspaceHero summary={summary} />
          <section className="metric-grid">
            <article><span>Alumnos activos</span><strong>{students.size}</strong><small>{snapshot?.groups.length || 0} grupos</small></article>
            <article><span>Clases hoy</span><strong>{todayClasses.length}</strong><small>{todayClasses[0] ? `Primera · ${formatTime(todayClasses[0].starts_at)}` : 'Sin clases hoy'}</small></article>
            <article><span>Entregas nuevas</span><strong>{pending.length}</strong><small>Por revisar</small></article>
            <article><span>Material</span><strong>{snapshot?.materials.length || 0}</strong><small>Recursos recientes</small></article>
          </section>
          <div className="dashboard-two-columns teacher-columns">
            <section className="panel">
              <div className="panel-heading"><div><span className="eyebrow">HOY</span><h3>Clases programadas</h3></div><span className="status info">{todayClasses.length}</span></div>
              <div className="schedule-list">{todayClasses.map((item: ClassRecord) => <div key={item.id}><time>{formatTime(item.starts_at)}</time><div><strong>{item.topic || item.expand?.group?.name || 'Clase'}</strong><small>{item.expand?.group?.expand?.course?.title || item.expand?.group?.name || 'Tu grupo'}</small></div><span className="status info">Programada</span></div>)}{todayClasses.length === 0 && <p className="muted">No tienes clases pendientes hoy.</p>}</div>
            </section>
            <section className="panel">
              <div className="panel-heading"><div><span className="eyebrow">CORRECCIONES</span><h3>Entregas recientes</h3></div><span className="status warning">{pending.length}</span></div>
              <div className="student-list">{pending.slice(0, 6).map((submission: SubmissionRecord) => { const studentName = studentMap.get(submission.student) || 'Alumno'; return <div key={submission.id}><span className="avatar-mini">{studentName.charAt(0).toUpperCase()}</span><div><strong>{studentName}</strong><small>{assignmentMap.get(submission.assignment) || 'Tarea'} · pendiente</small></div><span className="status warning">Revisar</span></div> })}{pending.length === 0 && <p className="muted">No tienes entregas pendientes.</p>}</div>
            </section>
          </div>
        </>}
      </div>
    </DashboardShell>
  )
}

export default function TeacherDashboard() {
  const { isDemoMode } = useAuth()
  return isDemoMode ? <DemoTeacherDashboard /> : <ConnectedTeacherDashboard />
}
