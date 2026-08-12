import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../features/auth/AuthProvider'
import { getLoginErrorMessage } from '../../services/pocketbase/auth'
import type { UserRole } from '../../services/pocketbase/types'

function routeForRole(role: UserRole): string {
  if (role === 'ADMIN') return '/admin'
  if (role === 'TEACHER') return '/profesor'
  return '/alumno'
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, isDemoMode } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isDemoMode) return

    setSubmitting(true)
    setError(null)

    try {
      const user = await login(email, password)
      navigate(routeForRole(user.role), { replace: true })
    } catch (loginError) {
      setError(getLoginErrorMessage(loginError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-brand-panel">
        <Link className="brand brand-light" to="/">
          <span className="brand-mark">LS</span>
          <span><strong>Language School</strong><small>English with confidence</small></span>
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
        <small className="auth-note">
          {isDemoMode ? 'Modo demo activo · PocketBase todavía no está conectado.' : 'Acceso protegido mediante PocketBase.'}
        </small>
      </section>

      <section className="auth-form-panel">
        <div className="auth-card">
          <span className="eyebrow">ACCESO A LA PLATAFORMA</span>
          <h2>Bienvenido de nuevo.</h2>
          <p className="muted">
            {isDemoMode
              ? 'Mientras llega la Raspberry puedes seguir revisando las vistas de demostración.'
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
              disabled={isDemoMode || submitting}
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
              disabled={isDemoMode || submitting}
              required
            />
            <button className="button button-primary button-full" type="submit" disabled={isDemoMode || submitting}>
              {submitting ? 'Entrando…' : 'Entrar'}
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

          <Link className="back-link" to="/">← Volver a Language School</Link>
        </div>
      </section>
    </div>
  )
}
