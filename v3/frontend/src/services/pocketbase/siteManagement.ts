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
  address: string
  instagram: string
  facebook: string
  youtube: string
}

export const demoPricingPlans: PricingPlanRecord[] = [
  {
    id: 'demo-starter',
    collectionId: 'demo',
    collectionName: collections.pricingPlans,
    created: '',
    updated: '',
    expand: {},
    name: 'Starter',
    description: 'Plan de demostración para visualizar el CMS.',
    price: 35,
    billing_text: 'al mes',
    features: ['Clases en grupo', 'Material de apoyo'],
    sort_order: 10,
    active: true,
    featured: false,
  },
  {
    id: 'demo-plus',
    collectionId: 'demo',
    collectionName: collections.pricingPlans,
    created: '',
    updated: '',
    expand: {},
    name: 'Plus',
    description: 'Plan destacado de demostración.',
    price: 49,
    billing_text: 'al mes',
    features: ['Clases en grupo', 'Material de apoyo', 'Seguimiento'],
    sort_order: 20,
    active: true,
    featured: true,
  },
]

export const demoSiteSettings: SiteSettingsInput = {
  academyName: 'Language School',
  phone: '',
  email: '',
  whatsapp: '',
  address: 'Jódar, Jaén',
  instagram: 'https://www.instagram.com/languageschool_rociuruiz/',
  facebook: '',
  youtube: '',
}

function requireAdmin() {
  if (isDemoMode) return
  const record = pb.authStore.record
  if (!record || record.role !== 'ADMIN') {
    throw new Error('Se requiere una sesión ADMIN.')
  }
}

function normalizeFeatures(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

export async function listPricingPlans(): Promise<PricingPlanRecord[]> {
  if (isDemoMode) return demoPricingPlans
  requireAdmin()
  const records = await pb.collection(collections.pricingPlans).getFullList<PricingPlanRecord>({
    sort: 'sort_order,name',
  })
  return records.map((record) => ({ ...record, features: normalizeFeatures(record.features) }))
}

export async function createPricingPlan(input: PricingPlanInput): Promise<PricingPlanRecord> {
  requireAdmin()
  return pb.collection(collections.pricingPlans).create<PricingPlanRecord>({
    name: input.name.trim(),
    description: input.description.trim(),
    price: input.price,
    billing_text: input.billingText.trim(),
    features: input.features.map((item) => item.trim()).filter(Boolean),
    sort_order: input.sortOrder,
    active: input.active,
    featured: input.featured,
  })
}

export async function updatePricingPlan(id: string, input: PricingPlanInput): Promise<PricingPlanRecord> {
  requireAdmin()
  return pb.collection(collections.pricingPlans).update<PricingPlanRecord>(id, {
    name: input.name.trim(),
    description: input.description.trim(),
    price: input.price,
    billing_text: input.billingText.trim(),
    features: input.features.map((item) => item.trim()).filter(Boolean),
    sort_order: input.sortOrder,
    active: input.active,
    featured: input.featured,
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

export async function saveSiteSettings(
  input: SiteSettingsInput,
  logo?: File | null,
): Promise<SiteSettingsRecord> {
  requireAdmin()

  const current = await getSiteSettings()
  const payload = new FormData()
  payload.set('academy_name', input.academyName.trim())
  payload.set('phone', input.phone.trim())
  payload.set('email', input.email.trim())
  payload.set('whatsapp', input.whatsapp.trim())
  payload.set('address', input.address.trim())
  payload.set('social_links', JSON.stringify({
    instagram: input.instagram.trim(),
    facebook: input.facebook.trim(),
    youtube: input.youtube.trim(),
  }))
  payload.set('legal_texts', JSON.stringify(current?.legal_texts ?? {}))
  if (logo) payload.set('logo', logo)

  if (current) {
    return pb.collection(collections.siteSettings).update<SiteSettingsRecord>(current.id, payload)
  }

  return pb.collection(collections.siteSettings).create<SiteSettingsRecord>(payload)
}

export function settingsToInput(record: SiteSettingsRecord | null): SiteSettingsInput {
  if (!record) return demoSiteSettings
  return {
    academyName: record.academy_name || demoSiteSettings.academyName,
    phone: record.phone || '',
    email: record.email || '',
    whatsapp: record.whatsapp || '',
    address: record.address || '',
    instagram: record.social_links?.instagram || '',
    facebook: record.social_links?.facebook || '',
    youtube: record.social_links?.youtube || '',
  }
}
