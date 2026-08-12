import type { RecordModel } from 'pocketbase'
import { collections } from './collections'
import { pb } from './client'
import { getCurrentUser } from './auth'

export type BlogStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export type BlogCategoryRecord = RecordModel & {
  name: string
  slug: string
  description: string
  active: boolean
}

export type BlogPostRecord = RecordModel & {
  title: string
  slug: string
  excerpt: string
  content: string
  cover_image: string
  category: string
  author: string
  status: BlogStatus
  published_at: string
  seo_title: string
  seo_description: string
  expand?: {
    category?: BlogCategoryRecord
  }
}

export type SaveBlogPostInput = {
  title: string
  slug?: string
  excerpt?: string
  content: string
  category?: string
  coverImage?: File
  status: BlogStatus
  seoTitle?: string
  seoDescription?: string
}

export function slugifyBlogTitle(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 220)
}

export async function listPublishedBlogPosts(): Promise<BlogPostRecord[]> {
  return pb.collection(collections.blogPosts).getFullList<BlogPostRecord>({
    filter: 'status = "PUBLISHED"',
    sort: '-published_at',
    expand: 'category',
  })
}

export async function listAdminBlogPosts(): Promise<BlogPostRecord[]> {
  return pb.collection(collections.blogPosts).getFullList<BlogPostRecord>({
    sort: '-updated',
    expand: 'category',
  })
}

export async function listBlogCategories(): Promise<BlogCategoryRecord[]> {
  return pb.collection(collections.blogCategories).getFullList<BlogCategoryRecord>({
    filter: 'active = true',
    sort: 'name',
  })
}

export async function createBlogPost(input: SaveBlogPostInput): Promise<BlogPostRecord> {
  const currentUser = getCurrentUser()
  if (!currentUser) throw new Error('Debes iniciar sesión para crear artículos.')

  const slug = slugifyBlogTitle(input.slug || input.title)
  if (!slug) throw new Error('No se ha podido generar una URL válida para el artículo.')

  const data = new FormData()
  data.set('title', input.title.trim())
  data.set('slug', slug)
  data.set('excerpt', input.excerpt?.trim() || '')
  data.set('content', input.content)
  data.set('author', currentUser.id)
  data.set('status', input.status)
  data.set('seo_title', input.seoTitle?.trim() || '')
  data.set('seo_description', input.seoDescription?.trim() || '')

  if (input.category) data.set('category', input.category)
  if (input.coverImage) data.set('cover_image', input.coverImage)
  if (input.status === 'PUBLISHED') data.set('published_at', new Date().toISOString())

  return pb.collection(collections.blogPosts).create<BlogPostRecord>(data)
}

export async function updateBlogPost(id: string, input: SaveBlogPostInput): Promise<BlogPostRecord> {
  const slug = slugifyBlogTitle(input.slug || input.title)
  if (!slug) throw new Error('No se ha podido generar una URL válida para el artículo.')

  const data = new FormData()
  data.set('title', input.title.trim())
  data.set('slug', slug)
  data.set('excerpt', input.excerpt?.trim() || '')
  data.set('content', input.content)
  data.set('status', input.status)
  data.set('seo_title', input.seoTitle?.trim() || '')
  data.set('seo_description', input.seoDescription?.trim() || '')
  data.set('category', input.category || '')

  if (input.coverImage) data.set('cover_image', input.coverImage)
  if (input.status === 'PUBLISHED') data.set('published_at', new Date().toISOString())

  return pb.collection(collections.blogPosts).update<BlogPostRecord>(id, data)
}

export async function deleteBlogPost(id: string): Promise<boolean> {
  return pb.collection(collections.blogPosts).delete(id)
}

export function getBlogCoverUrl(record: BlogPostRecord, thumb = '600x400'): string {
  if (!record.cover_image) return ''
  return pb.files.getURL(record, record.cover_image, { thumb })
}
