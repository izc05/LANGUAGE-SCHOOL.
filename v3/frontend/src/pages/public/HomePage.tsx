import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import SiteShell from '../../components/SiteShell'
import { getMediaById, getMediaUrl } from '../../services/pocketbase/media'
import {
  demoHomeContent,
  getPublishedHomeContent,
  type HomePageContent,
} from '../../services/pocketbase/siteContent'

const programs = [
  {
    className: 'kids',
    symbol: '✦',
    tag: '6–12 años',
    title: 'Kids',
    text: 'Una base sólida con vocabulario, comprensión, juegos guiados y speaking progresivo.',
  },
  {
    className: 'teens',
    symbol: '★',
    tag: '13–17 años',
    title: 'Teens',
    text: 'Refuerzo, confianza al hablar y preparación orientada a objetivos académicos.',
  },
  {
    className: 'university',
    symbol: 'U',
    tag: 'Universidad',
    title: 'Young adults',
    text: 'Inglés para estudios, presentaciones, intercambios, Erasmus y primeros retos profesionales.',
  },
  {
    className: 'adults',
    symbol: '∞',
    tag: 'Adultos',
    title: 'English for life',
    text: 'Inglés práctico para trabajo, viajes, conversación y desarrollo personal.',
  },
  {
    className: 'exams',
    symbol: '✓',
    tag: 'A2 · B1 · B2 · C1',
    title: 'Exámenes',
    text: 'Preparación estructurada por destrezas, simulacros y corrección personalizada.',
  },
]

const steps = [
  ['01', 'Conectamos', 'Conocemos el nivel, los objetivos, el ritmo y lo que necesita cada alumno.'],
  ['02', 'Aprendemos', 'Clases dinámicas, práctica guiada y contenidos pensados para cada etapa.'],
  ['03', 'Practicamos', 'Speaking, listening, writing y vocabulario aplicados a situaciones reales.'],
  ['04', 'Avanzamos', 'Seguimiento, tareas, materiales y progreso visibles también fuera del aula.'],
]

const platformFeatures = [
  ['01', 'Clases', 'Próximas sesiones y acceso directo.'],
  ['02', 'Recursos', 'Materiales, audios, PDFs y vocabulario.'],
  ['03', 'Tareas', 'Entregas y feedback en un mismo espacio.'],
  ['04', 'Progreso', 'Objetivos, evolución y próximos pasos.'],
]

export default function HomePage() {
  const [homeContent, setHomeContent] = useState<HomePageContent>(demoHomeContent)
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadHome() {
      try {
        const content = await getPublishedHomeContent()
        if (!mounted) return
        setHomeContent(content)

        if (content.hero.mediaId) {
          try {
            const media = await getMediaById(content.hero.mediaId)
            if (mounted) setHeroImageUrl(getMediaUrl(media, '1400x1000'))
          } catch {
            if (mounted) setHeroImageUrl(null)
          }
        } else {
          setHeroImageUrl(null)
        }
      } catch {
        // La web pública nunca queda inutilizada si PocketBase no responde.
        // Conservamos el contenido local seguro y evitamos mostrar detalles internos al visitante.
      }
    }

    void loadHome()

    return () => {
      mounted = false
    }
  }, [])

  const hero = homeContent.hero

  return (
    <SiteShell>
      <section className="hero-v3">
        <div className="container hero-grid-v3">
          <div className="hero-copy">
            <span className="eyebrow">{hero.eyebrow}</span>
            <h1>
              Inglés para cada etapa de tu
              <span className="hero-accent">vida.</span>
            </h1>
            <p className="hero-lead">{hero.subtitle}</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#programas">{hero.primaryCta}</a>
              <Link className="button button-ghost" to="/acceso">{hero.secondaryCta}</Link>
            </div>
            <div className="trust-row">
              <span>Grupos reducidos</span>
              <span>Seguimiento personal</span>
              <span>Clases + espacio digital</span>
            </div>
          </div>

          <div
            className={`hero-stage${heroImageUrl ? ' has-photo' : ''}`}
            aria-label="Language School: aprendizaje para distintas etapas"
            style={heroImageUrl ? {
              backgroundImage: `linear-gradient(100deg, rgba(63,35,48,.10), rgba(63,35,48,.02)), url(${heroImageUrl})`,
            } : undefined}
          >
            <div className="hero-person-silhouette" aria-hidden="true" />
            <div className="hero-stage-copy">
              <strong>Tu camino. Tu ritmo.</strong>
              <span>Niños, adolescentes, universidad, adultos y preparación de exámenes.</span>
            </div>
            <div className="hero-float-stack" aria-hidden="true">
              <article className="hero-float-card">
                <span className="hero-float-icon">01</span>
                <div><strong>Clases cercanas</strong><span>Atención personal y objetivos claros.</span></div>
              </article>
              <article className="hero-float-card">
                <span className="hero-float-icon">02</span>
                <div><strong>Tu progreso</strong><span>Material, tareas y seguimiento siempre disponibles.</span></div>
              </article>
              <article className="hero-float-card">
                <span className="hero-float-icon">03</span>
                <div><strong>Tu siguiente paso</strong><span>Una ruta distinta para cada etapa.</span></div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="programs-premium" id="programas">
        <div className="container">
          <div className="section-heading">
            <span className="eyebrow">PROGRAMAS PARA TODAS LAS ETAPAS</span>
            <h2>Encuentra tu camino en inglés.</h2>
            <p>Una misma academia, distintas necesidades. El programa cambia contigo: colegio, instituto, universidad, vida adulta o certificación.</p>
          </div>
          <div className="program-grid-premium">
            {programs.map((program) => (
              <article className={`program-card-premium ${program.className}`} key={program.title}>
                <span className="program-symbol">{program.symbol}</span>
                <span className="pill">{program.tag}</span>
                <h3>{program.title}</h3>
                <p>{program.text}</p>
                <Link to="/programas">Ver programa →</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="method-premium">
        <div className="container method-premium-grid">
          <div className="method-premium-intro">
            <span className="eyebrow">NUESTRO MÉTODO</span>
            <h2>Un método pensado para que <em>realmente</em> aprendas.</h2>
            <p>Conversación, objetivos claros y continuidad entre clases. Lo importante no es acumular teoría: es notar que cada semana entiendes, hablas y avanzas un poco más.</p>
            <Link className="button button-ghost" to="/sobre-nosotros">Conoce nuestro método</Link>
          </div>

          <div className="method-premium-steps">
            {steps.map(([number, title, text]) => (
              <article className="method-premium-step" key={number}>
                <span className="method-number">{number}</span>
                <div className="method-icon" aria-hidden="true">{number === '01' ? '◎' : number === '02' ? '▤' : number === '03' ? '◌' : '↗'}</div>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="platform-premium">
        <div className="container platform-premium-grid">
          <div className="platform-premium-copy">
            <span className="eyebrow">PLATAFORMA DEL ALUMNO</span>
            <h2>Todo tu inglés, <em>en un solo lugar.</em></h2>
            <p>Clases, materiales, tareas y seguimiento continúan disponibles después de salir del aula. El alumno sabe siempre qué tiene, qué viene después y cómo está avanzando.</p>
            <Link className="button button-primary" to="/acceso">Entrar a mi plataforma</Link>

            <div className="platform-mini-features">
              {platformFeatures.map(([number, title, text]) => (
                <div key={title}>
                  <span>{number}</span>
                  <p><strong>{title}</strong>{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="platform-dashboard-wrap" aria-label="Vista conceptual del espacio privado del alumno">
            <div className="platform-dashboard-glow" />
            <div className="platform-dashboard-card">
              <aside className="platform-dashboard-nav" aria-hidden="true">
                <div className="platform-dashboard-brand">LS</div>
                {['Inicio', 'Clases', 'Tareas', 'Recursos', 'Progreso', 'Mensajes'].map((item, index) => (
                  <span className={index === 0 ? 'active' : ''} key={item}>{item}</span>
                ))}
              </aside>

              <div className="platform-dashboard-main">
                <div className="platform-dashboard-top">
                  <div><small>GOOD AFTERNOON</small><strong>Hola, Marta 👋</strong></div>
                  <span className="platform-avatar">MR</span>
                </div>

                <div className="platform-dashboard-metrics">
                  <article className="platform-class-card">
                    <small>PRÓXIMA CLASE</small>
                    <strong>Speaking Club · B1</strong>
                    <span>Miércoles · 18:00</span>
                    <span className="platform-class-action">Entrar a clase</span>
                  </article>
                  <article className="platform-progress-card">
                    <small>TU PROGRESO</small>
                    <div className="platform-progress-ring"><strong>72%</strong></div>
                    <span>¡Vas por buen camino!</span>
                  </article>
                </div>

                <div className="platform-dashboard-list">
                  <small>CONTINUAR APRENDIENDO</small>
                  <div><span>Vocabulary · Travel & experiences</span><strong>80%</strong></div>
                  <div><span>Listening practice</span><strong>60%</strong></div>
                </div>
              </div>
            </div>

            <div className="platform-floating-feature feature-listening"><span>♫</span><strong>Listening</strong></div>
            <div className="platform-floating-feature feature-tasks"><span>✓</span><strong>Tareas</strong></div>
            <div className="platform-floating-feature feature-progress"><span>↗</span><strong>Progreso</strong></div>
          </div>
        </div>
      </section>

      <section className="blog-premium">
        <div className="container">
          <div className="blog-premium-heading">
            <div>
              <span className="eyebrow">ENGLISH JOURNAL</span>
              <h2>Ideas que puedes llevarte <em>hoy</em> a clase.</h2>
            </div>
            <div className="blog-premium-heading-side">
              <p>Speaking, vocabulario, exámenes y pequeños hábitos para seguir aprendiendo también fuera del aula.</p>
              <Link className="text-link" to="/blog">Explorar el blog →</Link>
            </div>
          </div>

          <div className="blog-premium-grid">
            <article className="blog-featured-card">
              <div className="blog-visual blog-visual-speaking" aria-hidden="true">
                <span className="blog-visual-word">SPEAK</span>
                <span className="blog-visual-number">01</span>
                <span className="blog-visual-orbit" />
              </div>
              <div className="blog-featured-copy">
                <div className="blog-meta"><span>Speaking</span><small>5 min</small></div>
                <h3>5 formas de ganar confianza al hablar inglés</h3>
                <p>Pequeños hábitos para dejar de traducir mentalmente cada frase y empezar a comunicarte con más naturalidad.</p>
                <Link to="/blog">Leer artículo <span aria-hidden="true">↗</span></Link>
              </div>
            </article>

            <div className="blog-secondary-stack">
              <article className="blog-secondary-card vocabulary">
                <div className="blog-secondary-index">02</div>
                <div className="blog-meta"><span>Vocabulary</span><small>4 min</small></div>
                <h3>Cómo aprender vocabulario sin memorizar listas infinitas</h3>
                <p>Contexto, repetición y uso real: una forma más natural de hacer que las palabras se queden.</p>
                <Link to="/blog" aria-label="Leer artículo sobre vocabulario">Leer →</Link>
              </article>

              <article className="blog-secondary-card exams">
                <div className="blog-secondary-index">03</div>
                <div className="blog-meta"><span>Exams</span><small>6 min</small></div>
                <h3>B1: qué debes dominar antes de empezar simulacros</h3>
                <p>Una guía sencilla para comprobar tu base y preparar el examen con una ruta más clara.</p>
                <Link to="/blog" aria-label="Leer artículo sobre exámenes">Leer →</Link>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="home-final-cta" id="contacto">
        <div className="home-final-orb home-final-orb-one" aria-hidden="true" />
        <div className="home-final-orb home-final-orb-two" aria-hidden="true" />
        <div className="container home-final-cta-inner">
          <div className="home-final-kicker">
            <span>Kids</span><i>·</i><span>Teens</span><i>·</i><span>Universidad</span><i>·</i><span>Adultos</span><i>·</i><span>Exámenes</span>
          </div>
          <span className="eyebrow">TU SIGUIENTE PASO</span>
          <h2>Tu inglés puede empezar <em>aquí.</em></h2>
          <p>Cuéntanos tu edad, nivel u objetivo. Te ayudamos a encontrar el programa y el ritmo que mejor encajan contigo.</p>
          <div className="home-final-actions">
            <Link className="button button-primary" to="/contacto">Cuéntanos qué necesitas</Link>
            <Link className="button button-ghost" to="/programas">Ver todos los programas</Link>
          </div>
          <small>Language School · Rocío Ruiz · inglés para cada etapa</small>
        </div>
      </section>
    </SiteShell>
  )
}
