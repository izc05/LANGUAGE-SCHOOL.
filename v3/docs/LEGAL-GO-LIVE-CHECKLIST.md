# Legal go-live checklist (Spain)

Status: **not ready for an unrestricted public launch** until every applicable item below has been completed and retained by the academy. This is an implementation checklist, not legal advice or a substitute for review by a qualified adviser.

## Already implemented in the platform

- Persistent legal notice, privacy policy, cookie policy and enrolment-terms route.
- Cookie choices with accept, reject, granular settings, a permanent way to reopen them and a 24-month maximum validity.
- Google Maps is blocked until the visitor enables Preferences; Instagram embeds wait for a specific visitor action.
- Contact form contains first-layer privacy information and Cloudflare Turnstile anti-spam protection.
- Payment exports are explicitly labelled `JUSTIFICANTE DE PAGO - NO FACTURA`.
- Private areas and PocketBase are behind role rules; the public PocketBase administration path is blocked by Nginx.

## Mandatory owner decisions before launch

1. In Admin → Configuración, enter the real legal owner, NIF/CIF, postal address, effective contact email and, where applicable, registration and authorisation details. Do not use the commercial name as a substitute for the legal owner.
2. Publish the academy's actual enrolment terms: programme, duration, total price including taxes, payment schedule and method, cancellations, make-up classes, material, complaints channel and the applicable withdrawal information. The current site does not sell or enrol online; do not add a checkout until this has been reviewed.
3. Create and retain a parent/guardian workflow for every student under 14, and review whether the school contract itself requires a representative for older minors. Record the identity of the representative, date, scope and evidence of each authorisation.
4. Draw up the processor register and signed data-processing agreements for each real provider: PocketBase host/maintenance, backup disk, Cloudflare/Turnstile and tunnel, SMTP, Google Maps, Zoom, Jitsi, Meta/Instagram and WhatsApp whenever they are enabled. Document any international transfer and the safeguard used.
5. Confirm retention periods per data set (contact requests, pupil records, attendance, coursework, files, payments, backups and audit logs), plus deletion/blocking procedures and backup expiry.
6. Decide in writing whether classes can be recorded. Keep recording disabled by default unless there is a documented purpose, lawful basis, notice, access control, retention period and safeguards for minors.
7. Set an internal rights-request process for access, correction, deletion, objection, restriction and portability, including identity verification and response deadlines. Publish the contact route in the privacy policy.
8. If invoices are issued, use an invoicing process that complies with the applicable tax rules. A platform payment receipt is not an invoice.

## Official references checked

- LSSI-CE, article 10: identity, contact, registry/authorisation information where applicable, NIF and clear price/tax information must be permanently, easily and freely accessible: https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758
- AEPD cookie guide: reject must be as accessible as accept, choices require information before optional technologies are used, and a 24-month validity is good practice: https://www.aepd.es/guias/guia-cookies.pdf
- AEPD on minors: consent-based processing for a child under 14 needs the holder of parental authority or guardianship: https://www.aepd.es/preguntas-frecuentes/10-menores-y-educacion/FAQ-1001-cual-es-la-edad-para-que-los-menores-puedan-prestar-consentimiento-para-tratar-sus-datos-personales
- Ministry of Consumer Affairs: distance contracts normally carry a 14-day withdrawal right, subject to statutory exceptions and specific express acknowledgements for certain digital content/services: https://portal-cec.consumo.gob.es/es/informacion-general/compras-online/devoluciones
