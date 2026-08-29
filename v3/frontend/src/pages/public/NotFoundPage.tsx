import { Link } from 'react-router'
import SiteShell from '../../components/SiteShell'

export default function NotFoundPage() {
  return (
    <SiteShell>
      <section className="public-not-found">
        <div className="container public-not-found-inner">
          <span className="not-found-code">404</span>
          <span className="eyebrow">PÁGINA NO ENCONTRADA</span>
          <h1>Esta página no está disponible.</h1>
          <p>Puede que el enlace haya cambiado o que la dirección no sea correcta. Puedes volver al inicio o consultar nuestros programas.</p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/">Volver al inicio</Link>
            <Link className="button button-ghost" to="/programas">Ver programas</Link>
          </div>
        </div>
      </section>
    </SiteShell>
  )
}
