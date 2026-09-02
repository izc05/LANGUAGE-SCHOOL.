export function formatLastAccess(value?: string): string {
  if (!value) return 'Sin acceso registrado'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin acceso registrado'
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
