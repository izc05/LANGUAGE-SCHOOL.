import { pb } from './client'

export type ZoomIntegrationStatus = {
  provider: 'zoom'
  source: 'server_environment'
  apiConfigured: boolean
  meetingSdkConfigured: boolean
  configured: boolean
}

export type ZoomConnectionCheck = {
  provider: 'zoom'
  configured: boolean
  connected: boolean
  reason: 'ok' | 'missing_credentials' | 'oauth_failed' | 'api_failed' | 'network_error'
  statusCode?: number
  accountUser?: {
    id: string
    displayName: string
  }
}

export async function getZoomIntegrationStatus(): Promise<ZoomIntegrationStatus> {
  return pb.send<ZoomIntegrationStatus>('/api/language-school/zoom/status', { method: 'GET' })
}

export async function checkZoomApiConnection(): Promise<ZoomConnectionCheck> {
  return pb.send<ZoomConnectionCheck>('/api/language-school/zoom/check', { method: 'POST' })
}
