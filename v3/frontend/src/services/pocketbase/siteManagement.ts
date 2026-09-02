import type { RecordModel } from 'pocketbase'
import { isDemoMode } from '../../config/environment'
import { collections } from './collections'
import { pb } from './client'

export type PricingPlanRecord = RecordModel & {
  name: string
  description: string
  price: number
  billing_text: string
  features: string[]
  sort_order: number
  active: boolean
  featured: boolean
}

export type SiteSettingsRecord = RecordModel & {
  academy_name: string
  logo: string
  phone: string
  email: string
  whatsapp: string
  address: string
  social_links: Record<string, string>
  legal_texts: Record<string, string>
}

export type PricingPlanInput = {
  name: string
  description: string
  price: number
  billingText: string
  features: string[]
  sortOrder: number
  active: boolean
  featured: boolean
}

export type SiteSettingsInput = {
  academyName: string
  phone: string
  email: string
  whatsapp: string
  whatsappEnabled: boolean
  whatsappMessage: string
  address: string
  instagram: string
  facebook: string
  youtube: string
  cookieBannerEnabled: boolean
  cookieIntro: string
  legalOwnerName: string
  legalTaxId: string
  legalRegistryDetails: string
  cookiePolicyText: string
  privacyPolicyText: string
  legalNoticeText: string
  enrollmentTermsText: string
}

export const defaultEnrollmentTermsText = `La información de programas y tarifas de esta web es orientativa y no constituye por sí sola una matrícula ni un cobro online. La matrícula se formaliza cuando la academia confirma por escrito la plaza, el grupo, el horario, el precio total y las condiciones aplicables.

Antes de formalizarla se facilitarán las condiciones concretas del programa, incluidos duración, calendario, materiales, forma y fechas de pago. Cualquier cambio de grupo, horario o recuperación de clase se valorará según disponibilidad y se confirmará con la academia.

Las solicitudes de baja, cancelación o modificación deben comunicarse por escrito a la academia. La confirmación de matrícula indicará, cuando proceda, las condiciones económicas aplicables a cada caso.

El acceso al área privada, las videoclases y los materiales es personal y se limita al alumno matriculado. No se permite compartir credenciales, enlaces de clase o materiales sin autorización. Las clases no se graban salvo información previa y autorización cuando resulte necesaria.

Cuando el alumno sea menor, la matrícula y las autorizaciones necesarias serán gestionadas por su padre, madre o representante legal. Para consultas, incidencias o reclamaciones, utiliza los canales de contacto publicados por la academia.`

export const demoPricingPlans: PricingPlanRecord[] = [
  {
    id: 'demo-starter', collectionId: 'demo', collectionName: collections.pricingPlans, created: '', updated: '', expand: {},
    name: 'Starter', description: 'Plan de demostración para visualizar el CMS.', price: 35, billing_text: 'al mes',
    features: ['Clases en grupo', 'Material de apoyo'], sort_order: 10, active: true, featured: false,
  },
  {
    id: 'demo-plus', collectionId: 'demo', collectionName: collections.pricingPlans, created: '', updated: '', expand: {},
    name: 'Plus', description: 'Plan destacado de demostración.', price: 49, billing_text: 'al mes',
    features: ['Clases en grupo', 'Material de apoyo', 'Seguimiento'], sort_order: 20, active: true, featured: true,
  },
]

export const demoSiteSettings: SiteSettingsInput = {
  academyName: 'Language School',
  phone: '',
  email: '',
  whatsapp: '',
  whatsappEnabled: true,
  whatsappMessage: 'Hola, quiero información sobre las clases de inglés.',
  address: 'Calle Luis Carvajal, 23, Jódar, Jaén',
  instagram: 'https://www.instagram.com/languageschool_rocioruiz/',
  facebook: '',
  youtube: '',
  cookieBannerEnabled: true,
  cookieIntro: 'Usamos almacenamiento técnico necesario y, solo si lo autorizas, preferencias para cargar servicios externos como Google Maps. Puedes aceptar, rechazar o configurar tus preferencias.',
  legalOwnerName: '',
  legalTaxId: '',
  legalRegistryDetails: '',
  cookiePolicyText: '',
  privacyPolicyText: '',
  legalNoticeText: '',
  enrollmentTermsText: defaultEnrollmentTermsText,
}

function requireAdmin() {
  if (isDemoMode) return
  const record = pb.authStore.record
  if (!record || record.role !== 'ADMIN') throw new Error('Se requiere una sesión ADMIN.')
}

function normalizeFeatures(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return fallback
  if (value.toLowerCase() === 'true') return true
  if (value.toLowerCase() === 'false') return false
  return fallback
}

export async function listPricingPlans(): Promise<PricingPlanRecord[]> {
  if (isDemoMode) return demoPricingPlans
  requireAdmin()
  const records = await pb.collection(collections.pricingPlans).getFullList<PricingPlanRecord>({ sort: 'sort_order,name' })
  return records.map((record) => ({ ...record, features: normalizeFeatures(record.features) }))
}

export async function createPricingPlan(input: PricingPlanInput): Promise<PricingPlanRecord> {
  requireAdmin()
  return pb.collection(collections.pricingPlans).create<PricingPlanRecord>({
    name: input.name.trim(), description: input.description.trim(), price: input.price, billing_text: input.billingText.trim(),
    features: input.features.map((item) => item.trim()).filter(Boolean), sort_order: input.sortOrder, active: input.active, featured: input.featured,
  })
}

export async function updatePricingPlan(id: string, input: PricingPlanInput): Promise<PricingPlanRecord> {
  requireAdmin()
  return pb.collection(collections.pricingPlans).update<PricingPlanRecord>(id, {
    name: input.name.trim(), description: input.description.trim(), price: input.price, billing_text: input.billingText.trim(),
    features: input.features.map((item) => item.trim()).filter(Boolean), sort_order: input.sortOrder, active: input.active, featured: input.featured,
  })
}

export async function deletePricingPlan(id: string): Promise<void> {
  requireAdmin()
  await pb.collection(collections.pricingPlans).delete(id)
}

export async function getSiteSettings(): Promise<SiteSettingsRecord | null> {
  if (isDemoMode) return null
  requireAdmin()
  const result = await pb.collection(collections.siteSettings).getList<SiteSettingsRecord>(1, 1)
  return result.items[0] ?? null
}

export async function saveSiteSettings(input: SiteSettingsInput, logo?: File | null): Promise<SiteSettingsRecord> {
  requireAdmin()
  const current = await getSiteSettings()
  const payload = new FormData()
  payload.set('academy_name', input.academyName.trim())
  payload.set('phone', input.phone.trim())
  payload.set('email', input.email.trim())
  payload.set('whatsapp', input.whatsapp.trim())
  payload.set('address', input.address.trim())
  payload.set('social_links', JSON.stringify({
    ...(current?.social_links ?? {}),
    instagram: input.instagram.trim(),
    facebook: input.facebook.trim(),
    youtube: input.youtube.trim(),
    whatsapp_enabled: String(input.whatsappEnabled),
    whatsapp_message: input.whatsappMessage.trim(),
  }))
  payload.set('legal_texts', JSON.stringify({
    ...(current?.legal_texts ?? {}),
    cookie_banner_enabled: String(input.cookieBannerEnabled),
    cookie_intro: input.cookieIntro.trim(),
    legal_owner_name: input.legalOwnerName.trim(),
    legal_tax_id: input.legalTaxId.trim(),
    legal_registry_details: input.legalRegistryDetails.trim(),
    cookie_policy: input.cookiePolicyText.trim(),
    privacy_policy: input.privacyPolicyText.trim(),
    legal_notice: input.legalNoticeText.trim(),
    enrollment_terms: input.enrollmentTermsText.trim(),
  }))
  if (logo) payload.set('logo', logo)

  if (current) return pb.collection(collections.siteSettings).update<SiteSettingsRecord>(current.id, payload)
  return pb.collection(collections.siteSettings).create<SiteSettingsRecord>(payload)
}

export function settingsToInput(record: SiteSettingsRecord | null): SiteSettingsInput {
  if (!record) return demoSiteSettings
  return {
    academyName: record.academy_name || demoSiteSettings.academyName,
    phone: record.phone || '',
    email: record.email || '',
    whatsapp: record.whatsapp || '',
    whatsappEnabled: readBoolean(record.social_links?.whatsapp_enabled, true),
    whatsappMessage: record.social_links?.whatsapp_message || demoSiteSettings.whatsappMessage,
    address: record.address || '',
    instagram: record.social_links?.instagram || '',
    facebook: record.social_links?.facebook || '',
    youtube: record.social_links?.youtube || '',
    cookieBannerEnabled: readBoolean(record.legal_texts?.cookie_banner_enabled, true),
    cookieIntro: record.legal_texts?.cookie_intro || demoSiteSettings.cookieIntro,
    legalOwnerName: record.legal_texts?.legal_owner_name || '',
    legalTaxId: record.legal_texts?.legal_tax_id || '',
    legalRegistryDetails: record.legal_texts?.legal_registry_details || '',
    cookiePolicyText: record.legal_texts?.cookie_policy || '',
    privacyPolicyText: record.legal_texts?.privacy_policy || '',
    legalNoticeText: record.legal_texts?.legal_notice || '',
    enrollmentTermsText: record.legal_texts?.enrollment_terms || defaultEnrollmentTermsText,
  }
}
