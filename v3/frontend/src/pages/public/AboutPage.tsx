import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import SiteShell from '../../components/SiteShell'
import { demoAboutContent, getPublishedAboutContent, getPublishedHomeVisualUrl, type AboutPageContent } from '../../services/pocketbase/siteContent'

export default function AboutPage() {
  const [content, setContent] = useState<AboutPageContent>(demoAboutContent)
  const [heroPhoto, setHeroPhoto] = useState('')
  const journeyVisual = `${import.meta.env.BASE_URL}visuals/about-language-journey.svg`
  const continuityVisual = `${import.meta.env.BASE_URL}visuals/about-continuity.svg`

  useEffect(() => {
    let mounted = true
    Promise.all([
      getPublishedAboutContent(),
      getPublishedHomeVisualUrl('aboutHeroMediaId'),
    ]).then(([value, photo]) => {
      if (!mounted) return
      setContent(value)
      setHeroPhoto(photo)
    }).catch(() => undefined)
    return () => { mounted = false }
  }, [])

  return (
    <SiteShell>
      <div className="about-premium-v2">
        <section className="about-v2-hero">
          <div className="container about-v2-hero-grid">
            <div className="about-v2-hero-copy">
              <span className="eyebrow">{content.eyebrow}</span>
              <h1>{content.title}</h1>
              <p>{content.intro}</p>
              <div className="about-v2-hero-tags" aria-label="Cómo trabajamos">
                <span>Clases cercanas</span>
                <span>Práctica real</span>
                <span>Seguimiento</span>
                <span>Espacio digital</span>
              </div>
            </div>
            <div className={`about-v2-visual${heroPhoto ? ' has-cms-photo' : ''}`} style={heroPhoto ? { backgroundImage: `linear-gradient(180deg, rgba(52,24,38,.02), rgba(52,24,38,.18)), url(${heroPhoto})` } : undefined}>
              <img src={journeyVisual} alt="Ilustración del viaje de aprendizaje en Language School" />
              <div className="about-v2-visual-note">
                <small>LANGUAGE SCHOOL</small>
                <strong>Aprender → usar → confiar</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="section about-v2-story-section">
          <div className="container about-v2-story-grid">
            <div className="about-v2-story-heading">
              <span className="eyebrow">NUESTRA FORMA DE ENSEÑAR</span>
              <h2>{content.storyTitle}</h2>
              <div className="about-v2-story-line" aria-hidden="true"><span>01</span><span>02</span><span>03</span></div>
            </div>
            <div className="about-v2-story-copy">
              {content.storyParagraphs.map((paragraph, index) => (
                <div className="about-v2-story-paragraph" key={`${index}-${paragraph.slice(0, 20)}`}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <p>{paragraph}</p>
                </div>
              ))}
              <blockquote>“El objetivo no es saber más inglés sobre el papel. Es poder usarlo con más seguridad.”</blockquote>
            </div>
          </div>
        </section>

        <section className="section about-v2-values-section">
          <div className="container">
            <div className="about-v2-section-head">
              <div>
                <span className="eyebrow">LO QUE CUIDAMOS</span>
                <h2>Tres ideas que atraviesan cada clase.</h2>
              </div>
              <p>La metodología puede cambiar según la edad y el objetivo. La forma de acompañar, no.</p>
            </div>
            <div className="about-v2-values-grid">
              {content.values.map((value, index) => (
                <article className="about-v2-value-card" key={`${value.title}-${index}`}>
                  <span className="about-v2-value-number">{String(index + 1).padStart(2, '0')}</span>
                  <div className="about-v2-value-icon" aria-hidden="true">{index === 0 ? '♡' : index === 1 ? '↗' : '∞'}</div>
                  <h3>{value.title}</h3>
                  <p>{value.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section about-v2-continuity-section">
          <div className="container about-v2-continuity">
            <div className="about-v2-continuity-stage">
              <div className="about-v2-continuity-copy">
                <span className="eyebrow">ANTES · DURANTE · DESPUÉS</span>
                <h2>La clase forma parte de un proceso, no es un momento aislado.</h2>
                <p>Todo empieza con un objetivo concreto, continúa con práctica guiada y se consolida con material, tareas y seguimiento. La experiencia tiene que sentirse conectada de principio a fin.</p>
              </div>
              <div className="about-v2-continuity-visual">
                <img src={continuityVisual} alt="Ilustración editorial del proceso objetivo, práctica y continuidad" />
                <div className="about-v2-continuity-badge">
                  <small>UN MISMO HILO</small>
                  <strong>Objetivo → práctica → progreso</strong>
                </div>
              </div>
            </div>
            <div className="about-v2-continuity-steps">
              <article><span>01</span><strong>Objetivo</strong><p>Sabes qué estás trabajando y para qué.</p></article>
              <article><span>02</span><strong>Práctica</strong><p>Participas, preguntas, corriges y vuelves a intentarlo.</p></article>
              <article><span>03</span><strong>Continuidad</strong><p>Materiales, tareas y avisos siguen contigo en tu espacio privado.</p></article>
            </div>
          </div>
        </section>

        <section className="section about-v2-cta-section">
          <div className="container about-v2-cta">
            <div>
              <span className="eyebrow">EMPEZAMOS POR TU OBJETIVO</span>
              <h2>{content.closingTitle}</h2>
              <p>{content.closingText}</p>
            </div>
            <Link className="button button-primary" to="/contacto">Quiero información</Link>
          </div>
        </section>
      </div>
    </SiteShell>
  )
}
