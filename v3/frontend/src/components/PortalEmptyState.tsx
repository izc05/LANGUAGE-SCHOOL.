import { Link } from 'react-router'

type PortalEmptyStateProps = {
  title: string
  description: string
  action?: {
    label: string
    to: string
  }
  compact?: boolean
}

export default function PortalEmptyState({ title, description, action, compact = false }: PortalEmptyStateProps) {
  return (
    <div className={`portal-empty-state${compact ? ' compact' : ''}`} role="status">
      <span className="portal-empty-state-mark" aria-hidden="true">✓</span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      {action && <Link className="text-link" to={action.to}>{action.label} →</Link>}
    </div>
  )
}
