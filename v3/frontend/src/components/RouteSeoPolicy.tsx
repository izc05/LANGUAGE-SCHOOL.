import { useEffect } from 'react'
import { useLocation } from 'react-router'

const PRIVATE_PREFIXES = ['/acceso', '/admin', '/alumno', '/profesor']
const MANAGED_ATTR = 'data-language-school-route-seo'

function isPrivatePath(pathname: string) {
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

function upsertRobotsMeta(name: 'robots' | 'googlebot', content: string) {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"][${MANAGED_ATTR}]`)
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = name
    meta.setAttribute(MANAGED_ATTR, 'true')
    document.head.appendChild(meta)
  }
  meta.content = content
}

function removeManagedRobotsMeta() {
  document.head.querySelectorAll(`meta[${MANAGED_ATTR}]`).forEach((node) => node.remove())
}

export default function RouteSeoPolicy() {
  const { pathname } = useLocation()

  useEffect(() => {
    if (isPrivatePath(pathname)) {
      const policy = 'noindex, nofollow, noarchive, nosnippet'
      upsertRobotsMeta('robots', policy)
      upsertRobotsMeta('googlebot', policy)
    } else {
      removeManagedRobotsMeta()
    }

    return removeManagedRobotsMeta
  }, [pathname])

  return null
}
