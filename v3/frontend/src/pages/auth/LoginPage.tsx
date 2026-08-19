import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../features/auth/AuthProvider'
import { useCloudPortal } from '../../features/transitions/CloudPortalProvider'
import { useAcademyBrand } from '../../hooks/useAcademyBrand'
import { getLoginErrorMessage } from '../../services/pocketbase/auth'
import type { UserRole } from '../../services/pocketbase/types'

function routeForRole(role: UserRole): string {
  if (role === 'ADMIN') return '/admin'
  if (role === 'TEACHER') return '/profesor'
  return '/alumno'
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { academyName, logoUrl, initials } = useAcademyBrand()
  const { login, isDemoMode, ready, user, isAuthenticated } = useAuth()
  const { isTransitioning, startCloudPortal } = useCloudPortal()
  const loginNavigationRef = useRef(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fallbackLogoUrl = `${import.meta.env.BASE_URL}brand/language-school-rocio-ruiz-logo.svg`
  const portalVisual = `${import.meta.env.BASE_URL}visuals/student-access-portal.svg`

  useEffect(() => {
    if (!isDemoMode && ready && isAuthenticated && user && !loginNavigationRef.current) {
      navigate(routeForRole(user.role), { replace: true })
    }
  }, [isAuthenticated, isDemoMode, navigate, ready, user])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isDemoMode || submitting || isTransitioning) return

    loginNavigationRef.current = true
    setSubmitting(true)
    setError(null)

    try {
      const authenticatedUser = await login(email, password)
      const destination = routeForRole(authenticatedUser.role)

      if (authenticatedUser.role === 'ADMIN') {
        navigate(destination, { replace: true })
        return
      }

      const started = await startCloudPortal(() => navigate(destination, { replace: true }))
      if (!started) navigate(destination, { replace: true })
    } catch (loginError) {
      loginNavigationRef.current = false
      setError(getLoginErrorMessage(loginError))
    } finally {
      setSubmitting(false)
    }
  }

  const interactionLocked = isDemoMode || submitting || isTransitioning || !ready

  return (
    <div className="auth-page auth-premium-v2">
      <section className="auth-brand-panel">
        <Link className="brand brand-light" to="/" aria-label={`${academyName} - Inicio`}>
          <img className="brand-logo-image" src={logoUrl || fallbackLogoUrl} alt="" />
          <span><strong>{academyName}</strong><small>English with confidence</small></span>
        </Link>

        <div className="auth-brand-copy">
          <span className="eyebrow eyebrow-light">TU ESPACIO</span>
          <h1>La clase continúa aquí.</h1>
          <p>Accede a tus materiales, tareas, próximas clases y archivos privados desde un único lugar.</p>
          <div className="auth-feature-list">
            <span>Material organizado por alumno</span>
            <span>Tareas y entregas</span>
            <span>Calendario de clases</span>
            <span>Archivos privados</span>
          </div>
        </div>

        <div className="auth-premium-visual" aria-hidden="true">
          <img src={portalVisual} alt="" />
          <div className="auth-premium-status"><small>YOUR ENGLISH SPACE</small><strong>Todo tu aprendizaje, conectado.</strong></div>
        </div>

        <small className="auth-note">
          {isDemoMode ? 'Vista de demostración para revisar la plataforma.' : 'Acceso seguro a tu espacio privado.'}
        </small>
      </section>

      <section className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-card-brand">
            <span className="auth-card-brand-mark">{initials}</span>
            <span>ÁREA PRIVADA</span>
          </div>
          <span className="eyebrow">ACCESO A LA PLATAFORMA</span>
          <h2>Bienvenido de nuevo.</h2>
          <p className="muted">
            {isDemoMode
              ? 'Puedes recorrer las distintas vistas de la plataforma en modo demostración.'
              : 'Introduce tu email y contraseña para acceder a tu espacio.'}
          </p>

          {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

          <form onSubmit={handleSubmit}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="nombre@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={interactionLocked}
              required
            />
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={interactionLocked}
              required
            />
            <button className="button button-primary button-full" type="submit" disabled={interactionLocked}>
              {!ready && !isDemoMode ? 'Comprobando sesión…' : submitting || isTransitioning ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          {isDemoMode && (
            <>
              <div className="demo-divider"><span>Vistas de desarrollo</span></div>
              <div className="demo-links">
                <Link to="/alumno">Demo alumno</Link>
                <Link to="/profesor">Demo profesor</Link>
                <Link to="/admin">Demo administrador</Link>
              </div>
            </>
          )}

          <Link className="back-link" to="/">← Volver a {academyName}</Link>
        </div>
      </section>
    </div>
  )
}
