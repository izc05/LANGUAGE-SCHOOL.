import { type ReactNode, useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router'
import { demoSiteSettings } from '../services/pocketbase/siteManagement'
import { getPublicSettings, type PublicSettings } from '../services/pocketbase/publicAcademy'

type SiteShellProps = {
  children: ReactNode
}

export default function SiteShell({ children }: SiteShellProps) {
  const [settings, setSettings] = useState<PublicSettings>({ ...demoSiteSettings, logoUrl: '' })

  useEffect(() => {
    let mounted = true
    getPublicSettings().then((value) => { if (mounted) setSettings(value) }).catch(() => undefined)
    return () => { mounted = false }
  }, [])

  const brandName = settings.academyName || 'Language School'

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="container header-inner">
          <Link className="brand" to="/" aria-label={`${brandName} - Inicio`}>
            {settings.logoUrl
              ? <img className="brand-logo-image" src={settings.logoUrl} alt="" />
              : <span className="brand-mark">LS</span>}
            <span>
              <strong>{brandName}</strong>
              <small>English with confidence</small>
            </span>
          </Link>

          <nav className="main-nav" aria-label="Navegación principal">
            <NavLink to="/">Inicio</NavLink>
            <NavLink to="/programas">Programas</NavLink>
            <NavLink to="/profesores">Profesores</NavLink>
            <NavLink to="/tarifas">Tarifas</NavLink>
            <NavLink to="/blog">Blog</NavLink>
            <NavLink to="/contacto">Contacto</NavLink>
          </nav>

          <Link className="button button-small button-outline" to="/acceso">
            Área alumnos
          </Link>
        </div>
      </header>

      <main>{children}</main>

      <footer className="site-footer">
        <div className="container footer-grid">
          <div>
            <div className="brand brand-footer">
              {settings.logoUrl
                ? <img className="brand-logo-image" src={settings.logoUrl} alt="" />
                : <span className="brand-mark">LS</span>}
              <span><strong>{brandName}</strong></span>
            </div>
            <p>Aprender inglés con seguimiento real, recursos claros y un espacio digital propio para cada alumno.</p>
          </div>
          <div>
            <strong>Academia</strong>
            <Link to="/programas">Programas</Link>
            <Link to="/profesores">Profesores</Link>
            <Link to="/tarifas">Tarifas</Link>
            <Link to="/blog">Blog</Link>
            <Link to="/acceso">Acceso</Link>
          </div>
          <div>
            <strong>Contacto</strong>
            {settings.address && <span>{settings.address}</span>}
            {settings.email && <a href={`mailto:${settings.email}`}>{settings.email}</a>}
            {settings.phone && <a href={`tel:${settings.phone}`}>{settings.phone}</a>}
            <Link to="/contacto">Formulario de contacto</Link>
            {settings.instagram && <a href={settings.instagram} target="_blank" rel="noreferrer">Instagram ↗</a>}
          </div>
        </div>
        <div className="container footer-bottom">© {new Date().getFullYear()} {brandName}</div>
      </footer>
    </div>
  )
}
