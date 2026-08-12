import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import SiteShell from '../../components/SiteShell'
import { demoAboutContent, getPublishedAboutContent, type AboutPageContent } from '../../services/pocketbase/siteContent'

export default function AboutPage() {
  const [content, setContent] = useState<AboutPageContent>(demoAboutContent)

  useEffect(() => {
    let mounted = true
    getPublishedAboutContent().then((value) => { if (mounted) setContent(value) }).catch(() => undefined)
    return () => { mounted = false }
  }, [])

  return (
    <SiteShell>
      <section className="public-page-hero about-hero">
        <div className="container public-page-hero-inner">
          <span className="eyebrow">{content.eyebrow}</span>
          <h1>{content.title}</h1>
          <p>{content.intro}</p>
        </div>
      </section>

      <section className="section section-soft">
        <div className="container about-story-grid">
          <div className="about-story-heading">
            <span className="eyebrow">NUESTRA FORMA DE ENSEÑAR</span>
            <h2>{content.storyTitle}</h2>
          </div>
          <div className="about-story-copy">
            {content.storyParagraphs.map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 20)}`}>{paragraph}</p>)}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="about-values-grid">
            {content.values.map((value, index) => (
              <article className="about-value-card" key={`${value.title}-${index}`}>
                <span className="program-number">{String(index + 1).padStart(2, '0')}</span>
                <h3>{value.title}</h3>
                <p>{value.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-soft">
        <div className="container cta-panel public-cta-panel">
          <div>
            <span className="eyebrow">EMPEZAMOS POR TU OBJETIVO</span>
            <h2>{content.closingTitle}</h2>
            <p>{content.closingText}</p>
          </div>
          <Link className="button button-primary" to="/contacto">Quiero información</Link>
        </div>
      </section>
    </SiteShell>
  )
}
