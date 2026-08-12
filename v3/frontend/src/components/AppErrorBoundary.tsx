import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Deliberately keep technical details out of the user interface. The
    // production logging transport will be wired after the Raspberry/domain
    // deployment is available.
    console.error('Language School UI error', error, info.componentStack)
  }

  private reload = () => {
    window.location.reload()
  }

  private goHome = () => {
    window.location.assign('/')
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="app-fatal-error" role="alert">
        <div className="app-fatal-error-card">
          <span className="eyebrow">LANGUAGE SCHOOL</span>
          <h1>No hemos podido mostrar esta pantalla.</h1>
          <p>Tu sesión y tus datos no se han borrado. Puedes volver a intentarlo o regresar al inicio.</p>
          <div className="hero-actions">
            <button className="button button-primary" type="button" onClick={this.reload}>Volver a intentar</button>
            <button className="button button-ghost" type="button" onClick={this.goHome}>Ir al inicio</button>
          </div>
          <small>Si el problema continúa, comunícalo a la academia indicando qué estabas haciendo.</small>
        </div>
      </main>
    )
  }
}
