import { useEffect, useState } from 'react'
import SiteShell from '../../components/SiteShell'
import { demoSiteSettings } from '../../services/pocketbase/siteManagement'
import { getPublicSettings, type PublicSettings } from '../../services/pocketbase/publicAcademy'

type LegalPageKind = 'cookies' | 'privacy' | 'legal'

type LegalPageProps = { kind: LegalPageKind }

const metadata: Record<LegalPageKind, { eyebrow: string; title: string; intro: string; field: keyof Pick<PublicSettings, 'cookiePolicyText' | 'privacyPolicyText' | 'legalNoticeText'> }> = {
  cookies: {
    eyebrow: 'PRIVACIDAD · COOKIES',
    title: 'Política de cookies',
    intro: 'Aquí se explica qué almacenamiento utiliza Language School, para qué sirve y cómo puedes cambiar tus preferencias.',
    field: 'cookiePolicyText',
  },
  privacy: {
    eyebrow: 'PRIVACIDAD · DATOS',
    title: 'Política de privacidad',
    intro: 'Información sobre el tratamiento de los datos facilitados a Language School a través de la web y de la plataforma académica.',
    field: 'privacyPolicyText',
  },
  legal: {
    eyebrow: 'INFORMACIÓN · LEGAL',
    title: 'Aviso legal',
    intro: 'Información identificativa y condiciones de uso de la web y de los servicios digitales de Language School.',
    field: 'legalNoticeText',
  },
}

export default function LegalPage({ kind }: LegalPageProps) {
  const [settings, setSettings] = useState<PublicSettings>({ ...demoSiteSettings, logoUrl: '' })
  const page = metadata[kind]

  useEffect(() => {
    let mounted = true
    getPublicSettings().then((value) => { if (mounted) setSettings(value) }).catch(() => undefined)
    return () => { mounted = false }
  }, [])

  const body = settings[page.field].trim()

  return (
    <SiteShell>
      <section className="legal-page">
        <div className="container legal-page-shell">
          <span className="eyebrow">{page.eyebrow}</span>
          <h1>{page.title}</h1>
          <p className="legal-page-intro">{page.intro}</p>
          {body ? (
            <div className="legal-page-body">{body}</div>
          ) : (
            <div className="legal-page-body legal-page-pending" role="note">
              Este texto está preparado para administrarse desde Configuración. Antes de publicar la web en producción debe completarse y revisarse la información legal definitiva de la academia.
            </div>
          )}
        </div>
      </section>
    </SiteShell>
  )
}
