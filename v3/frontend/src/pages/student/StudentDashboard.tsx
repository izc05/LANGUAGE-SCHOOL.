import { useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  getStudentDashboardSnapshot,
  type AssignmentRecord,
  type ClassRecord,
  type EnrollmentRecord,
  type MaterialRecord,
  type NotificationRecord,
  type StudentFileRecord,
  type SubmissionRecord,
} from '../../services/pocketbase/studentPortal'
import { studentNav } from './studentNav'

type Snapshot = Awaited<ReturnType<typeof getStudentDashboardSnapshot>>

function formatClassDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Próximamente'
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatShortDate(value: string): string {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(date)
}

function extensionLabel(filename: string): string {
  return filename.split('.').pop()?.slice(0, 4).toUpperCase() || 'FILE'
}

function DemoStudentDashboard() {
  return (
    <DashboardShell role="Alumno" name="Emma" nav={[...studentNav]}>
      <div className="dashboard-content">
        <section className="dashboard-hero-card">
          <div><span className="eyebrow eyebrow-light">PRÓXIMA CLASE</span><h2>Thursday · 18:00</h2><p>Unit 04 · Travel & experiences · B1</p></div>
          <div className="dashboard-hero-badge"><strong>72%</strong><span>Objetivo B1</span></div>
        </section>
        <section className="metric-grid">
          <article><span>Clases este mes</span><strong>6</strong><small>2 próximas</small></article>
          <article><span>Tareas pendientes</span><strong>1</strong><small>Entrega viernes</small></article>
          <article><span>Material nuevo</span><strong>3</strong><small>Últimos 7 días</small></article>
          <article><span>Archivos</span><strong>18</strong><small>Espacio privado</small></article>
        </section>
        <div className="dashboard-two-columns">
          <section className="panel">
            <div className="panel-heading"><div><span className="eyebrow">PARA ESTA SEMANA</span><h3>Tu trabajo</h3></div><button type="button">Ver todo</button></div>
            <div className="task-list">
              <div className="task-item"><span className="task-icon">W</span><div><strong>Writing · My last trip</strong><small>Entrega · viernes</small></div><span className="status warning">Pendiente</span></div>
              <div className="task-item"><span className="task-icon">L</span><div><strong>Listening · Airport announcements</strong><small>12 min · Unit 04</small></div><span className="status info">Nuevo</span></div>
              <div className="task-item"><span className="task-icon">V</span><div><strong>Vocabulary · Travel verbs</strong><small>Ficha PDF</small></div><span className="status success">Visto</span></div>
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading"><div><span className="eyebrow">ARCHIVOS</span><h3>Material reciente</h3></div><button type="button">Abrir carpeta</button></div>
            <div className="file-list">
              <div><span>PDF</span><div><strong>Unit-04-Travel.pdf</strong><small>Profesor · hace 2 días</small></div></div>
              <div><span>MP3</span><div><strong>Listening-airport.mp3</strong><small>Profesor · hace 2 días</small></div></div>
              <div><span>DOC</span><div><strong>Writing-template.docx</strong><small>Profesor · ayer</small></div></div>
            </div>
          </section>
        </div>
      </div>
    </DashboardShell>
  )
}

function PendingTask({ assignment, submitted }: { assignment: AssignmentRecord; submitted: boolean }) {
  return (
    <div className="task-item">
      <span className="task-icon">T</span>
      <div><strong>{assignment.title}</strong><small>{assignment.due_at ? `Entrega · ${formatShortDate(assignment.due_at)}` : 'Sin fecha límite'}</small></div>
      <span className={`status ${submitted ? 'success' : 'warning'}`}>{submitted ? 'Entregada' : 'Pendiente'}</span>
    </div>
  )
}

function MaterialItem({ material }: { material: MaterialRecord }) {
  return (
    <div>
      <span>{extensionLabel(material.file)}</span>
      <div><strong>{material.title}</strong><small>{material.visibility === 'STUDENT' ? 'Material personal' : material.visibility === 'GROUP' ? 'Material del grupo' : 'Material del curso'}</small></div>
    </div>
  )
}

function FileItem({ file }: { file: StudentFileRecord }) {
  return (
    <div>
      <span>{extensionLabel(file.file)}</span>
      <div><strong>{file.title}</strong><small>{file.category} · {formatShortDate(file.created)}</small></div>
    </div>
  )
}

function NoticeItem({ notice }: { notice: NotificationRecord }) {
  return (
    <div className="task-item">
      <span className="task-icon">N</span>
      <div><strong>{notice.title}</strong><small>{notice.body}</small></div>
      <span className={`status ${notice.read_at ? 'success' : 'info'}`}>{notice.read_at ? 'Leído' : 'Nuevo'}</span>
    </div>
  )
}

function ConnectedStudentDashboard() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    getStudentDashboardSnapshot()
      .then((result) => {
        if (mounted) setSnapshot(result)
      })
      .catch(() => {
        if (mounted) setError('No se ha podido cargar tu espacio. Prueba de nuevo en unos segundos.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const submittedAssignmentIds = useMemo(
    () => new Set((snapshot?.submissions || []).map((submission: SubmissionRecord) => submission.assignment)),
    [snapshot?.submissions],
  )

  const activeEnrollments = (snapshot?.enrollments || []).filter((enrollment: EnrollmentRecord) => enrollment.status === 'ACTIVE')
  const nextClass: ClassRecord | undefined = snapshot?.upcomingClasses[0]
  const currentLevel = activeEnrollments[0]?.expand?.group?.expand?.course?.level || 'En progreso'
  const pendingAssignments = (snapshot?.assignments || []).filter((assignment: AssignmentRecord) => !submittedAssignmentIds.has(assignment.id))
  const unreadNotifications = (snapshot?.notifications || []).filter((notice: NotificationRecord) => !notice.read_at)

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const classesThisMonth = (snapshot?.recentClasses || []).filter((item: ClassRecord) => new Date(item.starts_at) >= monthStart).length

  return (
    <DashboardShell role="Alumno" name="Alumno" nav={[...studentNav]}>
      <div className="dashboard-content">
        {loading && <div className="cms-notice">Cargando tu espacio privado…</div>}
        {error && <div className="cms-notice auth-error">{error}</div>}

        {!loading && !error && (
          <>
            <section className="dashboard-hero-card">
              <div>
                <span className="eyebrow eyebrow-light">PRÓXIMA CLASE</span>
                <h2>{nextClass ? formatClassDate(nextClass.starts_at) : 'No hay clases programadas'}</h2>
                <p>{nextClass ? `${nextClass.topic}${nextClass.expand?.group?.name ? ` · ${nextClass.expand.group.name}` : ''}` : 'Cuando se programe una nueva clase aparecerá aquí.'}</p>
              </div>
              <div className="dashboard-hero-badge"><strong>{currentLevel}</strong><span>Nivel actual</span></div>
            </section>

            <section className="metric-grid">
              <article><span>Clases este mes</span><strong>{classesThisMonth}</strong><small>{snapshot?.upcomingClasses.length || 0} próximas</small></article>
              <article><span>Tareas pendientes</span><strong>{pendingAssignments.length}</strong><small>{snapshot?.assignments.length || 0} asignadas</small></article>
              <article><span>Material reciente</span><strong>{snapshot?.materials.length || 0}</strong><small>Disponible para ti</small></article>
              <article><span>Archivos</span><strong>{snapshot?.files.length || 0}</strong><small>Espacio privado</small></article>
            </section>

            <div className="dashboard-two-columns">
              <section className="panel">
                <div className="panel-heading"><div><span className="eyebrow">TAREAS</span><h3>Tu trabajo</h3></div><span className="status info">{pendingAssignments.length} pendientes</span></div>
                <div className="task-list">
                  {(snapshot?.assignments || []).slice(0, 5).map((assignment: AssignmentRecord) => (
                    <PendingTask key={assignment.id} assignment={assignment} submitted={submittedAssignmentIds.has(assignment.id)} />
                  ))}
                  {(snapshot?.assignments.length || 0) === 0 && <p className="muted">No tienes tareas asignadas.</p>}
                </div>
              </section>

              <section className="panel">
                <div className="panel-heading"><div><span className="eyebrow">MATERIAL</span><h3>Material reciente</h3></div><span className="status success">Autorizado</span></div>
                <div className="file-list">
                  {(snapshot?.materials || []).slice(0, 4).map((material: MaterialRecord) => <MaterialItem key={material.id} material={material} />)}
                  {(snapshot?.materials.length || 0) === 0 && <p className="muted">Todavía no tienes material publicado.</p>}
                </div>
              </section>
            </div>

            <div className="dashboard-two-columns">
              <section className="panel">
                <div className="panel-heading"><div><span className="eyebrow">MIS ARCHIVOS</span><h3>Espacio privado</h3></div><span className="status success">Solo tú</span></div>
                <div className="file-list">
                  {(snapshot?.files || []).slice(0, 4).map((file: StudentFileRecord) => <FileItem key={file.id} file={file} />)}
                  {(snapshot?.files.length || 0) === 0 && <p className="muted">Tu carpeta privada está vacía.</p>}
                </div>
              </section>

              <section className="panel">
                <div className="panel-heading"><div><span className="eyebrow">AVISOS</span><h3>Novedades</h3></div><span className="status info">{unreadNotifications.length} nuevos</span></div>
                <div className="task-list">
                  {(snapshot?.notifications || []).slice(0, 4).map((notice: NotificationRecord) => <NoticeItem key={notice.id} notice={notice} />)}
                  {(snapshot?.notifications.length || 0) === 0 && <p className="muted">No tienes avisos pendientes.</p>}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  )
}

export default function StudentDashboard() {
  const { isDemoMode } = useAuth()
  return isDemoMode ? <DemoStudentDashboard /> : <ConnectedStudentDashboard />
}
