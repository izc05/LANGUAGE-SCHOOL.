import DashboardShell from '../../components/DashboardShell'
import { adminNav } from './adminNav'

const days = [
  { day: 'Lunes', date: '17', classes: [{ time: '17:00', title: 'Kids A2', teacher: 'Marta' }, { time: '18:30', title: 'Exámenes C1', teacher: 'Laura' }] },
  { day: 'Martes', date: '18', classes: [{ time: '10:00', title: 'Adultos A2', teacher: 'Álvaro' }, { time: '18:00', title: 'Teens B1', teacher: 'Laura' }] },
  { day: 'Miércoles', date: '19', classes: [{ time: '17:00', title: 'Kids A2', teacher: 'Marta' }, { time: '19:00', title: 'Speaking Adultos', teacher: 'Álvaro' }] },
  { day: 'Jueves', date: '20', classes: [{ time: '18:00', title: 'Teens B1', teacher: 'Laura' }, { time: '19:30', title: 'Teens B2', teacher: 'Marta' }] },
  { day: 'Viernes', date: '21', classes: [{ time: '17:00', title: 'Kids A1', teacher: 'Marta' }, { time: '19:00', title: 'Exámenes B2', teacher: 'Laura' }] },
]

export default function AdminClassesPage() {
  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page">
        <header className="cms-page-heading">
          <div>
            <span className="eyebrow">PLATAFORMA · CLASES</span>
            <h2>Agenda y calendario</h2>
            <p>Vista semanal para controlar clases, profesores, grupos y disponibilidad antes de conectar el calendario real.</p>
          </div>
          <button className="button button-primary" type="button">+ Programar clase</button>
        </header>

        <section className="metric-grid">
          <article><span>Clases esta semana</span><strong>27</strong><small>10 visibles en demo</small></article>
          <article><span>Hoy</span><strong>5</strong><small>2 grupos · 3 individuales</small></article>
          <article><span>Horas docentes</span><strong>31 h</strong><small>Total planificado</small></article>
          <article><span>Huecos disponibles</span><strong>14</strong><small>Para nuevas reservas</small></article>
        </section>

        <section className="panel calendar-admin-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">SEMANA</span><h3>17–21 de agosto</h3></div>
            <div className="calendar-actions"><button type="button">←</button><button type="button">Hoy</button><button type="button">→</button></div>
          </div>

          <div className="week-calendar">
            {days.map((day) => (
              <div className="calendar-day" key={day.day}>
                <div className="calendar-day-heading"><span>{day.day}</span><strong>{day.date}</strong></div>
                <div className="calendar-day-body">
                  {day.classes.map((item) => (
                    <button className="calendar-class" type="button" key={`${day.day}-${item.time}-${item.title}`}>
                      <span>{item.time}</span>
                      <strong>{item.title}</strong>
                      <small>{item.teacher}</small>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="dashboard-two-columns class-bottom-grid">
          <section className="panel">
            <div className="panel-heading"><div><span className="eyebrow">PRÓXIMAS</span><h3>Siguientes clases</h3></div><button type="button">Ver agenda</button></div>
            <div className="upcoming-class-list">
              <div><span>17:00</span><div><strong>Kids A2</strong><small>Marta · Aula 1</small></div><b>5 alumnos</b></div>
              <div><span>18:00</span><div><strong>Teens B1</strong><small>Laura · Aula 2</small></div><b>6 alumnos</b></div>
              <div><span>19:00</span><div><strong>Speaking Adultos</strong><small>Álvaro · Aula 1</small></div><b>4 alumnos</b></div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading"><div><span className="eyebrow">DISPONIBILIDAD</span><h3>Huecos destacados</h3></div><span className="status success">14 libres</span></div>
            <div className="availability-grid">
              <button type="button"><span>Martes</span><strong>12:00</strong><small>Álvaro</small></button>
              <button type="button"><span>Miércoles</span><strong>18:00</strong><small>Laura</small></button>
              <button type="button"><span>Jueves</span><strong>10:00</strong><small>Álvaro</small></button>
              <button type="button"><span>Viernes</span><strong>16:00</strong><small>Marta</small></button>
            </div>
          </section>
        </div>
      </div>
    </DashboardShell>
  )
}
