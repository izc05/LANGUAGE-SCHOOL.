import { type FormEvent, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAcademyBrand } from '../../hooks/useAcademyBrand'
import { activateAccountInvitation } from '../../services/pocketbase/accountInvitations'

const TOKEN_PATTERN = /^[A-Za-z0-9]{40,100}$/

export default function AccountActivationPage() {
  const { academyName, logoUrl, initials } = useAcademyBrand()
  const [searchParams] = useSearchParams()
  const token = (searchParams.get('token') || '').trim()
  const tokenValid = TOKEN_PATTERN.test(token)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fallbackLogoUrl = `${import.meta.env.BASE_URL}brand/language-school-rocio-ruiz-logo.svg`

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting || success) return
    setError(null)

    if (!tokenValid) {
      setError('El enlace de activación no es válido. Solicita una nueva invitación a la academia.')
      return
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== passwordConfirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setSubmitting(true)
    try {
      await activateAccountInvitation({ token, password, passwordConfirm })
      setPassword('')
      setPasswordConfirm('')
      setSuccess(true)
    } catch {
      setError('No hemos podido activar la cuenta. El enlace puede haber caducado, haberse utilizado ya o haber sido revocado. Solicita una nueva invitación a la academia.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page auth-premium-v2">
      <section className="auth-brand-panel">
        <Link className="brand brand-light" to="/" aria-label={`${academyName} - Inicio`}>
          <img className="brand-logo-image" src={logoUrl || fallbackLogoUrl} alt="" />
          <span><strong>{academyName}</strong><small>English with confidence</small></span>
        </Link>

        <div className="auth-brand-copy">
          <span className="eyebrow eyebrow-light">TU CUENTA</span>
          <h1>Tu espacio empieza contigo.</h1>
          <p>Crea una contraseña privada para activar tu acceso a Language School. Administración nunca verá ni elegirá esta contraseña.</p>
          <div className="auth-feature-list">
            <span>Enlace personal de un solo uso</span>
            <span>Contraseña elegida por ti</span>
            <span>Acceso privado según tu perfil</span>
          </div>
        </div>

        <small className="auth-note">Si no esperabas esta invitación, puedes cerrar esta página.</small>
      </section>

      <section className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-card-brand">
            <span className="auth-card-brand-mark">{initials}</span>
            <span>ACTIVACIÓN SEGURA</span>
          </div>

          {success ? (
            <>
              <span className="eyebrow">CUENTA PREPARADA</span>
              <h2>Cuenta activada.</h2>
              <p className="muted">Tu contraseña ya está guardada de forma segura y este enlace no puede volver a utilizarse.</p>
              <div className="cms-notice success-notice" role="status">Ya puedes entrar a tu espacio privado.</div>
              <Link className="button button-primary button-full" to="/acceso">Entrar a mi espacio</Link>
              <Link className="back-link" to="/">← Volver a {academyName}</Link>
            </>
          ) : (
            <>
              <span className="eyebrow">CREA TU CONTRASEÑA</span>
              <h2>Activa tu cuenta.</h2>
              <p className="muted">Elige una contraseña de al menos 8 caracteres. El enlace quedará inutilizado al completar la activación.</p>

              {!tokenValid && <div className="cms-notice auth-error" role="alert">El enlace de activación no es válido. Solicita una nueva invitación a la academia.</div>}
              {error && tokenValid && <div className="cms-notice auth-error" role="alert">{error}</div>}

              <form onSubmit={handleSubmit}>
                <label htmlFor="activation-password">Nueva contraseña</label>
                <input
                  id="activation-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={submitting || !tokenValid}
                  required
                />
                <label htmlFor="activation-password-confirm">Confirmar contraseña</label>
                <input
                  id="activation-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  disabled={submitting || !tokenValid}
                  required
                />
                <button className="button button-primary button-full" type="submit" disabled={submitting || !tokenValid}>
                  {submitting ? 'Activando…' : 'Activar mi cuenta'}
                </button>
              </form>

              <Link className="back-link" to="/acceso">← Ya tengo mi cuenta activa</Link>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
