export type JitsiExternalApi = {
  addListener: (event: string, listener: (payload?: unknown) => void) => void
  removeListener?: (event: string, listener: (payload?: unknown) => void) => void
  dispose: () => void
  getIFrame?: () => HTMLIFrameElement
}

type JitsiExternalApiConstructor = new (
  domain: string,
  options: {
    roomName: string
    width: string
    height: string
    parentNode: HTMLElement
    lang: string
    userInfo: { displayName: string }
    configOverwrite?: Record<string, unknown>
    interfaceConfigOverwrite?: Record<string, unknown>
    onload?: () => void
  },
) => JitsiExternalApi

declare global {
  interface Window {
    JitsiMeetExternalAPI?: JitsiExternalApiConstructor
  }
}

const JITSI_SCRIPT = 'https://meet.jit.si/external_api.js'

export async function loadJitsiExternalApi(): Promise<JitsiExternalApiConstructor> {
  if (window.JitsiMeetExternalAPI) return window.JitsiMeetExternalAPI

  const existing = document.querySelector<HTMLScriptElement>('script[data-language-school-jitsi-api]')
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('Jitsi no respondió a tiempo.')), 20_000)
      const finish = (callback: () => void) => { window.clearTimeout(timeout); callback() }
      existing.addEventListener('load', () => finish(resolve), { once: true })
      existing.addEventListener('error', () => finish(() => reject(new Error('No se ha podido cargar Jitsi.'))), { once: true })
    })
  } else {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      const timeout = window.setTimeout(() => reject(new Error('Jitsi no respondió a tiempo.')), 20_000)
      script.src = JITSI_SCRIPT
      script.async = true
      script.dataset.languageSchoolJitsiApi = 'true'
      script.onload = () => { window.clearTimeout(timeout); resolve() }
      script.onerror = () => { window.clearTimeout(timeout); reject(new Error('No se ha podido cargar Jitsi.')) }
      document.head.appendChild(script)
    })
  }

  if (!window.JitsiMeetExternalAPI) throw new Error('Jitsi se ha cargado, pero su aula no está disponible.')
  return window.JitsiMeetExternalAPI
}

