import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import DashboardShell from '../../components/DashboardShell'
import { useAuth } from '../../features/auth/AuthProvider'
import { getStudentDashboardSnapshot, type AssignmentRecord, type ClassDeliveryMode, type ClassRecord, type EnrollmentRecord, type MaterialRecord, type NotificationRecord, type StudentFileRecord, type SubmissionRecord } from '../../services/pocketbase/studentPortal'
import { studentNav } from './studentNav'

type Snapshot = Awaited<ReturnType<typeof getStudentDashboardSnapshot>>

function formatClassDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Próximamente'
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

function formatShortDate(value: string): string {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(date)
}

function classMode(record?: ClassRecord): ClassDeliveryMode {
  return record?.delivery_mode || 'IN_PERSON'
}

function classModeLabel(mode: ClassDeliveryMode): string {
  if (mode === 'ONLINE') return 'Online'
  if (mode === 'HYBRID') return 'Híbrida'
  return 'Presencial'
}

function extensionLabel(filename: string): string { return filename.split('.').pop()?.slice(0, 4).toUpperCase() || 'FILE' }

function PendingTask({ assignment, submitted }: { assignment: AssignmentRecord; submitted: boolean }) {
  return <div className="task-item"><span className="task-icon">T</span><div><strong>{assignment.title}</strong><small>{assignment.due_at ? `Entrega · ${formatShortDate(assignment.due_at)}` : 'Sin fecha límite'}</small></div><span className={`status ${submitted ? 'success' : 'warning'}`}>{submitted ? 'Entregada' : 'Pendiente'}</span></div>
}

function MaterialItem({ material }: { material: MaterialRecord }) {
  return <div><span>{extensionLabel(material.file)}</span><div><strong>{material.title}</strong><small>{material.visibility === 'STUDENT' ? 'Material personal' : material.visibility === 'GROUP' ? 'Material del grupo' : 'Material del curso'}</small></div></div>
}

function FileItem({ file }: { file: StudentFileRecord }) {
  return <div><span>{extensionLabel(file.file)}</span><div><strong>{file.title}</strong><small>{file.category} · {formatShortDate(file.created)}</small></div></div>
}

function NoticeItem({ notice }: { notice: NotificationRecord }) {
  return <div className="task-item"><span className="task-icon">N</span><div><strong>{notice.title}</strong><small>{notice.body}</small></div><span className={`status ${notice.read_at ? 'success' : 'info'}`}>{notice.read_at ? 'Leído' : 'Nuevo'}</span></div>
}

function CampusShortcut({ to, index, label, value, helper }: { to: string; index: string; label: string; value: string; helper: string }) {
  return (
    <Link className="campus-shortcut" to={to}>
      <span className="campus-shortcut-index">{index}</span>
      <div><small>{label}</small><strong>{value}</strong><p>{helper}</p></div>
      <span className="campus-shortcut-arrow" aria-hidden="true">→</span>
    </Link>
  )
}

function DemoStudentDashboard() {
  return (
    <DashboardShell role="Alumno" name="Emma" nav={[...studentNav]}>
      <div className="dashboard-content student-dashboard-premium student-campus-home">
        <section className="campus-welcome" aria-labelledby="campus-home-title">
          <div className="campus-welcome-copy">
            <span className="eyebrow">CAMPUS LANGUAGE SCHOOL</span>
            <h2 id="campus-home-title">Tu semana de inglés, <em>en un solo lugar.</em></h2>
            <p>Entra, mira qué tienes ahora y continúa. Clases, tareas, materiales y avisos sin perder tiempo buscando.</p>
            <div className="campus-welcome-actions">
              <Link className="button button-primary" to="/alumno/clases">Ver mis clases</Link>
              <Link className="campus-text-link" to="/alumno/material">Abrir material →</Link>
            </div>
          </div>
          <article className="campus-next-class">
            <div className="campus-next-class-top"><span>PRÓXIMA CLASE</span><span className="status info">Programada</span></div>
            <strong>Jueves · 18:00</strong>
            <h3>Travel & experiences</h3>
            <p>Adult English B1 · B1 Evening</p>
            <div className="campus-next-delivery"><span className="class-mode class-mode-hybrid">Híbrida</span><span>📍 Aula 2</span></div>
            <a className="campus-online-entry" href="https://example.com/language-school-class" target="_blank" rel="noreferrer">Entrar en clase online ↗</a>
          </article>
        </section>

        <section className="campus-shortcuts" aria-label="Accesos principales del campus">
          <CampusShortcut to="/alumno/tareas" index="01" label="TAREAS" value="1 pendiente" helper="Tu siguiente entrega" />
          <CampusShortcut to="/alumno/material" index="02" label="MATERIAL" value="3 nuevos" helper="Recursos de esta semana" />
          <CampusShortcut to="/alumno/avisos" index="03" label="AVISOS" value="2 nuevos" helper="Novedades de la academia" />
        </section>

        <div className="campus-work-grid">
          <section className="panel campus-work-panel"><div className="panel-heading"><div><span className="eyebrow">AHORA</span><h3>Tu trabajo</h3></div><Link to="/alumno/tareas">Ver todas →</Link></div><div className="task-list"><div className="task-item"><span className="task-icon">W</span><div><strong>Writing · My last trip</strong><small>Entrega · viernes</small></div><span className="status warning">Pendiente</span></div><div className="task-item"><span className="task-icon">L</span><div><strong>Listening · Airport announcements</strong><small>12 min · Unit 04</small></div><span className="status info">Nuevo</span></div></div></section>
          <section className="panel campus-work-panel"><div className="panel-heading"><div><span className="eyebrow">RECIENTE</span><h3>Material para continuar</h3></div><Link to="/alumno/material">Ver material →</Link></div><div className="file-list"><div><span>PDF</span><div><strong>Unit-04-Travel.pdf</strong><small>Profesor · hace 2 días</small></div></div><div><span>MP3</span><div><strong>Listening-airport.mp3</strong><small>Profesor · hace 2 días</small></div></div><div><span>DOC</span><div><strong>Writing-template.docx</strong><small>Profesor · ayer</small></div></div></div></section>
        </div>

        <section className="campus-course-strip">
          <div><span className="eyebrow">TU CURSO ACTUAL</span><h3>Adult English B1</h3><p>B1 Evening · Matrícula activa</p></div>
          <div className="campus-level"><strong>B1</strong><span>Nivel actual</span></div>
          <div className="campus-course-links"><Link to="/alumno/clases">Clases</Link><Link to="/alumno/archivos">Mis archivos</Link><Link to="/alumno/perfil">Mi perfil</Link></div>
        </section>
      </div>
    </DashboardShell>
  )
}

function ConnectedStudentDashboard() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    getStudentDashboardSnapshot().then((result) => { if (mounted) setSnapshot(result) }).catch(() => { if (mounted) setError('No se ha podido cargar tu espacio. Prueba de nuevo en unos segundos.') }).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const submittedAssignmentIds = useMemo(() => new Set((snapshot?.submissions || []).map((submission: SubmissionRecord) => submission.assignment)), [snapshot?.submissions])
  const activeEnrollments = (snapshot?.enrollments || []).filter((enrollment: EnrollmentRecord) => enrollment.status === 'ACTIVE')
  const nextClass: ClassRecord | undefined = snapshot?.upcomingClasses[0]
  const nextMode = classMode(nextClass)
  const currentEnrollment = activeEnrollments[0]
  const currentCourse = currentEnrollment?.expand?.group?.expand?.course
  const currentGroup = currentEnrollment?.expand?.group
  const currentLevel = currentCourse?.level || 'En progreso'
  const currentCourseTitle = currentCourse?.title || currentCourse?.level || 'Tu curso de inglés'
  const currentGroupName = currentGroup?.name || 'Grupo asignado'
  const enrollmentSummary = currentEnrollment ? `${currentCourseTitle} · ${currentGroupName} · Matrícula activa` : 'Cuando tengas una matrícula activa aparecerá aquí tu curso.'
  const pendingAssignments = (snapshot?.assignments || []).filter((assignment: AssignmentRecord) => !submittedAssignmentIds.has(assignment.id))
  const unreadNotifications = (snapshot?.notifications || []).filter((notice: NotificationRecord) => !notice.read_at)
  const recentMaterials = snapshot?.materials || []

  return (
    <DashboardShell role="Alumno" name="Alumno" nav={[...studentNav]}>
      <div className="dashboard-content student-dashboard-premium student-campus-home">
        {loading && <div className="cms-notice">Cargando tu campus…</div>}
        {error && <div className="cms-notice auth-error">{error}</div>}
        {!loading && !error && (
          <>
            <section className="campus-welcome" aria-labelledby="campus-home-title">
              <div className="campus-welcome-copy">
                <span className="eyebrow">CAMPUS LANGUAGE SCHOOL</span>
                <h2 id="campus-home-title">Tu semana de inglés, <em>en un solo lugar.</em></h2>
                <p>Entra, mira qué tienes ahora y continúa. Clases, tareas, materiales y avisos sin perder tiempo buscando.</p>
                <div className="campus-welcome-actions">
                  <Link className="button button-primary" to="/alumno/clases">Ver mis clases</Link>
                  <Link className="campus-text-link" to="/alumno/material">Abrir material →</Link>
                </div>
              </div>
              <article className="campus-next-class">
                <div className="campus-next-class-top"><span>PRÓXIMA CLASE</span><span className="status info">{nextClass ? 'Programada' : 'Sin fecha'}</span></div>
                <strong>{nextClass ? formatClassDate(nextClass.starts_at) : 'Sin clases programadas'}</strong>
                <h3>{nextClass?.topic || currentCourseTitle}</h3>
                <p>{nextClass ? `${nextClass.expand?.group?.expand?.course?.title || currentCourseTitle} · ${nextClass.expand?.group?.name || currentGroupName}` : enrollmentSummary}</p>
                {nextClass && <div className="campus-next-delivery"><span className={`class-mode class-mode-${nextMode.toLowerCase()}`}>{classModeLabel(nextMode)}</span>{nextMode !== 'ONLINE' && <span>📍 {nextClass.location_text || 'Aula pendiente'}</span>}</div>}
                {nextClass && nextMode !== 'IN_PERSON' && nextClass.online_join_url
                  ? <a className="campus-online-entry" href={nextClass.online_join_url} target="_blank" rel="noreferrer">Entrar en clase online ↗</a>
                  : nextClass && nextMode !== 'IN_PERSON'
                    ? <span className="campus-online-pending">Acceso online pendiente</span>
                    : <Link to="/alumno/clases">Abrir agenda →</Link>}
              </article>
            </section>

            <section className="campus-shortcuts" aria-label="Accesos principales del campus">
              <CampusShortcut to="/alumno/tareas" index="01" label="TAREAS" value={`${pendingAssignments.length} ${pendingAssignments.length === 1 ? 'pendiente' : 'pendientes'}`} helper="Entregas y feedback" />
              <CampusShortcut to="/alumno/material" index="02" label="MATERIAL" value={`${recentMaterials.length} disponibles`} helper="Recursos de tu curso" />
              <CampusShortcut to="/alumno/avisos" index="03" label="AVISOS" value={`${unreadNotifications.length} ${unreadNotifications.length === 1 ? 'nuevo' : 'nuevos'}`} helper="Novedades importantes" />
            </section>

            <div className="campus-work-grid">
              <section className="panel campus-work-panel"><div className="panel-heading"><div><span className="eyebrow">AHORA</span><h3>Tu trabajo</h3></div><Link to="/alumno/tareas">Ver todas →</Link></div><div className="task-list">{(snapshot?.assignments || []).slice(0, 4).map((assignment: AssignmentRecord) => <PendingTask key={assignment.id} assignment={assignment} submitted={submittedAssignmentIds.has(assignment.id)} />)}{(snapshot?.assignments.length || 0) === 0 && <p className="muted">No tienes tareas asignadas. Tu trabajo de la semana aparecerá aquí.</p>}</div></section>
              <section className="panel campus-work-panel"><div className="panel-heading"><div><span className="eyebrow">RECIENTE</span><h3>Material para continuar</h3></div><Link to="/alumno/material">Ver material →</Link></div><div className="file-list">{recentMaterials.slice(0, 4).map((material: MaterialRecord) => <MaterialItem key={material.id} material={material} />)}{recentMaterials.length === 0 && <p className="muted">Todavía no tienes material publicado.</p>}</div></section>
            </div>

            <section className="campus-course-strip">
              <div><span className="eyebrow">TU CURSO ACTUAL</span><h3>{currentCourseTitle}</h3><p>{currentEnrollment ? `${currentGroupName} · Matrícula activa` : enrollmentSummary}</p></div>
              <div className="campus-level"><strong>{currentLevel}</strong><span>Nivel actual</span></div>
              <div className="campus-course-links"><Link to="/alumno/clases">Clases</Link><Link to="/alumno/archivos">Mis archivos</Link><Link to="/alumno/perfil">Mi perfil</Link></div>
            </section>

            {(snapshot?.files.length || unreadNotifications.length) > 0 && (
              <div className="campus-secondary-grid">
                <section className="panel campus-secondary-panel"><div className="panel-heading"><div><span className="eyebrow">MIS ARCHIVOS</span><h3>Espacio privado</h3></div><Link to="/alumno/archivos">Abrir →</Link></div><div className="file-list">{(snapshot?.files || []).slice(0, 3).map((file: StudentFileRecord) => <FileItem key={file.id} file={file} />)}</div></section>
                <section className="panel campus-secondary-panel"><div className="panel-heading"><div><span className="eyebrow">AVISOS</span><h3>Novedades</h3></div><Link to="/alumno/avisos">Ver todos →</Link></div><div className="task-list">{(snapshot?.notifications || []).slice(0, 3).map((notice: NotificationRecord) => <NoticeItem key={notice.id} notice={notice} />)}</div></section>
              </div>
            )}
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
