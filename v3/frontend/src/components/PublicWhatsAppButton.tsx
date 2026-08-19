import { buildWhatsAppUrl } from '../utils/whatsapp'

type PublicWhatsAppButtonProps = {
  enabled: boolean
  phone: string
  message: string
  academyName: string
}

export default function PublicWhatsAppButton({ enabled, phone, message, academyName }: PublicWhatsAppButtonProps) {
  const href = buildWhatsAppUrl(phone, message)
  if (!enabled || !href) return null

  const resolvedAcademyName = academyName.trim() || 'Language School'

  return (
    <a
      className="public-whatsapp-button"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Escribir a ${resolvedAcademyName} por WhatsApp`}
    >
      <span className="public-whatsapp-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <path d="M12 3.25a8.25 8.25 0 0 0-7.04 12.55L3.7 20.3l4.62-1.2A8.25 8.25 0 1 0 12 3.25Z" />
          <path d="M8.85 8.1c.2-.45.42-.46.72-.47h.6c.18 0 .35.05.45.3l.72 1.73c.08.2.04.38-.08.55l-.58.72a.38.38 0 0 0-.04.47c.47.8 1.17 1.52 2 2 .2.12.36.1.5-.06l.76-.87c.16-.19.36-.22.57-.14l1.8.85c.22.1.32.25.29.48-.08.6-.4 1.4-.95 1.82-.48.36-1.12.56-1.83.46-1.14-.16-2.64-.78-4.12-2.1-1.18-1.04-2.02-2.25-2.35-3.22-.3-.9-.11-1.76.22-2.3l.32-.21Z" />
        </svg>
      </span>
      <span className="public-whatsapp-copy"><strong>¿Hablamos?</strong><small>WhatsApp</small></span>
    </a>
  )
}
