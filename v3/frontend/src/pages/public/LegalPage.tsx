import { useEffect, useState, type ReactNode } from 'react'
import SiteShell from '../../components/SiteShell'
import { isDemoMode } from '../../config/environment'
import { demoSiteSettings } from '../../services/pocketbase/siteManagement'
import { connectedPublicSettingsFallback, getPublicSettings, type PublicSettings } from '../../services/pocketbase/publicAcademy'

type LegalPageKind = 'cookies' | 'privacy' | 'legal' | 'enrollment'
type LegalPageProps = { kind: LegalPageKind }

type LegalSectionProps = {
  title: string
  children: ReactNode
}

const metadata: Record<LegalPageKind, { eyebrow: string; title: string; intro: string; field: keyof Pick<PublicSettings, 'cookiePolicyText' | 'privacyPolicyText' | 'legalNoticeText' | 'enrollmentTermsText'> }> = {
  cookies: {
    eyebrow: 'PRIVACIDAD · COOKIES',
    title: 'Política de cookies',
    intro: 'Qué almacenamiento utiliza Language School, para qué sirve, qué servicios externos dependen de tu decisión y cómo puedes cambiarla.',
    field: 'cookiePolicyText',
  },
  privacy: {
    eyebrow: 'PRIVACIDAD · DATOS',
    title: 'Política de privacidad',
    intro: 'Información clara sobre el tratamiento de los datos facilitados a Language School a través de la web y de la plataforma académica.',
    field: 'privacyPolicyText',
  },
  legal: {
    eyebrow: 'INFORMACIÓN · LEGAL',
    title: 'Aviso legal',
    intro: 'Identificación del responsable de este sitio y condiciones generales de acceso y utilización de los servicios digitales de Language School.',
    field: 'legalNoticeText',
  },
  enrollment: {
    eyebrow: 'MATRÍCULA · CONDICIONES',
    title: 'Condiciones de matrícula',
    intro: 'Información previa sobre cómo se formaliza una matrícula y las condiciones académicas aplicables.',
    field: 'enrollmentTermsText',
  },
}

function LegalSection({ title, children }: LegalSectionProps) {
  return <section className="legal-content-section"><h2>{title}</h2><div>{children}</div></section>
}

function AdditionalText({ text, title = 'Información adicional de la academia' }: { text: string; title?: string }) {
  if (!text.trim()) return null
  return <LegalSection title={title}><div className="legal-custom-text">{text.trim()}</div></LegalSection>
}

export default function LegalPage({ kind }: LegalPageProps) {
  const [settings, setSettings] = useState<PublicSettings>(() => isDemoMode
    ? { ...demoSiteSettings, logoUrl: '' }
    : { ...connectedPublicSettingsFallback })
  const page = metadata[kind]

  useEffect(() => {
    let mounted = true
    getPublicSettings().then((value) => { if (mounted) setSettings(value) }).catch(() => undefined)
    return () => { mounted = false }
  }, [])

  const owner = settings.legalOwnerName.trim() || (isDemoMode ? settings.academyName.trim() || 'Language School' : 'Pendiente de configurar')
  const taxId = settings.legalTaxId.trim()
  const registry = settings.legalRegistryDetails.trim()
  const address = settings.address.trim()
  const email = settings.email.trim()
  const phone = settings.phone.trim()
  const additionalText = settings[page.field]
  const identityIncomplete = !settings.legalOwnerName.trim() || !taxId

  return (
    <SiteShell>
      <section className="legal-page">
        <div className="container legal-page-shell">
          <header className="legal-page-header">
            <span className="eyebrow">{page.eyebrow}</span>
            <h1>{page.title}</h1>
            <p className="legal-page-intro">{page.intro}</p>
          </header>

          {kind !== 'cookies' && identityIncomplete && (
            <div className="legal-completion-note" role="note">
              <strong>Dato pendiente antes de producción.</strong>
              <span>El administrador debe completar el titular legal real y su NIF/CIF en Admin → Configuración. La web no inventa estos datos.</span>
            </div>
          )}

          <div className="legal-page-body">
            {kind === 'privacy' && (
              <>
                <LegalSection title="1. Responsable del tratamiento">
                  <dl className="legal-data-list">
                    <div><dt>Titular</dt><dd>{owner}</dd></div>
                    {taxId && <div><dt>NIF / CIF</dt><dd>{taxId}</dd></div>}
                    {address && <div><dt>Dirección</dt><dd>{address}</dd></div>}
                    {email && <div><dt>Email</dt><dd><a href={`mailto:${email}`}>{email}</a></dd></div>}
                    {phone && <div><dt>Teléfono</dt><dd><a href={`tel:${phone}`}>{phone}</a></dd></div>}
                  </dl>
                </LegalSection>

                <LegalSection title="2. Qué datos tratamos y de dónde proceden">
                  <p>Tratamos únicamente los datos necesarios para atender consultas y prestar los servicios de la academia: datos identificativos y de contacto, información académica o de matrícula, grupos y clases, asistencia, materiales, tareas, comunicaciones y los datos técnicos imprescindibles para mantener la cuenta y la seguridad de la plataforma.</p>
                  <p>Los datos proceden principalmente de la propia persona interesada o, cuando el alumno sea menor, de su padre, madre o representante legal. La web no solicita categorías especiales de datos a través del formulario público de contacto.</p>
                </LegalSection>

                <LegalSection title="3. Finalidades y bases jurídicas">
                  <ul>
                    <li><strong>Atender consultas y orientar sobre cursos:</strong> aplicación de medidas precontractuales solicitadas por la persona interesada.</li>
                    <li><strong>Gestionar alumnos, grupos, clases, materiales, tareas, asistencia y comunicaciones:</strong> ejecución de la relación académica o contractual correspondiente.</li>
                    <li><strong>Cumplir obligaciones administrativas, fiscales o legales:</strong> cumplimiento de las obligaciones que resulten aplicables al responsable.</li>
                    <li><strong>Mantener la seguridad y funcionamiento de cuentas y servicios:</strong> interés legítimo en proteger la plataforma, limitado a lo necesario y compatible con los derechos de las personas usuarias.</li>
                    <li><strong>Cargar servicios opcionales o realizar tratamientos que lo requieran:</strong> consentimiento, que puede retirarse en cualquier momento sin afectar a la licitud del tratamiento previo.</li>
                  </ul>
                </LegalSection>

                <LegalSection title="4. Conservación">
                  <p>Los datos se conservarán durante el tiempo necesario para la finalidad para la que fueron recogidos y, cuando exista una relación con la academia, durante el tiempo necesario para gestionarla. Después podrán mantenerse bloqueados durante los plazos exigidos para atender posibles responsabilidades u obligaciones legales.</p>
                  <p>Las consultas que no lleguen a convertirse en una relación académica se conservarán únicamente durante el tiempo razonablemente necesario para atender y cerrar la solicitud. Las preferencias basadas en consentimiento se mantienen hasta que se retiren o dejen de ser necesarias.</p>
                </LegalSection>

                <LegalSection title="5. Destinatarios y servicios externos">
                  <p>Los datos no se comunican a terceros salvo cuando sea necesario para prestar el servicio mediante proveedores que actúen por cuenta de la academia, cuando exista una obligación legal o cuando la persona usuaria solicite o autorice expresamente un servicio externo.</p>
                  <p>Los contenidos opcionales integrados, como Google Maps, permanecen bloqueados hasta que se autoriza la categoría correspondiente. Al abrir enlaces externos —por ejemplo WhatsApp, Instagram u otros proveedores— también se aplicarán las condiciones y políticas del proveedor elegido.</p>
                </LegalSection>

                <LegalSection title="6. Derechos">
                  <p>Puedes solicitar acceso, rectificación, supresión, oposición, limitación y portabilidad cuando proceda, así como retirar un consentimiento previamente otorgado. La solicitud puede dirigirse al email o dirección indicados en el apartado del responsable, acreditando la identidad cuando sea necesario.</p>
                  <p>Si consideras que el tratamiento de tus datos no es adecuado, también puedes presentar una reclamación ante la Agencia Española de Protección de Datos.</p>
                </LegalSection>

                <LegalSection title="7. Menores, seguridad y cambios">
                  <p>Cuando el servicio se preste a menores, la academia gestionará la relación y las autorizaciones necesarias con sus representantes legales conforme a la normativa aplicable. Se aplican medidas razonables para evitar accesos no autorizados, pérdidas o usos indebidos de la información.</p>
                  <p>Esta política puede actualizarse cuando cambien los servicios, proveedores o tratamientos. La versión publicada en esta página será la vigente en cada momento.</p>
                </LegalSection>
              </>
            )}

            {kind === 'cookies' && (
              <>
                <LegalSection title="1. Qué son las cookies y tecnologías similares">
                  <p>Son pequeños datos que el navegador puede almacenar para recordar una sesión, una preferencia o una decisión. Language School utiliza almacenamiento técnico necesario y un sistema de consentimiento que impide cargar servicios opcionales antes de que el visitante decida.</p>
                </LegalSection>

                <LegalSection title="2. Categorías disponibles">
                  <div className="legal-cookie-grid">
                    <article><strong>Necesarias</strong><p>Permiten seguridad, sesión, funcionamiento básico y recordar la elección de privacidad. No pueden desactivarse desde el panel porque son necesarias para prestar el servicio solicitado.</p></article>
                    <article><strong>Preferencias</strong><p>Permiten funcionalidades externas solicitadas por el visitante. Actualmente Google Maps depende de esta categoría.</p></article>
                    <article><strong>Estadística</strong><p>Reservada para herramientas de medición que pudieran incorporarse en el futuro. La web no debe cargarlas mientras no exista consentimiento.</p></article>
                    <article><strong>Marketing</strong><p>Reservada para servicios publicitarios o de seguimiento que pudieran incorporarse. Permanece desactivada mientras no exista consentimiento válido.</p></article>
                  </div>
                </LegalSection>

                <LegalSection title="3. Google Maps y terceros">
                  <p>El mapa de Contacto no se carga automáticamente cuando el panel de consentimiento está activo. Solo se inserta después de permitir Preferencias. Hasta entonces se muestra la dirección mediante contenido propio de Language School sin solicitar el mapa externo.</p>
                  <p>WhatsApp, Instagram y otros enlaces externos se abren únicamente cuando la persona usuaria decide pulsarlos; una vez fuera de esta web, se aplican las políticas del proveedor correspondiente.</p>
                </LegalSection>

                <LegalSection title="4. Cómo aceptar, rechazar o cambiar tu elección">
                  <p>La primera visita ofrece las opciones de aceptar, rechazar o configurar las categorías opcionales. La decisión se guarda en el navegador. Puedes reabrir en cualquier momento el panel mediante “Configurar cookies” en el pie de página y modificarla.</p>
                  <p>También puedes borrar el almacenamiento del sitio desde la configuración de tu navegador; en ese caso la web volverá a solicitar una elección cuando corresponda.</p>
                </LegalSection>

                <LegalSection title="5. Duración y actualización">
                  <p>La preferencia de consentimiento se conserva durante un máximo de 24 meses, salvo que la cambies o elimines los datos del sitio desde el navegador. Si se incorporan nuevos servicios opcionales, esta política y el panel deberán actualizarse antes de activarlos.</p>
                </LegalSection>
              </>
            )}

            {kind === 'legal' && (
              <>
                <LegalSection title="1. Identificación del titular">
                  <dl className="legal-data-list">
                    <div><dt>Nombre / razón social</dt><dd>{owner}</dd></div>
                    {taxId && <div><dt>NIF / CIF</dt><dd>{taxId}</dd></div>}
                    {address && <div><dt>Domicilio / establecimiento</dt><dd>{address}</dd></div>}
                    {email && <div><dt>Email</dt><dd><a href={`mailto:${email}`}>{email}</a></dd></div>}
                    {phone && <div><dt>Teléfono</dt><dd><a href={`tel:${phone}`}>{phone}</a></dd></div>}
                    {registry && <div><dt>Datos registrales</dt><dd>{registry}</dd></div>}
                  </dl>
                </LegalSection>

                <LegalSection title="2. Objeto del sitio">
                  <p>Este sitio informa sobre Language School, sus programas, equipo, tarifas y canales de contacto, y proporciona acceso a áreas privadas destinadas a la gestión académica de alumnos, profesores y administración.</p>
                </LegalSection>

                <LegalSection title="3. Condiciones de uso">
                  <p>La persona usuaria se compromete a utilizar la web y las áreas privadas de forma lícita, respetando los derechos de terceros y evitando accesos no autorizados, suplantaciones, alteraciones, extracción abusiva de información o cualquier actuación que pueda comprometer la seguridad del servicio.</p>
                  <p>Las credenciales de acceso son personales. Cada usuario debe custodiar sus datos de autenticación y comunicar cualquier incidencia de seguridad relevante.</p>
                </LegalSection>

                <LegalSection title="4. Contenidos y propiedad intelectual">
                  <p>Salvo que se indique lo contrario, los textos, identidad visual, estructura y materiales propios del sitio están protegidos por la normativa aplicable. Las fotografías, marcas, tipografías o recursos de terceros mantienen la titularidad y condiciones de licencia que correspondan.</p>
                  <p>No se autoriza la reproducción o explotación de contenidos propios fuera de los límites legalmente permitidos sin la autorización correspondiente.</p>
                </LegalSection>

                <LegalSection title="5. Enlaces y servicios de terceros">
                  <p>La web puede enlazar a servicios externos como Google Maps, WhatsApp, Instagram u otros proveedores. Language School controla cuándo se cargan los contenidos integrados que requieren consentimiento, pero no controla el funcionamiento ni las políticas de los sitios externos una vez que la persona usuaria accede a ellos.</p>
                </LegalSection>

                <LegalSection title="6. Disponibilidad y responsabilidad">
                  <p>Se trabaja para mantener la información y los servicios disponibles y actualizados, sin perjuicio de interrupciones técnicas, mantenimiento o incidencias ajenas al control razonable de la academia. Los contenidos informativos no sustituyen la confirmación individual de plazas, horarios, condiciones o servicios cuando estos puedan variar.</p>
                </LegalSection>

                <LegalSection title="7. Legislación aplicable">
                  <p>El uso de esta web se rige por la legislación española y por la normativa de protección de consumidores y usuarios cuando resulte aplicable. Cualquier controversia se resolverá conforme a las reglas legales de competencia que correspondan en cada caso.</p>
                </LegalSection>
              </>
            )}

            {kind === 'enrollment' && (
              <>
                <LegalSection title="1. Cómo se formaliza la matrícula">
                  <p>La publicación de programas y tarifas tiene carácter informativo. Esta web no formaliza por sí sola una matrícula ni cobra pagos online: la academia confirma individualmente plaza, grupo, horario, precio y condiciones antes de activar el acceso privado.</p>
                </LegalSection>
                <LegalSection title="2. Información que debe confirmarse antes de contratar">
                  <p>Antes de una matrícula, la academia facilitará las condiciones aplicables al programa: identidad del titular, características del servicio, duración, precio total e impuestos, forma y calendario de pago, materiales, política de bajas, recuperaciones y cambios, así como el canal de reclamaciones.</p>
                </LegalSection>
                <LegalSection title="3. Menores y clases online">
                  <p>Cuando el alumno sea menor, la matrícula y las autorizaciones necesarias deben ser gestionadas por su padre, madre o representante legal. Las reglas de uso de videoclases, materiales, imagen, grabaciones y comunicación con menores deben quedar expresamente confirmadas antes de activar el servicio.</p>
                </LegalSection>
                <LegalSection title="4. Desistimiento y contenidos digitales">
                  <p>Si en el futuro se habilita contratación o pago a distancia, la academia informará antes de contratar sobre el derecho de desistimiento y, cuando proceda, recabará las manifestaciones expresas exigidas para iniciar un servicio o facilitar contenido digital antes de que venza ese plazo.</p>
                </LegalSection>
              </>
            )}

            <AdditionalText text={additionalText} title={kind === 'enrollment' ? '5. Condiciones generales de matrícula' : undefined} />
          </div>
        </div>
      </section>
    </SiteShell>
  )
}
