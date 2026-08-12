import type { RecordModel } from 'pocketbase'
import { isDemoMode } from '../../config/environment'
import { collections } from './collections'
import { pb } from './client'

export type HomeHeroContent = {
  eyebrow: string
  title: string
  subtitle: string
  primaryCta: string
  secondaryCta: string
}

export type HomePageContent = {
  hero: HomeHeroContent
}

export type SitePageRecord = RecordModel & {
  key: string
  title: string
  content: unknown
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
}

export const demoHomeContent: HomePageContent = {
  hero: {
    eyebrow: 'ACADEMIA DE INGLÉS · JÓDAR',
    title: 'Tu inglés no necesita más teoría. Necesita confianza.',
    subtitle:
      'Clases cercanas, objetivos claros y una plataforma propia para que cada alumno tenga sus recursos, tareas y seguimiento siempre disponibles.',
    primaryCta: 'Descubrir programas',
    secondaryCta: 'Entrar a mi espacio',
  },
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export function normalizeHomeContent(value: unknown): HomePageContent {
  if (!value || typeof value !== 'object') return demoHomeContent

  const rawHero = (value as { hero?: unknown }).hero
  if (!rawHero || typeof rawHero !== 'object') return demoHomeContent

  const hero = rawHero as Partial<Record<keyof HomeHeroContent, unknown>>

  return {
    hero: {
      eyebrow: isString(hero.eyebrow) && hero.eyebrow.trim() ? hero.eyebrow : demoHomeContent.hero.eyebrow,
      title: isString(hero.title) && hero.title.trim() ? hero.title : demoHomeContent.hero.title,
      subtitle: isString(hero.subtitle) && hero.subtitle.trim() ? hero.subtitle : demoHomeContent.hero.subtitle,
      primaryCta:
        isString(hero.primaryCta) && hero.primaryCta.trim() ? hero.primaryCta : demoHomeContent.hero.primaryCta,
      secondaryCta:
        isString(hero.secondaryCta) && hero.secondaryCta.trim()
          ? hero.secondaryCta
          : demoHomeContent.hero.secondaryCta,
    },
  }
}

export async function getSitePage(key: string): Promise<SitePageRecord> {
  const safeKey = key.trim().toLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(safeKey)) {
    throw new Error('Clave de página no válida.')
  }

  return pb
    .collection(collections.sitePages)
    .getFirstListItem<SitePageRecord>(`key = "${safeKey}"`)
}

export async function getPublishedHomeContent(): Promise<HomePageContent> {
  if (isDemoMode) return demoHomeContent

  const page = await pb
    .collection(collections.sitePages)
    .getFirstListItem<SitePageRecord>('key = "home" && status = "PUBLISHED"')

  return normalizeHomeContent(page.content)
}

export async function getEditableHomeContent(): Promise<{
  content: HomePageContent
  status: SitePageRecord['status']
}> {
  if (isDemoMode) {
    return { content: demoHomeContent, status: 'DRAFT' }
  }

  const page = await getSitePage('home')
  return {
    content: normalizeHomeContent(page.content),
    status: page.status,
  }
}

export async function saveHomeContent(content: HomePageContent, publish = true): Promise<SitePageRecord> {
  const current = await getSitePage('home')

  return pb.collection(collections.sitePages).update<SitePageRecord>(current.id, {
    title: current.title || 'Inicio',
    content,
    status: publish ? 'PUBLISHED' : 'DRAFT',
  })
}
