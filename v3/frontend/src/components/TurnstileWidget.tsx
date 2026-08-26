import { useEffect, useRef } from 'react'

type TurnstileApi = {
  render: (container: HTMLElement, options: {
    sitekey: string
    action: string
    theme: 'auto'
    language: string
    callback: (token: string) => void
    'expired-callback': () => void
    'timeout-callback': () => void
    'error-callback': () => void
  }) => string
  remove: (widgetId: string) => void
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

const SCRIPT_ID = 'cloudflare-turnstile-script'
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let loaderPromise: Promise<TurnstileApi> | null = null

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (loaderPromise) return loaderPromise

  loaderPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
    const script = existing ?? document.createElement('script')
    let settled = false
    const timeout = window.setTimeout(() => finishError(new Error('Turnstile timeout')), 15_000)

    function cleanup() {
      window.clearTimeout(timeout)
      script.removeEventListener('load', handleLoad)
      script.removeEventListener('error', handleError)
    }
    function finishSuccess(api: TurnstileApi) {
      if (settled) return
      settled = true
      cleanup()
      resolve(api)
    }
    function finishError(error: Error) {
      if (settled) return
      settled = true
      cleanup()
      loaderPromise = null
      reject(error)
    }
    function handleLoad() {
      if (window.turnstile) finishSuccess(window.turnstile)
      else finishError(new Error('Turnstile unavailable'))
    }
    function handleError() { finishError(new Error('Turnstile load failed')) }

    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', handleError, { once: true })
    if (!existing) {
      script.id = SCRIPT_ID
      script.src = SCRIPT_URL
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    } else if (window.turnstile) {
      finishSuccess(window.turnstile)
    }
  })
  return loaderPromise
}

export default function TurnstileWidget({ siteKey, onToken, onUnavailable }: {
  siteKey: string
  onToken: (token: string) => void
  onUnavailable: () => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const tokenRef = useRef(onToken)
  const unavailableRef = useRef(onUnavailable)

  useEffect(() => { tokenRef.current = onToken }, [onToken])
  useEffect(() => { unavailableRef.current = onUnavailable }, [onUnavailable])

  useEffect(() => {
    let active = true
    let widgetId = ''
    tokenRef.current('')

    if (!siteKey) {
      unavailableRef.current()
      return () => undefined
    }

    loadTurnstile().then((turnstile) => {
      if (!active || !containerRef.current) return
      widgetId = turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action: 'contact',
        theme: 'auto',
        language: 'es',
        callback: (token) => tokenRef.current(token),
        'expired-callback': () => tokenRef.current(''),
        'timeout-callback': () => tokenRef.current(''),
        'error-callback': () => {
          tokenRef.current('')
          unavailableRef.current()
        },
      })
    }).catch(() => {
      if (active) unavailableRef.current()
    })

    return () => {
      active = false
      tokenRef.current('')
      if (widgetId && window.turnstile) {
        try { window.turnstile.remove(widgetId) } catch { /* noop */ }
      }
    }
  }, [siteKey])

  return <div ref={containerRef} className="contact-turnstile" aria-label="Verificación de seguridad" />
}
