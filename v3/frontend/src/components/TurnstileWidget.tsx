import { useEffect, useRef } from 'react'

type TurnstileApi = {
  render: (container: HTMLElement, options: {
    sitekey: string
    action?: string
    theme?: 'light' | 'dark' | 'auto'
    callback: (token: string) => void
    'expired-callback'?: () => void
    'error-callback'?: () => void
  }) => string
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT_ID = 'cloudflare-turnstile-script'
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
    const script = existing || document.createElement('script')

    const handleLoad = () => {
      if (window.turnstile) resolve(window.turnstile)
      else reject(new Error('Turnstile API unavailable'))
    }
    const handleError = () => reject(new Error('Turnstile script failed to load'))

    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', handleError, { once: true })

    if (!existing) {
      script.id = SCRIPT_ID
      script.src = SCRIPT_URL
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
  })
}

export default function TurnstileWidget({
  siteKey,
  onToken,
  onUnavailable,
}: {
  siteKey: string
  onToken: (token: string) => void
  onUnavailable: () => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const tokenCallbackRef = useRef(onToken)
  const unavailableCallbackRef = useRef(onUnavailable)

  useEffect(() => { tokenCallbackRef.current = onToken }, [onToken])
  useEffect(() => { unavailableCallbackRef.current = onUnavailable }, [onUnavailable])

  useEffect(() => {
    let active = true
    let widgetId = ''

    if (!siteKey) {
      unavailableCallbackRef.current()
      return () => undefined
    }

    loadTurnstile().then((turnstile) => {
      if (!active || !containerRef.current) return
      widgetId = turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action: 'contact',
        theme: 'auto',
        callback: (token) => tokenCallbackRef.current(token),
        'expired-callback': () => tokenCallbackRef.current(''),
        'error-callback': () => {
          tokenCallbackRef.current('')
          unavailableCallbackRef.current()
        },
      })
    }).catch(() => {
      if (active) unavailableCallbackRef.current()
    })

    return () => {
      active = false
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [siteKey])

  return <div ref={containerRef} className="contact-turnstile" aria-label="Verificación de seguridad" />
}
