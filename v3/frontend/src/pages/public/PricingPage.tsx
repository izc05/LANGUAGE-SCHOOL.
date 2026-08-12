import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import SiteShell from '../../components/SiteShell'
import { demoPublicPricing, listPublicPricing, type PublicPricingRecord } from '../../services/pocketbase/publicAcademy'

export default function PricingPage() {
  const [plans, setPlans] = useState<PublicPricingRecord[]>(demoPublicPricing)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    listPublicPricing()
      .then((records) => { if (mounted && records.length > 0) setPlans(records) })
      .catch(() => undefined)
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return (
    <SiteShell>
      <section className="public-page-hero">
        <div className="container public-page-hero-inner">
          <span className="eyebrow">TARIFAS</span>
          <h1>Precios claros, sin letra pequeña.</h1>
          <p>Las tarifas publicadas aquí se gestionan desde el panel ADMIN y se actualizan sin tocar el código.</p>
        </div>
      </section>

      <section className="section section-soft">
        <div className="container">
          {loading && <div className="public-inline-note">Actualizando tarifas…</div>}
          <div className="public-pricing-grid">
            {plans.map((plan) => (
              <article className={`public-pricing-card ${plan.featured ? 'featured' : ''}`} key={plan.id}>
                {plan.featured && <span className="pricing-badge">Más elegido</span>}
                <span className="eyebrow">{plan.name}</span>
                <div className="public-price"><strong>{Number(plan.price).toLocaleString('es-ES', { maximumFractionDigits: 2 })} €</strong><span>{plan.billing_text}</span></div>
                <p>{plan.description}</p>
                {plan.features?.length > 0 && <ul>{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>}
                <Link className="button button-primary button-full" to={`/contacto?interes=${encodeURIComponent(plan.name)}`}>Quiero información</Link>
              </article>
            ))}
          </div>
          <p className="public-disclaimer">Las condiciones finales de cada curso se confirman antes de formalizar la matrícula.</p>
        </div>
      </section>
    </SiteShell>
  )
}
