import { pb } from './client'

export type ZoomIntegrationStatus = {
  provider: 'zoom'
  source: 'server_environment'
  apiConfigured: boolean
  meetingSdkConfigured: boolean
  configured: boolean
}

export async function getZoomIntegrationStatus(): Promise<ZoomIntegrationStatus> {
  return pb.send<ZoomIntegrationStatus>('/api/language-school/zoom/status', { method: 'GET' })
}
