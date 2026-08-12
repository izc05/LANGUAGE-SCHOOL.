import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router'

type SiteShellProps = {
  children: ReactNode
}

export default function SiteShell({ children }: SiteShellProps) {
  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="container header-inner">
          <Link className="brand" to="/" aria-label="Language School - Inicio">
            <span className="brand-mark">LS</span>
            <span>
              <strong>Language School</strong>
              <small>English with confidence</small>
            </span>
          </Link>

          <nav className="main-nav" aria-label="Navegación principal">
            <NavLink to="/">Inicio</NavLink>
            <a href="/#programas">Programas</a>
            <NavLink to="/blog">Blog</NavLink>
            <a href="/#contacto">Contacto</a>
          </nav>

          <Link className="button button-small button-outline" to="/acceso">
            Área alumnos
          </Link>
        </div>
      </header>

      <main>{children}</main>

      <footer className="site-footer" id="contacto">
        <div className="container footer-grid">
          <div>
            <div className="brand brand-footer">
              <span className="brand-mark">LS</span>
              <span><strong>Language School</strong></span>
            </div>
            <p>Aprender inglés con seguimiento real, recursos claros y un espacio digital propio para cada alumno.</p>
          </div>
          <div>
            <strong>Academia</strong>
            <a href="/#programas">Programas</a>
            <Link to="/blog">Blog</Link>
            <Link to="/acceso">Acceso</Link>
          </div>
          <div>
            <strong>Contacto</strong>
            <span>Jódar · Jaén</span>
            <span>Horario y datos definitivos pendientes</span>
          </div>
        </div>
        <div className="container footer-bottom">© {new Date().getFullYear()} Language School</div>
      </footer>
    </div>
  )
}
