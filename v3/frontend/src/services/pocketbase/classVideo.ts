import type { ClassRecord, ClassVideoProvider } from './studentPortal'

export function isGoogleMeetUrl(value?: string): boolean {
  const url = value?.trim() || ''
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && parsed.hostname.toLowerCase() === 'meet.google.com'
  } catch {
    return false
  }
}

export function effectiveVideoProvider(
  record: Pick<ClassRecord, 'video_provider' | 'online_join_url'>,
): ClassVideoProvider {
  if (record.video_provider) return record.video_provider
  if (isGoogleMeetUrl(record.online_join_url)) return 'GOOGLE_MEET'
  return 'ZOOM'
}

export function videoProviderLabel(provider: ClassVideoProvider): string {
  if (provider === 'GOOGLE_MEET') return 'Google Meet'
  if (provider === 'MANUAL') return 'Otro enlace'
  return 'Zoom'
}
