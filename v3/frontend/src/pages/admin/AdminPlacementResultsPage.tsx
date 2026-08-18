import { useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import PortalEmptyState from '../../components/PortalEmptyState'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  getPlacementAdminOverview,
  type PlacementAdminAttempt,
  type PlacementAdminOverview,
  type PlacementAdminStudentLevel,
} from '../../services/pocketbase/placementAdmin'
import { adminNav } from './adminNav'

const demoOverview: PlacementAdminOverview = {
  metrics: { totalAttempts: 12, completedAttempts: 10, publicAttempts: 7, campusAttempts: 5, studentsWithLevel: 4, validatedStudents: 2 },
  studentLevels: [
    { studentId: 'demo-1', studentName: 'Emma Martín', email: 'emma@example.com', status: 'ACTIVE', currentLevel: 'B1', currentLevelSource: 'VALIDATED', latestAttempt: null, latestAssessment: { id: 'demo-assessment', automaticLevel: 'B1', speakingLevel: 'B1', validatedLevel: 'B1', reason: 'REVIEW', notes: 'Nivel consolidado.', assessedAt: '2026-08-18T10:00:00Z', assessedBy: 'demo-teacher', assessedByName: 'Profesora Demo', sourceAttemptId: '' }, attemptCount: 2, assessmentCount: 1 },
  ],
  recentAttempts: [],
}

function dateLabel(value: string): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

function sourceLabel(source: PlacementAdminStudentLevel['currentLevelSource']): string {
  if (source === 'VALIDATED') return 'Validado por profesor'
  if (source === 'AUTOMATIC') return 'Estimación automática'
  return 'Sin evaluar'
}

function attemptLabel(attempt: PlacementAdminAttempt): string {
  return attempt.mode === 'PUBLIC' ? 'Público' : 'Campus'
}

export default function AdminPlacementResultsPage() {
  const { isDemoMode } = useAuth()
  const [overview, setOverview] = useState<PlacementAdminOverview | null>(isDemoMode ? demoOverview : null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(!isDemoMode)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    setLoading(true)
    getPlacementAdminOverview()
      .then((result) => { if (mounted) setOverview(result) })
      .catch(() => { if (mounted) setError('No se han podido cargar los resultados del test de nivel.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode])

  const students = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!overview) return []
    if (!normalized) return overview.studentLevels
    return overview.studentLevels.filter((student) => `${student.studentName} ${student.email} ${student.currentLevel}`.toLowerCase().includes(normalized))
  }, [overview, query])

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page placement-results-page">
        <header className="cms-page-heading">
          <div><span className="eyebrow">EVALUACIÓN · SEGUIMIENTO</span><h2>Resultados de nivel</h2><p>Consulta el nivel académico derivado del histórico real y los intentos recientes. El nivel validado por profesor tiene prioridad sobre la estimación automática.</p></div>
        </header>

        {loading && <div className="cms-notice" role="status">Cargando resultados…</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        {overview && <>
          <section className="metric-grid placement-results-metrics">
            <article><span>Intentos</span><strong>{overview.metrics.totalAttempts}</strong><small>{overview.metrics.completedAttempts} completados</small></article>
            <article><span>Campus</span><strong>{overview.metrics.campusAttempts}</strong><small>Evaluaciones identificadas</small></article>
            <article><span>Con nivel</span><strong>{overview.metrics.studentsWithLevel}</strong><small>Alumnos evaluados</small></article>
            <article><span>Validados</span><strong>{overview.metrics.validatedStudents}</strong><small>Con criterio docente</small></article>
          </section>

          <section className="panel placement-results-students">
            <div className="panel-heading"><div><span className="eyebrow">NIVEL ACTUAL</span><h3>Alumnos</h3></div><label className="placement-results-search"><span className="sr-only">Buscar alumno</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar alumno o nivel…" /></label></div>
            <div className="placement-results-student-list">
              {students.map((student) => <article key={student.studentId}>
                <div className="placement-result-level"><strong>{student.currentLevel || '—'}</strong><small>{sourceLabel(student.currentLevelSource)}</small></div>
                <div className="placement-result-student"><strong>{student.studentName}</strong><span>{student.email}</span><small>{student.attemptCount} evaluaciones Campus · {student.assessmentCount} valoraciones docentes</small></div>
                <div className="placement-result-evidence">
                  <span>Automático: <b>{student.latestAttempt?.estimatedLevel || '—'}</b></span>
                  <span>Speaking: <b>{student.latestAssessment?.speakingLevel || '—'}</b></span>
                  <span>Validado: <b>{student.latestAssessment?.validatedLevel || '—'}</b></span>
                  <small>{student.latestAssessment ? `Valorado por ${student.latestAssessment.assessedByName || 'profesor'} · ${dateLabel(student.latestAssessment.assessedAt)}` : student.latestAttempt ? `Último test · ${dateLabel(student.latestAttempt.completedAt)}` : 'Sin evaluación registrada'}</small>
                </div>
              </article>)}
              {students.length === 0 && <PortalEmptyState compact title="Sin resultados" description={query.trim() ? 'No hay alumnos que coincidan con la búsqueda.' : 'Todavía no hay niveles académicos registrados.'} />}
            </div>
          </section>

          <section className="panel placement-results-attempts">
            <div className="panel-heading"><div><span className="eyebrow">HISTÓRICO</span><h3>Intentos recientes</h3></div><span className="status info">{overview.recentAttempts.length}</span></div>
            <div className="placement-attempt-table" role="table" aria-label="Intentos recientes del test de nivel">
              <div className="placement-attempt-row placement-attempt-head" role="row"><span>Modo</span><span>Persona</span><span>Versión</span><span>Resultado</span><span>Fecha</span></div>
              {overview.recentAttempts.map((attempt) => <div className="placement-attempt-row" role="row" key={attempt.id}>
                <span><b>{attemptLabel(attempt)}</b><small>{attempt.status}</small></span>
                <span>{attempt.studentName}</span>
                <span>{attempt.testVersion || '—'}</span>
                <span><b>{attempt.estimatedLevel || '—'}</b><small>{attempt.status === 'COMPLETED' ? `${Math.round(attempt.scorePercent)}%` : 'En curso'}</small></span>
                <span>{dateLabel(attempt.completedAt || attempt.startedAt)}</span>
              </div>)}
              {overview.recentAttempts.length === 0 && <PortalEmptyState compact title="Sin intentos" description="Los intentos públicos y Campus aparecerán aquí cuando se utilice el test." />}
            </div>
          </section>
        </>}
      </div>
    </DashboardShell>
  )
}
