import { Link } from 'react-router'

export default function LoginPage() {
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
        <small className="auth-note">La autenticación real se conectará a PocketBase en la Raspberry Pi.</small>
      </section>

      <section className="auth-form-panel">
        <div className="auth-card">
          <span className="eyebrow">ACCESO A LA PLATAFORMA</span>
          <h2>Bienvenido de nuevo.</h2>
          <p className="muted">Introduce tus credenciales cuando conectemos PocketBase. Por ahora puedes abrir las vistas de demostración.</p>

          <form onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" placeholder="nombre@email.com" disabled />
            <label htmlFor="password">Contraseña</label>
            <input id="password" type="password" placeholder="••••••••" disabled />
            <button className="button button-primary button-full" type="submit" disabled>Entrar</button>
          </form>

          <div className="demo-divider"><span>Vistas de desarrollo</span></div>
          <div className="demo-links">
            <Link to="/alumno">Demo alumno</Link>
            <Link to="/profesor">Demo profesor</Link>
            <Link to="/admin">Demo administrador</Link>
          </div>
          <Link className="back-link" to="/">← Volver a Language School</Link>
        </div>
      </section>
    </div>
  )
}
