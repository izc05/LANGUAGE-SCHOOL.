type Props = {
  visible: boolean
  onRetry?: () => void
}

export default function BackendStatusBanner({ visible, onRetry }: Props) {
  if (!visible) return null

  return (
    <div className="backend-status-banner" role="status" aria-live="polite">
      <div>
        <strong>Conexión temporalmente no disponible</strong>
        <span>La web sigue abierta, pero algunas funciones privadas pueden tardar en actualizarse.</span>
      </div>
      {onRetry && <button type="button" onClick={onRetry}>Reintentar</button>}
    </div>
  )
}
