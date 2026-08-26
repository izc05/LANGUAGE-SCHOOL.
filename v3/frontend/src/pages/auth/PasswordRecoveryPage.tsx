import { type FormEvent, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAcademyBrand } from '../../hooks/useAcademyBrand'
import {
  confirmPasswordRecovery,
  getPasswordRecoveryErrorMessage,
  requestPasswordRecovery,
} from '../../services/pocketbase/passwordRecovery'

export default function PasswordRecoveryPage() {
  const { academyName, logoUrl, initials } = useAcademyBrand()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')?.trim() || ''
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [requested, setRequested] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fallbackLogoUrl = `${import.meta.env.BASE_URL}brand/language-school-rocio-ruiz-logo.svg`
  const portalVisual = `${import.meta.env.BASE_URL}visuals/student-access-portal.svg`

  async function requestRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)

    try {
      await requestPasswordRecovery(email)
      setRequested(true)
    } catch (requestError) {
      setError(getPasswordRecoveryErrorMessage(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)

    try {
      await confirmPasswordRecovery({ token, password, passwordConfirm })
      setCompleted(true)
      setPassword('')
      setPasswordConfirm('')
    } catch (requestError) {
      setError(getPasswordRecoveryErrorMessage(requestError))
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
          <span className="eyebrow eyebrow-light">ACCESO SEGURO</span>
          <h1>Recupera tu espacio.</h1>
          <p>Tu contraseña es privada. La academia no necesita verla ni establecerla por ti.</p>
          <div className="auth-feature-list">
            <span>Enlace temporal de recuperación</span>
            <span>Nueva contraseña elegida por ti</span>
            <span>Sesiones anteriores invalidadas al cambiarla</span>
          </div>
        </div>

        <div className="auth-premium-visual" aria-hidden="true">
          <img src={portalVisual} alt="" />
          <div className="auth-premium-status"><small>PRIVATE ACCESS</small><strong>Recuperación sencilla y segura.</strong></div>
        </div>

        <small className="auth-note">Nunca te pediremos que envíes tu contraseña a Administración.</small>
      </section>

      <section className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-card-brand">
            <span className="auth-card-brand-mark">{initials}</span>
            <span>ÁREA PRIVADA</span>
          </div>

          {token ? (
            <>
              <span className="eyebrow">NUEVA CONTRASEÑA</span>
              <h2>{completed ? 'Contraseña actualizada.' : 'Crea una contraseña nueva.'}</h2>

              {completed ? (
                <>
                  <div className="cms-notice success-notice" role="status">
                    Tu contraseña se ha cambiado correctamente. Ya puedes volver a iniciar sesión.
                  </div>
                  <Link className="button button-primary button-full" to="/acceso">Entrar a mi espacio</Link>
                </>
              ) : (
                <>
                  <p className="muted">Elige una contraseña de al menos 8 caracteres que no compartas con nadie.</p>
                  {error && <div className="cms-notice auth-error" role="alert">{error}</div>}
                  <form onSubmit={confirmRecovery}>
                    <label htmlFor="new-password">Nueva contraseña</label>
                    <input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      disabled={submitting}
                      required
                    />
                    <label htmlFor="new-password-confirm">Repite la contraseña</label>
                    <input
                      id="new-password-confirm"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={passwordConfirm}
                      onChange={(event) => setPasswordConfirm(event.target.value)}
                      disabled={submitting}
                      required
                    />
                    <button className="button button-primary button-full" type="submit" disabled={submitting}>
                      {submitting ? 'Actualizando…' : 'Guardar nueva contraseña'}
                    </button>
                  </form>
                </>
              )}
            </>
          ) : (
            <>
              <span className="eyebrow">RECUPERAR CUENTA</span>
              <h2>{requested ? 'Revisa tu correo.' : '¿Has olvidado tu contraseña?'}</h2>

              {requested ? (
                <>
                  <div className="cms-notice success-notice" role="status">
                    Si existe una cuenta activa asociada a ese email, recibirás un enlace para crear una nueva contraseña.
                  </div>
                  <p className="muted">Por seguridad mostramos el mismo mensaje aunque el email no esté registrado.</p>
                  <button className="button button-full" type="button" onClick={() => { setRequested(false); setError(null) }}>
                    Enviar a otro email
                  </button>
                </>
              ) : (
                <>
                  <p className="muted">Introduce el email con el que accedes a Language School.</p>
                  {error && <div className="cms-notice auth-error" role="alert">{error}</div>}
                  <form onSubmit={requestRecovery}>
                    <label htmlFor="recovery-email">Email</label>
                    <input
                      id="recovery-email"
                      type="email"
                      autoComplete="email"
                      placeholder="nombre@email.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={submitting}
                      required
                    />
                    <button className="button button-primary button-full" type="submit" disabled={submitting}>
                      {submitting ? 'Enviando…' : 'Enviar enlace de recuperación'}
                    </button>
                  </form>
                </>
              )}
            </>
          )}

          <Link className="back-link" to="/acceso">← Volver al acceso</Link>
        </div>
      </section>
    </div>
  )
}
