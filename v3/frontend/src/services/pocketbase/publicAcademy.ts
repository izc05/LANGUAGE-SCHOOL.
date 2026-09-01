import type { RecordModel } from 'pocketbase'
import { isDemoMode } from '../../config/environment'
import { collections } from './collections'
import { pb } from './client'
import { defaultEnrollmentTermsText, demoSiteSettings, type SiteSettingsInput, type SiteSettingsRecord } from './siteManagement'

export type PublicCourseRecord = RecordModel & {
  title: string
  slug: string
  level: string
  description: string
  cover_image: string
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  public_visible: boolean
}

export type PublicPricingRecord = RecordModel & {
  name: string
  description: string
  price: number
  billing_text: string
  features: string[]
  sort_order: number
  active: boolean
  featured: boolean
}

export type PublicSettings = SiteSettingsInput & {
  logoUrl: string
}

export const demoPublicCourses: PublicCourseRecord[] = [
  { id: 'kids', collectionId: 'demo', collectionName: collections.courses, created: '', updated: '', expand: {}, title: 'Kids', slug: 'kids', level: '6–12 años', description: 'Vocabulario, comprensión, juegos guiados y speaking progresivo.', cover_image: '', status: 'ACTIVE', public_visible: true },
  { id: 'teens', collectionId: 'demo', collectionName: collections.courses, created: '', updated: '', expand: {}, title: 'Teens', slug: 'teens', level: '13–17 años', description: 'Refuerzo, confianza al hablar y objetivos académicos claros.', cover_image: '', status: 'ACTIVE', public_visible: true },
  { id: 'adults', collectionId: 'demo', collectionName: collections.courses, created: '', updated: '', expand: {}, title: 'English for life', slug: 'english-for-life', level: 'Adultos', description: 'Inglés práctico para trabajo, viajes, conversación y desarrollo personal.', cover_image: '', status: 'ACTIVE', public_visible: true },
  { id: 'exams', collectionId: 'demo', collectionName: collections.courses, created: '', updated: '', expand: {}, title: 'Preparación de exámenes', slug: 'examenes', level: 'A2 · B1 · B2 · C1', description: 'Preparación por destrezas, simulacros y corrección personalizada.', cover_image: '', status: 'ACTIVE', public_visible: true },
]

export const demoPublicPricing: PublicPricingRecord[] = [
  { id: 'starter', collectionId: 'demo', collectionName: collections.pricingPlans, created: '', updated: '', expand: {}, name: 'Starter', description: 'Ejemplo visual. Precio definitivo pendiente de confirmar.', price: 35, billing_text: 'al mes', features: ['Clases en grupo', 'Material de apoyo'], sort_order: 10, active: true, featured: false },
  { id: 'plus', collectionId: 'demo', collectionName: collections.pricingPlans, created: '', updated: '', expand: {}, name: 'Plus', description: 'Ejemplo visual. Precio definitivo pendiente de confirmar.', price: 49, billing_text: 'al mes', features: ['Clases en grupo', 'Material', 'Seguimiento'], sort_order: 20, active: true, featured: true },
]

export const connectedPublicSettingsFallback: PublicSettings = {
  academyName: 'Language School',
  phone: '',
  email: '',
  whatsapp: '',
  whatsappEnabled: false,
  whatsappMessage: '',
  address: '',
  instagram: '',
  facebook: '',
  youtube: '',
  cookieBannerEnabled: true,
  cookieIntro: 'Usamos almacenamiento técnico necesario para que la web funcione correctamente. Puedes configurar las preferencias opcionales cuando estén disponibles.',
  legalOwnerName: '',
  legalTaxId: '',
  legalRegistryDetails: '',
  cookiePolicyText: '',
  privacyPolicyText: '',
  legalNoticeText: '',
  enrollmentTermsText: defaultEnrollmentTermsText,
  logoUrl: '',
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

export function getPublicCourseCoverUrl(course: PublicCourseRecord, thumb = '1200x800'): string {
  if (!course.cover_image || isDemoMode) return ''
  return pb.files.getURL(course, course.cover_image, { thumb })
}

export async function listPublicCourses(): Promise<PublicCourseRecord[]> {
  if (isDemoMode) return demoPublicCourses
  return pb.collection(collections.courses).getFullList<PublicCourseRecord>({
    filter: 'public_visible = true && status = "ACTIVE"',
    sort: 'title',
  })
}

export async function getPublicCourseBySlug(slug: string): Promise<PublicCourseRecord | null> {
  const normalizedSlug = slug.trim().toLowerCase()
  if (!normalizedSlug) return null
  const courses = await listPublicCourses()
  return courses.find((course) => course.slug.trim().toLowerCase() === normalizedSlug) ?? null
}

export async function listPublicPricing(): Promise<PublicPricingRecord[]> {
  if (isDemoMode) return demoPublicPricing
  const records = await pb.collection(collections.pricingPlans).getFullList<PublicPricingRecord>({
    filter: 'active = true',
    sort: 'sort_order,name',
  })
  return records.map((record) => ({ ...record, features: normalizeFeatures(record.features) }))
}

export async function getPublicSettings(): Promise<PublicSettings> {
  if (isDemoMode) return { ...demoSiteSettings, logoUrl: '' }
  const result = await pb.collection(collections.siteSettings).getList<SiteSettingsRecord>(1, 1)
  const record = result.items[0]
  if (!record) return { ...connectedPublicSettingsFallback }

  return {
    academyName: record.academy_name || connectedPublicSettingsFallback.academyName,
    phone: record.phone || '',
    email: record.email || '',
    whatsapp: record.whatsapp || '',
    whatsappEnabled: readBoolean(record.social_links?.whatsapp_enabled, false),
    whatsappMessage: record.social_links?.whatsapp_message || '',
    address: record.address || '',
    instagram: record.social_links?.instagram || '',
    facebook: record.social_links?.facebook || '',
    youtube: record.social_links?.youtube || '',
    cookieBannerEnabled: readBoolean(record.legal_texts?.cookie_banner_enabled, true),
    cookieIntro: record.legal_texts?.cookie_intro || connectedPublicSettingsFallback.cookieIntro,
    legalOwnerName: record.legal_texts?.legal_owner_name || '',
    legalTaxId: record.legal_texts?.legal_tax_id || '',
    legalRegistryDetails: record.legal_texts?.legal_registry_details || '',
    cookiePolicyText: record.legal_texts?.cookie_policy || '',
    privacyPolicyText: record.legal_texts?.privacy_policy || '',
    legalNoticeText: record.legal_texts?.legal_notice || '',
    enrollmentTermsText: record.legal_texts?.enrollment_terms || defaultEnrollmentTermsText,
    logoUrl: record.logo ? pb.files.getURL(record, record.logo, { thumb: '160x160' }) : '',
  }
}

export async function submitContactRequest(input: {
  name: string
  email: string
  phone: string
  interest: string
  message: string
  website: string
  turnstileToken: string
}): Promise<void> {
  if (isDemoMode) return
  await pb.send('/api/language-school/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: input.name.trim(),
      email: input.email.trim(),
      phone: input.phone.trim(),
      interest: input.interest.trim(),
      message: input.message.trim(),
      website: input.website.trim(),
      turnstileToken: input.turnstileToken,
    }),
  })
}
