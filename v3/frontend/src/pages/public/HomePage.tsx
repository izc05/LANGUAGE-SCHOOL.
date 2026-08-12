import { Link } from 'react-router'
import SiteShell from '../../components/SiteShell'

const programs = [
  { tag: '6–12 años', title: 'Kids', text: 'Una base sólida con vocabulario, comprensión, juegos guiados y speaking progresivo.' },
  { tag: '13–17 años', title: 'Teens', text: 'Refuerzo, confianza al hablar y preparación orientada a objetivos académicos.' },
  { tag: 'Adultos', title: 'English for life', text: 'Inglés práctico para trabajo, viajes, conversación y desarrollo personal.' },
  { tag: 'A2 · B1 · B2 · C1', title: 'Exámenes', text: 'Preparación estructurada por destrezas, simulacros y corrección personalizada.' },
]

const steps = [
  ['01', 'Conocemos tu punto de partida', 'Nivel, objetivo, disponibilidad y la forma en que aprendes mejor.'],
  ['02', 'Creamos una ruta clara', 'Cada etapa tiene contenidos, tareas y objetivos que puedes seguir.'],
  ['03', 'Practicamos de verdad', 'Speaking, listening, writing y vocabulario aplicado a situaciones reales.'],
  ['04', 'Medimos el progreso', 'El alumno puede consultar material, tareas, clases y evolución desde su espacio privado.'],
]

export default function HomePage() {
  return (
    <SiteShell>
      <section className="hero-v3">
        <div className="container hero-grid-v3">
          <div className="hero-copy">
            <span className="eyebrow">ACADEMIA DE INGLÉS · JÓDAR</span>
            <h1>Tu inglés no necesita más teoría. Necesita <em>confianza.</em></h1>
            <p className="hero-lead">
              Clases cercanas, objetivos claros y una plataforma propia para que cada alumno tenga sus recursos, tareas y seguimiento siempre disponibles.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#programas">Descubrir programas</a>
              <Link className="button button-ghost" to="/acceso">Entrar a mi espacio</Link>
            </div>
            <div className="trust-row">
              <span>Grupos reducidos</span><span>Seguimiento personal</span><span>Recursos privados</span>
            </div>
          </div>

          <div className="hero-visual" aria-label="Vista conceptual de la plataforma del alumno">
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <article className="portal-card portal-card-main">
              <span className="portal-label">MY ENGLISH SPACE</span>
              <h3>Good afternoon, Emma.</h3>
              <p>Tu próxima clase empieza el jueves a las 18:00.</p>
              <div className="progress-line"><span style={{ width: '72%' }} /></div>
              <div className="portal-stats"><strong>72%</strong><span>Objetivo B1</span></div>
            </article>
            <article className="portal-card portal-card-small portal-card-task">
              <span>Writing</span><strong>1 tarea pendiente</strong><small>Entrega · viernes</small>
            </article>
            <article className="portal-card portal-card-small portal-card-file">
              <span>Nuevo material</span><strong>Unit 04 · Travel</strong><small>PDF · Listening</small>
            </article>
          </div>
        </div>
      </section>

      <section className="section section-soft" id="programas">
        <div className="container">
          <div className="section-heading">
            <span className="eyebrow">PROGRAMAS</span>
            <h2>Un camino distinto para cada etapa.</h2>
            <p>No queremos llenar una web de cursos. Queremos que cada persona encuentre rápidamente dónde encaja.</p>
          </div>
          <div className="program-grid">
            {programs.map((program, index) => (
              <article className="program-card" key={program.title}>
                <span className="program-number">0{index + 1}</span>
                <span className="pill">{program.tag}</span>
                <h3>{program.title}</h3>
                <p>{program.text}</p>
                <a href="#contacto">Consultar →</a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container split-feature">
          <div className="section-heading left">
            <span className="eyebrow">MÉTODO</span>
            <h2>La clase termina. El aprendizaje continúa.</h2>
            <p>La V3 nace unida a la futura plataforma PocketBase: el trabajo realizado en clase tendrá continuidad en el espacio privado del alumno.</p>
            <Link className="text-link" to="/acceso">Ver cómo será el área privada →</Link>
          </div>
          <div className="steps-list">
            {steps.map(([number, title, text]) => (
              <div className="step-row" key={number}>
                <span>{number}</span><div><h3>{title}</h3><p>{text}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section platform-band">
        <div className="container platform-grid">
          <div>
            <span className="eyebrow eyebrow-light">PLATAFORMA DEL ALUMNO</span>
            <h2>Todo lo importante, en un solo lugar.</h2>
            <p>Material del profesor, archivos propios, tareas, próximas clases, avisos y recursos. Sin carpetas perdidas ni enlaces dispersos.</p>
            <Link className="button button-light" to="/alumno">Ver demo del alumno</Link>
          </div>
          <div className="platform-features">
            {['Mis clases', 'Archivos privados', 'Tareas y entregas', 'Material de estudio', 'Listening', 'Avisos'].map(item => (
              <div key={item}><span>✓</span>{item}</div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-heading section-heading-row">
            <div><span className="eyebrow">BLOG</span><h2>English, one useful idea at a time.</h2></div>
            <Link className="text-link" to="/blog">Ver todos los artículos →</Link>
          </div>
          <div className="article-grid">
            <article className="article-card featured-article"><span>Speaking</span><h3>5 formas de ganar confianza al hablar inglés</h3><p>Pequeños hábitos para dejar de traducir mentalmente cada frase.</p><Link to="/blog">Leer artículo →</Link></article>
            <article className="article-card"><span>Vocabulary</span><h3>Cómo aprender vocabulario sin memorizar listas infinitas</h3><p>Contexto, repetición y uso real.</p><Link to="/blog">Leer →</Link></article>
            <article className="article-card"><span>Exams</span><h3>B1: qué debes dominar antes de empezar simulacros</h3><p>Una lista sencilla para comprobar tu base.</p><Link to="/blog">Leer →</Link></article>
          </div>
        </div>
      </section>

      <section className="section cta-section">
        <div className="container cta-panel">
          <div><span className="eyebrow">PRIMER PASO</span><h2>Cuéntanos qué quieres conseguir con tu inglés.</h2></div>
          <a className="button button-primary" href="#contacto">Solicitar información</a>
        </div>
      </section>
    </SiteShell>
  )
}
