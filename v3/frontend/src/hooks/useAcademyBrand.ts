import { useEffect, useMemo, useState } from 'react'
import { demoSiteSettings } from '../services/pocketbase/siteManagement'
import { getPublicSettings } from '../services/pocketbase/publicAcademy'

type AcademyBrand = {
  academyName: string
  logoUrl: string
  initials: string
}

function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'LS'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase()
}

export function useAcademyBrand(): AcademyBrand {
  const [academyName, setAcademyName] = useState(demoSiteSettings.academyName)
  const [logoUrl, setLogoUrl] = useState('')

  useEffect(() => {
    let mounted = true

    getPublicSettings()
      .then((settings) => {
        if (!mounted) return
        setAcademyName(settings.academyName || demoSiteSettings.academyName)
        setLogoUrl(settings.logoUrl || '')
      })
      .catch(() => undefined)

    return () => {
      mounted = false
    }
  }, [])

  const initials = useMemo(() => initialsFor(academyName), [academyName])

  return { academyName, logoUrl, initials }
}
