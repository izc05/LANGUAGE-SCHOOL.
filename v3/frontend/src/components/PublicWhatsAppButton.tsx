type PublicWhatsAppButtonProps = {
  enabled: boolean
  phone: string
  message: string
}

function normalizeWhatsAppNumber(value: string): string {
  return value.replace(/\D/g, '')
}

export default function PublicWhatsAppButton({ enabled, phone, message }: PublicWhatsAppButtonProps) {
  const number = normalizeWhatsAppNumber(phone)
  if (!enabled || !number) return null

  const href = `https://wa.me/${number}${message.trim() ? `?text=${encodeURIComponent(message.trim())}` : ''}`

  return (
    <a
      className="public-whatsapp-button"
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Escribir a Language School por WhatsApp"
    >
      <span className="public-whatsapp-icon" aria-hidden="true">⌁</span>
      <span className="public-whatsapp-copy"><strong>¿Hablamos?</strong><small>WhatsApp</small></span>
    </a>
  )
}
