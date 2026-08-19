import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import BackendStatusBanner from './BackendStatusBanner'
import CookieConsentBanner from './CookieConsentBanner'
import PublicVisualMotion from './PublicVisualMotion'
import PublicWhatsAppButton from './PublicWhatsAppButton'
import { useBackendHealth } from '../hooks/useBackendHealth'
import { requestCookieSettings } from '../services/cookieConsent'
import { demoSiteSettings } from '../services/pocketbase/siteManagement'
import { getPublicSettings, type PublicSettings } from '../services/pocketbase/publicAcademy'

type SiteShellProps = { children: ReactNode }
type PageMeta = { title: string; description: string }

const publicMeta: Record<string, PageMeta> = {
  '/': { title: 'Language School · Inglés con confianza', description: 'Academia de idiomas con clases presenciales y online, programas por objetivos y espacio privado para cada alumno.' },
  '/programas': { title: 'Programas · Language School', description: 'Programas de idiomas para niños, adolescentes, adultos y preparación de exámenes.' },
  '/test-de-nivel': { title: 'Test de nivel de inglés · Language School', description: 'Haz un test breve de inglés sin registro y obtén una estimación orientativa de tu nivel MCER de A1 a C2.' },
  '/profesores': { title: 'Profesores · Language School', description: 'Conoce al equipo docente y su enfoque para acompañar el aprendizaje de idiomas.' },
  '/sobre-nosotros': { title: 'Sobre nosotros · Language School', description: 'Conoce la metodología, los valores y la forma de acompañar a los alumnos en Language School.' },
  '/tarifas': { title: 'Tarifas · Language School', description: 'Consulta los planes y tarifas publicados por Language School.' },
  '/blog': { title: 'Blog · Language School', description: 'Consejos, gramática, vocabulario, listening, exámenes y recursos para seguir mejorando tu inglés.' },
  '/contacto': { title: 'Contacto · Language School', description: 'Contacta con Language School y cuéntanos qué quieres conseguir con tu inglés.' },
  '/cookies': { title: 'Política de cookies · Language School', description: 'Consulta y configura el uso de cookies y tecnologías similares en Language School.' },
  '/privacidad': { title: 'Política de privacidad · Language School', description: 'Información sobre privacidad y tratamiento de datos en Language School.' },
  '/aviso-legal': { title: 'Aviso legal · Language School', description: 'Información legal y condiciones de uso de Language School.' },
}

function applyPageMeta(pathname: string) {
  const meta = publicMeta[pathname] ?? { title: 'Página no encontrada · Language School', description: 'La página solicitada no está disponible. Vuelve a Language School para seguir navegando.' }
  document.title = meta.title
  let description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
  if (!description) {
    description = document.createElement('meta')
    description.name = 'description'
    document.head.appendChild(description)
  }
  description.content = meta.description
}

export default function SiteShell({ children }: SiteShellProps) {
  const location = useLocation()
  const { unavailable, retry } = useBackendHealth()
  const [settings, setSettings] = useState<PublicSettings>({ ...demoSiteSettings, logoUrl: '' })
  const [navOpen, setNavOpen] = useState(false)
  const [isCompactNav, setIsCompactNav] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const navPanelRef = useRef<HTMLElement>(null)

  useEffect(() => { applyPageMeta(location.pathname) }, [location.pathname])
  useEffect(() => {
    let mounted = true
    getPublicSettings().then((value) => { if (mounted) setSettings(value) }).catch(() => undefined)
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1100px)')
    const sync = () => {
      setIsCompactNav(media.matches)
      if (!media.matches) setNavOpen(false)
    }
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!navOpen || !isCompactNav) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusTimer = window.setTimeout(() => {
      navPanelRef.current?.querySelector<HTMLElement>('.nav-links a')?.focus()
    }, 0)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setNavOpen(false)
        window.setTimeout(() => menuButtonRef.current?.focus(), 0)
        return
      }

      if (event.key !== 'Tab') return
      const focusable = Array.from(
        navPanelRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [],
      ).filter((element) => element.offsetParent !== null)
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [navOpen, isCompactNav])

  const brandName = settings.academyName || 'Language School'
  const isHome = location.pathname === '/'
  const isPrograms = location.pathname === '/programas'
  const shellClassName = ['site-shell', 'public-premium-v2', isHome ? 'home-premium-v2' : '', isPrograms ? 'programs-premium-v2' : ''].filter(Boolean).join(' ')
  const resolvedLogoUrl = settings.logoUrl || `${import.meta.env.BASE_URL}brand/language-school-rocio-ruiz-logo.svg`
  const compactTabIndex = isCompactNav && !navOpen ? -1 : undefined
  const closeNavigation = () => setNavOpen(false)

  return (
    <div className={shellClassName}>
      <PublicVisualMotion />
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
      <BackendStatusBanner visible={unavailable} onRetry={() => void retry()} />

      <div className="academy-topbar" aria-label="Información rápida de la academia">
        <div className="container academy-topbar-inner">
          <span className="academy-topbar-confidence"><i aria-hidden="true">●</i>{brandName} · English with confidence</span>
          <div className="academy-topbar-contact">
            {settings.phone && <a href={`tel:${settings.phone}`}>{settings.phone}</a>}
            {settings.email && <a href={`mailto:${settings.email}`}>{settings.email}</a>}
          </div>
        </div>
      </div>

      <header className="site-header">
        <div className="container header-inner">
          <Link className="brand" to="/" aria-label={`${brandName} - Inicio`}>
            <img className="brand-logo-image" src={resolvedLogoUrl} alt="" />
            <span className="brand-copy"><strong>{brandName}</strong><small>Academia de inglés</small></span>
          </Link>

          <button
            ref={menuButtonRef}
            className="nav-toggle"
            type="button"
            aria-label={navOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={navOpen}
            aria-controls="public-main-navigation"
            onClick={() => setNavOpen((open) => !open)}
          >
            <span className="nav-toggle-lines" aria-hidden="true"><i /><i /></span>
            <span>{navOpen ? 'Cerrar' : 'Menú'}</span>
          </button>

          <nav
            ref={navPanelRef}
            id="public-main-navigation"
            className={`main-nav${navOpen ? ' is-open' : ''}`}
            aria-label="Navegación principal"
            aria-hidden={isCompactNav && !navOpen ? true : undefined}
          >
            <div className="nav-panel-head">
              <div><small>LANGUAGE SCHOOL</small><strong>Explora la academia</strong></div>
              <button className="nav-panel-close" type="button" onClick={() => setNavOpen(false)} aria-label="Cerrar menú">×</button>
            </div>
            <div className="nav-links">
              <NavLink to="/" end tabIndex={compactTabIndex} onClick={closeNavigation}>Inicio</NavLink>
              <NavLink to="/programas" tabIndex={compactTabIndex} onClick={closeNavigation}>Programas</NavLink>
              <NavLink to="/profesores" tabIndex={compactTabIndex} onClick={closeNavigation}>Profesores</NavLink>
              <NavLink to="/sobre-nosotros" tabIndex={compactTabIndex} onClick={closeNavigation}>Sobre nosotros</NavLink>
              <NavLink to="/tarifas" tabIndex={compactTabIndex} onClick={closeNavigation}>Tarifas</NavLink>
              <NavLink to="/blog" tabIndex={compactTabIndex} onClick={closeNavigation}>Blog</NavLink>
              <NavLink to="/contacto" tabIndex={compactTabIndex} onClick={closeNavigation}>Contacto</NavLink>
            </div>
            <div className="nav-mobile-meta">
              <Link className="button button-primary" to="/acceso" tabIndex={compactTabIndex} onClick={closeNavigation}>Área alumnos</Link>
              {(settings.phone || settings.email) && (
                <div className="nav-mobile-contact">
                  {settings.phone && <a tabIndex={compactTabIndex} href={`tel:${settings.phone}`}>{settings.phone}</a>}
                  {settings.email && <a tabIndex={compactTabIndex} href={`mailto:${settings.email}`}>{settings.email}</a>}
                </div>
              )}
            </div>
          </nav>

          <Link className="button button-small button-outline header-access" to="/acceso">Área alumnos</Link>
          {isCompactNav && navOpen && <button className="nav-backdrop" type="button" tabIndex={-1} aria-label="Cerrar menú" onClick={() => setNavOpen(false)} />}
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>{children}</main>

      <footer className="site-footer">
        <div className="container footer-grid">
          <div className="footer-brand-column">
            <div className="brand brand-footer"><img className="brand-logo-image" src={resolvedLogoUrl} alt="" /><span><strong>{brandName}</strong><small>English with confidence</small></span></div>
            <p>Una academia cercana para aprender, practicar y avanzar con un objetivo claro.</p>
          </div>
          <div className="footer-nav-column">
            <strong>Explora</strong>
            <Link to="/programas">Programas</Link>
            <Link to="/test-de-nivel">Test de nivel</Link>
            <Link to="/profesores">Profesores</Link>
            <Link to="/sobre-nosotros">Sobre nosotros</Link>
            <Link to="/tarifas">Tarifas</Link>
            <Link to="/blog">Journal</Link>
          </div>
          <div className="footer-contact-column">
            <strong>Contacto</strong>
            {settings.address && <span>{settings.address}</span>}
            {settings.email && <a href={`mailto:${settings.email}`}>{settings.email}</a>}
            {settings.phone && <a href={`tel:${settings.phone}`}>{settings.phone}</a>}
            <Link to="/contacto">Hablar con la academia</Link>
            {settings.instagram && <a href={settings.instagram} target="_blank" rel="noreferrer">Instagram ↗</a>}
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} {brandName}</span>
          <div className="footer-privacy-links">
            <Link to="/aviso-legal">Aviso legal</Link>
            <Link to="/privacidad">Privacidad</Link>
            <Link to="/cookies">Cookies</Link>
            {settings.cookieBannerEnabled && <button className="footer-cookie-settings" type="button" onClick={requestCookieSettings}>Configurar cookies</button>}
            <Link to="/acceso">Área alumnos</Link>
          </div>
        </div>
      </footer>

      <CookieConsentBanner enabled={settings.cookieBannerEnabled} intro={settings.cookieIntro} />
      <PublicWhatsAppButton enabled={settings.whatsappEnabled} phone={settings.whatsapp} message={settings.whatsappMessage} academyName={brandName} />
    </div>
  )
}
