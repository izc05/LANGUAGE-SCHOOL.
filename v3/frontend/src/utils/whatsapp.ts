export function normalizeWhatsAppNumber(value: string): string | null {
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)

  if (digits.length === 9 && /^[67]/.test(digits)) {
    digits = `34${digits}`
  }

  if (!/^[1-9]\d{9,14}$/.test(digits)) return null
  return digits
}

export function buildWhatsAppUrl(phone: string, message = ''): string | null {
  const number = normalizeWhatsAppNumber(phone)
  if (!number) return null
  const cleanMessage = message.trim()
  return `https://wa.me/${number}${cleanMessage ? `?text=${encodeURIComponent(cleanMessage)}` : ''}`
}

export function formatWhatsAppNumber(phone: string): string {
  const number = normalizeWhatsAppNumber(phone)
  if (!number) return ''
  return `+${number}`
}
