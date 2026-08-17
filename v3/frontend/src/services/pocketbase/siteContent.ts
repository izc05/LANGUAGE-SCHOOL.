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
  mediaId: string
}

export type HomeVisualContent = {
  kidsMediaId: string
  teensMediaId: string
  universityMediaId: string
  adultsMediaId: string
  examsMediaId: string
  methodMediaId: string
  journalMediaId: string
}

export type HomePageContent = {
  hero: HomeHeroContent
  visuals: HomeVisualContent
}

export type AboutValue = {
  title: string
  text: string
}

export type AboutPageContent = {
  eyebrow: string
  title: string
  intro: string
  storyTitle: string
  storyParagraphs: string[]
  values: AboutValue[]
  closingTitle: string
  closingText: string
}

export type SitePageRecord = RecordModel & {
  key: string
  title: string
  content: unknown
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
}

const emptyHomeVisuals: HomeVisualContent = {
  kidsMediaId: '',
  teensMediaId: '',
  universityMediaId: '',
  adultsMediaId: '',
  examsMediaId: '',
  methodMediaId: '',
  journalMediaId: '',
}

export const demoHomeContent: HomePageContent = {
  hero: {
    eyebrow: 'ACADEMIA DE INGLÉS · JÓDAR',
    title: 'Tu inglés no necesita más teoría. Necesita confianza.',
    subtitle:
      'Clases cercanas, objetivos claros y una plataforma propia para que cada alumno tenga sus recursos, tareas y seguimiento siempre disponibles.',
    primaryCta: 'Descubrir programas',
    secondaryCta: 'Entrar a mi espacio',
    mediaId: '',
  },
  visuals: { ...emptyHomeVisuals },
}

export const demoAboutContent: AboutPageContent = {
  eyebrow: 'SOBRE LANGUAGE SCHOOL',
  title: 'Una academia cercana para aprender y usar el idioma con confianza.',
  intro: 'Clases presenciales y online con acompañamiento, objetivos claros y recursos que continúan disponibles entre sesiones.',
  storyTitle: 'Aprender no debería sentirse como memorizar por memorizar.',
  storyParagraphs: [
    'Nuestro enfoque busca que cada alumno entienda qué está trabajando, por qué lo trabaja y cómo llevarlo a situaciones reales.',
    'La plataforma digital complementa las clases con materiales, tareas, avisos y seguimiento en un espacio privado para cada alumno.',
  ],
  values: [
    { title: 'Cercanía', text: 'Seguimiento humano y comunicación clara durante todo el proceso.' },
    { title: 'Práctica útil', text: 'El idioma se trabaja para comprenderlo, hablarlo y utilizarlo fuera del aula.' },
    { title: 'Continuidad', text: 'La clase no termina al salir: materiales y tareas siguen accesibles en el espacio del alumno.' },
  ],
  closingTitle: 'Tu objetivo marca el camino.',
  closingText: 'Cuéntanos qué necesitas y te orientaremos hacia el programa más adecuado.',
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function stringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback
  const result = value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
  return result.length > 0 ? result : fallback
}

function visualId(raw: Record<string, unknown>, key: keyof HomeVisualContent): string {
  const value = raw[key]
  return isString(value) ? value.trim() : ''
}

export function normalizeHomeContent(value: unknown): HomePageContent {
  if (!value || typeof value !== 'object') return demoHomeContent

  const raw = value as { hero?: unknown; visuals?: unknown }
  const rawHero = raw.hero
  if (!rawHero || typeof rawHero !== 'object') return demoHomeContent

  const hero = rawHero as Partial<Record<keyof HomeHeroContent, unknown>>
  const rawVisuals = raw.visuals && typeof raw.visuals === 'object' ? raw.visuals as Record<string, unknown> : {}

  return {
    hero: {
      eyebrow: isString(hero.eyebrow) && hero.eyebrow.trim() ? hero.eyebrow : demoHomeContent.hero.eyebrow,
      title: isString(hero.title) && hero.title.trim() ? hero.title : demoHomeContent.hero.title,
      subtitle: isString(hero.subtitle) && hero.subtitle.trim() ? hero.subtitle : demoHomeContent.hero.subtitle,
      primaryCta: isString(hero.primaryCta) && hero.primaryCta.trim() ? hero.primaryCta : demoHomeContent.hero.primaryCta,
      secondaryCta: isString(hero.secondaryCta) && hero.secondaryCta.trim() ? hero.secondaryCta : demoHomeContent.hero.secondaryCta,
      mediaId: isString(hero.mediaId) ? hero.mediaId.trim() : '',
    },
    visuals: {
      kidsMediaId: visualId(rawVisuals, 'kidsMediaId'),
      teensMediaId: visualId(rawVisuals, 'teensMediaId'),
      universityMediaId: visualId(rawVisuals, 'universityMediaId'),
      adultsMediaId: visualId(rawVisuals, 'adultsMediaId'),
      examsMediaId: visualId(rawVisuals, 'examsMediaId'),
      methodMediaId: visualId(rawVisuals, 'methodMediaId'),
      journalMediaId: visualId(rawVisuals, 'journalMediaId'),
    },
  }
}

export function normalizeAboutContent(value: unknown): AboutPageContent {
  if (!value || typeof value !== 'object') return demoAboutContent
  const raw = value as Record<string, unknown>

  const rawValues = Array.isArray(raw.values) ? raw.values : []
  const values = rawValues
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      title: isString(item.title) ? item.title.trim() : '',
      text: isString(item.text) ? item.text.trim() : '',
    }))
    .filter((item) => item.title && item.text)

  return {
    eyebrow: isString(raw.eyebrow) && raw.eyebrow.trim() ? raw.eyebrow : demoAboutContent.eyebrow,
    title: isString(raw.title) && raw.title.trim() ? raw.title : demoAboutContent.title,
    intro: isString(raw.intro) && raw.intro.trim() ? raw.intro : demoAboutContent.intro,
    storyTitle: isString(raw.storyTitle) && raw.storyTitle.trim() ? raw.storyTitle : demoAboutContent.storyTitle,
    storyParagraphs: stringArray(raw.storyParagraphs, demoAboutContent.storyParagraphs),
    values: values.length > 0 ? values : demoAboutContent.values,
    closingTitle: isString(raw.closingTitle) && raw.closingTitle.trim() ? raw.closingTitle : demoAboutContent.closingTitle,
    closingText: isString(raw.closingText) && raw.closingText.trim() ? raw.closingText : demoAboutContent.closingText,
  }
}

export async function getSitePage(key: string): Promise<SitePageRecord> {
  const safeKey = key.trim().toLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(safeKey)) throw new Error('Clave de página no válida.')
  return pb.collection(collections.sitePages).getFirstListItem<SitePageRecord>(`key = "${safeKey}"`)
}

export async function getPublishedHomeContent(): Promise<HomePageContent> {
  if (isDemoMode) return demoHomeContent
  const page = await pb.collection(collections.sitePages).getFirstListItem<SitePageRecord>('key = "home" && status = "PUBLISHED"')
  return normalizeHomeContent(page.content)
}

export async function getEditableHomeContent(): Promise<{ content: HomePageContent; status: SitePageRecord['status'] }> {
  if (isDemoMode) return { content: demoHomeContent, status: 'DRAFT' }
  const page = await getSitePage('home')
  return { content: normalizeHomeContent(page.content), status: page.status }
}

export async function saveHomeContent(content: HomePageContent, publish = true): Promise<SitePageRecord> {
  const current = await getSitePage('home')
  return pb.collection(collections.sitePages).update<SitePageRecord>(current.id, {
    title: current.title || 'Inicio',
    content,
    status: publish ? 'PUBLISHED' : 'DRAFT',
  })
}

export async function getPublishedAboutContent(): Promise<AboutPageContent> {
  if (isDemoMode) return demoAboutContent
  const page = await pb.collection(collections.sitePages).getFirstListItem<SitePageRecord>('key = "about" && status = "PUBLISHED"')
  return normalizeAboutContent(page.content)
}

export async function getEditableAboutContent(): Promise<{ content: AboutPageContent; status: SitePageRecord['status'] }> {
  if (isDemoMode) return { content: demoAboutContent, status: 'DRAFT' }
  const page = await getSitePage('about')
  return { content: normalizeAboutContent(page.content), status: page.status }
}

export async function saveAboutContent(content: AboutPageContent, publish = true): Promise<SitePageRecord> {
  const current = await getSitePage('about')
  return pb.collection(collections.sitePages).update<SitePageRecord>(current.id, {
    title: current.title || 'Sobre nosotros',
    content,
    status: publish ? 'PUBLISHED' : 'DRAFT',
  })
}
