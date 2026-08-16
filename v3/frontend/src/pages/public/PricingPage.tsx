import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import SiteShell from '../../components/SiteShell'
import { isDemoMode } from '../../config/environment'
import { demoPublicPricing, listPublicPricing, type PublicPricingRecord } from '../../services/pocketbase/publicAcademy'

export default function PricingPage() {
  const [plans, setPlans] = useState<PublicPricingRecord[]>(isDemoMode ? demoPublicPricing : [])
  const [loading, setLoading] = useState(!isDemoMode)
  const pricingVisual = `${import.meta.env.BASE_URL}visuals/pricing-confidence.svg`
  const pricingFitVisual = `${import.meta.env.BASE_URL}visuals/pricing-fit.svg`

  useEffect(() => {
    let mounted = true
    listPublicPricing()
      .then((records) => { if (mounted) setPlans(records) })
      .catch(() => undefined)
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return (
    <SiteShell>
      <div className="pricing-premium-v2">
        <section className="pricing-v2-hero">
          <div className="container pricing-v2-hero-grid">
            <div className="pricing-v2-hero-copy">
              <span className="eyebrow">TARIFAS</span>
              <h1>Precios claros, sin letra pequeña.</h1>
              <p>Consulta las opciones disponibles y contacta con la academia para encontrar la que mejor encaja con tu objetivo.</p>
              <div className="pricing-v2-trust-row">
                <span>Plan según objetivo</span>
                <span>Seguimiento incluido</span>
                <span>Orientación antes de elegir</span>
              </div>
            </div>
            <div className="pricing-v2-hero-visual">
              <img src={pricingVisual} alt="Ilustración de planes de aprendizaje claros y flexibles" />
              <div className="pricing-v2-floating-card"><small>ANTES DE ELEGIR</small><strong>Objetivo · nivel · ritmo</strong></div>
            </div>
          </div>
        </section>

        <section className="section pricing-v2-plans-section">
          <div className="container">
            <div className="pricing-v2-section-head">
              <div><span className="eyebrow">PLANES PUBLICADOS</span><h2>Elige con información, no a ciegas.</h2></div>
              <p>Los precios y condiciones que ves aquí vienen directamente de la configuración de la academia.</p>
            </div>

            {loading && <div className="public-inline-note">Actualizando tarifas…</div>}
            {!loading && plans.length === 0 && <div className="public-empty-state">Todavía no hay tarifas publicadas. Contacta con la academia para recibir información actualizada.</div>}

            <div className="pricing-v2-grid">
              {plans.map((plan, index) => (
                <article className={`pricing-v2-card ${plan.featured ? 'featured' : ''}`} key={plan.id}>
                  <div className="pricing-v2-card-top">
                    <span className="pricing-v2-index">{String(index + 1).padStart(2, '0')}</span>
                    {plan.featured && <span className="pricing-badge">Más elegido</span>}
                  </div>
                  <span className="eyebrow">{plan.name}</span>
                  <div className="pricing-v2-price"><strong>{Number(plan.price).toLocaleString('es-ES', { maximumFractionDigits: 2 })} €</strong><span>{plan.billing_text}</span></div>
                  <p>{plan.description}</p>
                  {plan.features?.length > 0 && <ul>{plan.features.map((feature) => <li key={feature}><span>✓</span>{feature}</li>)}</ul>}
                  <Link className="button button-primary button-full" to={`/contacto?interes=${encodeURIComponent(plan.name)}`}>Quiero información</Link>
                </article>
              ))}
            </div>
            {plans.length > 0 && <p className="public-disclaimer">Las condiciones finales de cada curso se confirman antes de formalizar la matrícula.</p>}
          </div>
        </section>

        <section className="section pricing-v2-fit-section">
          <div className="container pricing-v2-fit">
            <div className="pricing-v2-fit-stage">
              <div className="pricing-v2-fit-copy">
                <span className="eyebrow">EL PLAN ADECUADO</span>
                <h2>No todo depende del precio.</h2>
                <p>Antes de recomendar una opción, miramos tres cosas que cambian por completo la experiencia de aprendizaje.</p>
              </div>
              <div className="pricing-v2-fit-visual">
                <img src={pricingFitVisual} alt="Ilustración editorial de objetivo, nivel y disponibilidad para elegir un plan" />
                <div className="pricing-v2-fit-note">
                  <small>TRES VARIABLES</small>
                  <strong>Objetivo · nivel · disponibilidad</strong>
                </div>
              </div>
            </div>
            <div className="pricing-v2-fit-grid">
              <article><span>01</span><strong>Tu objetivo</strong><p>Conversación, estudios, trabajo, exámenes o una mezcla de varios.</p></article>
              <article><span>02</span><strong>Tu punto de partida</strong><p>El nivel real ayuda a elegir un ritmo exigente sin que resulte frustrante.</p></article>
              <article><span>03</span><strong>Tu disponibilidad</strong><p>La mejor opción también tiene que poder encajar de verdad en tu semana.</p></article>
            </div>
          </div>
        </section>

        <section className="section pricing-v2-faq-section">
          <div className="container pricing-v2-faq">
            <div><span className="eyebrow">ANTES DE MATRICULARTE</span><h2>Preguntas normales antes de decidir.</h2></div>
            <div className="pricing-v2-faq-list">
              <details><summary>¿Cómo sé qué nivel me corresponde?</summary><p>Cuéntanos tu experiencia y objetivo. La academia puede orientarte antes de elegir un programa.</p></details>
              <details><summary>¿El precio publicado es definitivo?</summary><p>La ficha muestra la tarifa configurada. Las condiciones concretas se confirman contigo antes de formalizar la matrícula.</p></details>
              <details><summary>¿Qué ocurre si no veo una opción que encaje?</summary><p>Contacta con la academia. Esta página solo muestra los planes que están publicados en este momento.</p></details>
            </div>
          </div>
        </section>

        <section className="section pricing-v2-cta-section">
          <div className="container pricing-v2-cta">
            <div><span className="eyebrow">¿TIENES DUDAS?</span><h2>Te ayudamos a elegir antes de comprometerte.</h2><p>Cuéntanos para quién es el curso y qué quieres conseguir.</p></div>
            <Link className="button button-primary" to="/contacto">Pedir orientación</Link>
          </div>
        </section>
      </div>
    </SiteShell>
  )
}
