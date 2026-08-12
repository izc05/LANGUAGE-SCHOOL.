import DashboardShell from '../../components/DashboardShell'

export default function TeacherDashboard() {
  return (
    <DashboardShell
      role="Profesor"
      name="Laura"
      nav={['Resumen', 'Mis alumnos', 'Clases', 'Material', 'Tareas', 'Correcciones', 'Avisos']}
    >
      <div className="dashboard-content">
        <section className="metric-grid">
          <article><span>Alumnos activos</span><strong>24</strong><small>4 grupos</small></article>
          <article><span>Clases hoy</span><strong>5</strong><small>Primera · 16:00</small></article>
          <article><span>Entregas nuevas</span><strong>7</strong><small>Por revisar</small></article>
          <article><span>Avisos</span><strong>2</strong><small>Esta semana</small></article>
        </section>

        <div className="dashboard-two-columns teacher-columns">
          <section className="panel">
            <div className="panel-heading"><div><span className="eyebrow">HOY</span><h3>Clases programadas</h3></div><button type="button">Calendario</button></div>
            <div className="schedule-list">
              <div><time>16:00</time><div><strong>Kids A2</strong><small>8 alumnos · Aula 1</small></div><span className="status info">Próxima</span></div>
              <div><time>17:00</time><div><strong>Teens B1</strong><small>7 alumnos · Aula 2</small></div><span className="status neutral">Pendiente</span></div>
              <div><time>18:00</time><div><strong>Adultos B1</strong><small>6 alumnos · Aula 1</small></div><span className="status neutral">Pendiente</span></div>
              <div><time>19:00</time><div><strong>Cambridge B2</strong><small>5 alumnos · Aula 2</small></div><span className="status neutral">Pendiente</span></div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading"><div><span className="eyebrow">CORRECCIONES</span><h3>Entregas recientes</h3></div><button type="button">Ver 7</button></div>
            <div className="student-list">
              {[
                ['Emma R.', 'Writing · My last trip', 'hace 20 min'],
                ['Carlos M.', 'B2 Essay · Environment', 'hace 1 h'],
                ['Lucía G.', 'Grammar review · Unit 3', 'ayer'],
                ['Daniel P.', 'Speaking notes', 'ayer'],
              ].map(([name, task, time]) => (
                <div key={name}><span className="avatar-mini">{name.charAt(0)}</span><div><strong>{name}</strong><small>{task} · {time}</small></div><button type="button">Revisar</button></div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </DashboardShell>
  )
}
