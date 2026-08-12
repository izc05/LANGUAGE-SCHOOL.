import type { RecordModel } from 'pocketbase'
import { isDemoMode } from '../../config/environment'
import { collections } from './collections'
import { pb } from './client'
import { demoSiteSettings, type SiteSettingsInput, type SiteSettingsRecord } from './siteManagement'

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

function normalizeFeatures(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

export async function listPublicCourses(): Promise<PublicCourseRecord[]> {
  if (isDemoMode) return demoPublicCourses
  return pb.collection(collections.courses).getFullList<PublicCourseRecord>({
    filter: 'public_visible = true && status = "ACTIVE"',
    sort: 'title',
  })
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
  if (!record) return { ...demoSiteSettings, logoUrl: '' }

  return {
    academyName: record.academy_name || demoSiteSettings.academyName,
    phone: record.phone || '',
    email: record.email || '',
    whatsapp: record.whatsapp || '',
    address: record.address || '',
    instagram: record.social_links?.instagram || '',
    facebook: record.social_links?.facebook || '',
    youtube: record.social_links?.youtube || '',
    logoUrl: record.logo ? pb.files.getURL(record, record.logo, { thumb: '160x160' }) : '',
  }
}

export async function submitContactRequest(input: {
  name: string
  email: string
  phone: string
  interest: string
  message: string
}): Promise<void> {
  if (isDemoMode) return
  await pb.collection(collections.contactRequests).create({
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    interest: input.interest.trim(),
    message: input.message.trim(),
    status: 'NEW',
  })
}
