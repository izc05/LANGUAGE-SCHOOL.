import DashboardShell from '../../components/DashboardShell'

export default function StudentDashboard() {
  return (
    <DashboardShell
      role="Alumno"
      name="Emma"
      nav={['Resumen', 'Mis clases', 'Material', 'Tareas', 'Mis archivos', 'Listening', 'Avisos']}
    >
      <div className="dashboard-content">
        <section className="dashboard-hero-card">
          <div>
            <span className="eyebrow eyebrow-light">PRÓXIMA CLASE</span>
            <h2>Thursday · 18:00</h2>
            <p>Unit 04 · Travel & experiences · B1</p>
          </div>
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
