const ZOOM_MEETING_SDK_VERSION = '6.2.0'

export type ZoomClientViewApi = {
  setZoomJSLib: (baseUrl: string, assetPath: string) => void
  preLoadWasm: () => void
  prepareWebSDK: () => void
  i18n?: {
    load: (language: string) => Promise<unknown>
  }
  init: (options: {
    leaveUrl: string
    patchJsMedia?: boolean
    disableCORP?: boolean
    success: () => void
    error: (error: unknown) => void
  }) => void
  join: (options: {
    signature: string
    meetingNumber: string
    userName: string
    passWord: string
    success: () => void
    error: (error: unknown) => void
  }) => void
}

declare global {
  interface Window {
    ZoomMtg?: ZoomClientViewApi
  }
}

const scriptPromises = new Map<string, Promise<void>>()

function loadScript(src: string): Promise<void> {
  const existingPromise = scriptPromises.get(src)
  if (existingPromise) return existingPromise

  const promise = new Promise<void>((resolve, reject) => {
    const selector = `script[data-language-school-zoom-src="${src}"]`
    const existing = document.querySelector<HTMLScriptElement>(selector)
    const script = existing ?? document.createElement('script')
    const timeout = window.setTimeout(() => reject(new Error('Zoom no respondió a tiempo al cargar el aula online.')), 20_000)

    const cleanup = () => window.clearTimeout(timeout)
    const handleLoad = () => {
      cleanup()
      script.dataset.languageSchoolZoomLoaded = 'true'
      resolve()
    }
    const handleError = () => {
      cleanup()
      reject(new Error('No se ha podido cargar el aula Zoom. Comprueba tu conexión e inténtalo de nuevo.'))
    }

    if (script.dataset.languageSchoolZoomLoaded === 'true') {
      cleanup()
      resolve()
      return
    }

    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', handleError, { once: true })

    if (!existing) {
      script.src = src
      script.async = true
      script.dataset.languageSchoolZoomSrc = src
      document.head.appendChild(script)
    }
  })

  scriptPromises.set(src, promise)
  return promise
}

export async function loadZoomMeetingSdk(): Promise<ZoomClientViewApi> {
  if (window.ZoomMtg) return window.ZoomMtg

  const vendorBase = `https://source.zoom.us/${ZOOM_MEETING_SDK_VERSION}/lib/vendor`
  const sources = [
    `${vendorBase}/react.min.js`,
    `${vendorBase}/react-dom.min.js`,
    `${vendorBase}/redux.min.js`,
    `${vendorBase}/redux-thunk.min.js`,
    `${vendorBase}/lodash.min.js`,
    `https://source.zoom.us/zoom-meeting-${ZOOM_MEETING_SDK_VERSION}.min.js`,
  ]

  for (const src of sources) await loadScript(src)

  if (!window.ZoomMtg) throw new Error('Zoom se ha cargado, pero el cliente de reunión no está disponible.')
  return window.ZoomMtg
}

export function configureZoomMeetingSdk(zoom: ZoomClientViewApi) {
  zoom.setZoomJSLib(`https://source.zoom.us/${ZOOM_MEETING_SDK_VERSION}/lib`, '/av')
  zoom.preLoadWasm()
  zoom.prepareWebSDK()
}
