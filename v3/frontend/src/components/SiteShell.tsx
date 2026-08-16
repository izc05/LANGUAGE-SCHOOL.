import { type ReactNode, useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import BackendStatusBanner from './BackendStatusBanner'
import PublicVisualMotion from './PublicVisualMotion'
import { useBackendHealth } from '../hooks/useBackendHealth'
import { demoSiteSettings } from '../services/pocketbase/siteManagement'
import { getPublicSettings, type PublicSettings } from '../services/pocketbase/publicAcademy'

type SiteShellProps = { children: ReactNode }
type PageMeta = { title: string; description: string }

const publicMeta: Record<string, PageMeta> = {
  '/': { title: 'Language School · Inglés con confianza', description: 'Academia de idiomas con clases presenciales y online, programas por objetivos y espacio privado para cada alumno.' },
  '/programas': { title: 'Programas · Language School', description: 'Programas de idiomas para niños, adolescentes, adultos y preparación de exámenes.' },
  '/profesores': { title: 'Profesores · Language School', description: 'Conoce al equipo docente y su enfoque para acompañar el aprendizaje de idiomas.' },
  '/sobre-nosotros': { title: 'Sobre nosotros · Language School', description: 'Conoce la metodología, los valores y la forma de acompañar a los alumnos en Language School.' },
  '/tarifas': { title: 'Tarifas · Language School', description: 'Consulta los planes y tarifas publicados por Language School.' },
  '/blog': { title: 'Blog · Language School', description: 'Consejos, gramática, vocabulario, listening, exámenes y recursos para seguir mejorando tu inglés.' },
  '/contacto': { title: 'Contacto · Language School', description: 'Contacta con Language School y cuéntanos qué quieres conseguir con tu inglés.' },
}

const audienceLabels = ['Kids', 'Teens', 'Universidad', 'Adultos', 'Exámenes']

function applyPageMeta(pathname: string) {
  const meta = publicMeta[pathname] ?? { title: 'Página no encontrada · Language School', description: 'La página solicitada no está disponible. Vuelve a Language School para seguir navegando.' }
  document.title = meta.title
  let description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
  if (!description) { description = document.createElement('meta'); description.name = 'description'; document.head.appendChild(description) }
  description.content = meta.description
}

export default function SiteShell({ children }: SiteShellProps) {
  const location = useLocation()
  const { unavailable, retry } = useBackendHealth()
  const [settings, setSettings] = useState<PublicSettings>({ ...demoSiteSettings, logoUrl: '' })

  useEffect(() => { applyPageMeta(location.pathname) }, [location.pathname])
  useEffect(() => {
    let mounted = true
    getPublicSettings().then((value) => { if (mounted) setSettings(value) }).catch(() => undefined)
    return () => { mounted = false }
  }, [])

  const brandName = settings.academyName || 'Language School'
  const isHome = location.pathname === '/'
  const isPrograms = location.pathname === '/programas'
  const shellClassName = ['site-shell', 'public-premium-v2', isHome ? 'home-premium-v2' : '', isPrograms ? 'programs-premium-v2' : ''].filter(Boolean).join(' ')
  const resolvedLogoUrl = settings.logoUrl || `${import.meta.env.BASE_URL}brand/language-school-rocio-ruiz-logo.svg`

  return (
    <div className={shellClassName}>
      <PublicVisualMotion />
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
      <BackendStatusBanner visible={unavailable} onRetry={() => void retry()} />

      <div className="academy-topbar" aria-label="Información rápida de la academia">
        <div className="container academy-topbar-inner">
          <span className="academy-topbar-confidence"><i aria-hidden="true">♥</i> English with confidence</span>
          <div className="academy-topbar-audience" aria-label="Etapas disponibles">
            {audienceLabels.map((label, index) => <span key={label}>{index > 0 && <i aria-hidden="true">·</i>}{label}</span>)}
          </div>
          <div className="academy-topbar-contact">
            {settings.phone && <a href={`tel:${settings.phone}`}>☎ {settings.phone}</a>}
            {settings.email && <a href={`mailto:${settings.email}`}>✉ {settings.email}</a>}
          </div>
        </div>
      </div>

      <header className="site-header">
        <div className="container header-inner">
          <Link className="brand" to="/" aria-label={`${brandName} - Inicio`}>
            <img className="brand-logo-image" src={resolvedLogoUrl} alt="" />
            <span className="brand-copy"><strong>{brandName}</strong><small>English with confidence</small></span>
          </Link>
          <nav className="main-nav" aria-label="Navegación principal">
            <NavLink to="/">Inicio</NavLink><NavLink to="/programas">Programas</NavLink><NavLink to="/profesores">Profesores</NavLink><NavLink to="/sobre-nosotros">Sobre nosotros</NavLink><NavLink to="/tarifas">Tarifas</NavLink><NavLink to="/blog">Blog</NavLink><NavLink to="/contacto">Contacto</NavLink>
          </nav>
          <Link className="button button-small button-outline" to="/acceso">Área alumnos</Link>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>{children}</main>
      <footer className="site-footer">
        <div className="container footer-audience-ribbon">
          <div><span className="eyebrow">INGLÉS PARA CADA ETAPA</span><strong>Un mismo lugar. Distintos caminos.</strong></div>
          <div className="footer-audience-list">{audienceLabels.map((label) => <span key={label}>{label}</span>)}</div>
          <Link to="/programas">Ver programas <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="container footer-grid">
          <div><div className="brand brand-footer"><img className="brand-logo-image" src={resolvedLogoUrl} alt="" /><span><strong>{brandName}</strong></span></div><p>Aprender inglés con seguimiento real, recursos claros y un espacio digital propio para cada alumno.</p></div>
          <div><strong>Academia</strong><Link to="/programas">Programas</Link><Link to="/profesores">Profesores</Link><Link to="/sobre-nosotros">Sobre nosotros</Link><Link to="/tarifas">Tarifas</Link><Link to="/blog">Blog</Link><Link to="/acceso">Acceso</Link></div>
          <div><strong>Contacto</strong>{settings.address && <span>{settings.address}</span>}{settings.email && <a href={`mailto:${settings.email}`}>{settings.email}</a>}{settings.phone && <a href={`tel:${settings.phone}`}>{settings.phone}</a>}<Link to="/contacto">Formulario de contacto</Link>{settings.instagram && <a href={settings.instagram} target="_blank" rel="noreferrer">Instagram ↗</a>}</div>
        </div>
        <div className="container footer-bottom">© {new Date().getFullYear()} {brandName}</div>
      </footer>
    </div>
  )
}
