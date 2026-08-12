import type { RecordModel } from 'pocketbase'
import { collections } from './collections'
import { pb } from './client'
import { getCurrentUser } from './auth'

export type MediaUsage = 'WEBSITE' | 'BLOG' | 'INTERNAL'
export type MediaType = 'IMAGE' | 'DOCUMENT'

export type MediaRecord = RecordModel & {
  title: string
  file: string
  alt_text: string
  media_type: MediaType
  usage: MediaUsage
  uploaded_by: string
}

export type CreateMediaInput = {
  title: string
  file: File
  altText?: string
  usage: MediaUsage
  mediaType?: MediaType
}

export async function listMedia(usage?: MediaUsage): Promise<MediaRecord[]> {
  const filter = usage ? `usage = "${usage}"` : ''
  return pb.collection(collections.mediaLibrary).getFullList<MediaRecord>({
    filter,
    sort: '-created',
  })
}

export async function createMedia(input: CreateMediaInput): Promise<MediaRecord> {
  const currentUser = getCurrentUser()
  if (!currentUser) throw new Error('Debes iniciar sesión para subir archivos.')

  const data = new FormData()
  data.set('title', input.title.trim())
  data.set('file', input.file)
  data.set('alt_text', input.altText?.trim() || '')
  data.set('media_type', input.mediaType || 'IMAGE')
  data.set('usage', input.usage)
  data.set('uploaded_by', currentUser.id)

  return pb.collection(collections.mediaLibrary).create<MediaRecord>(data)
}

export async function updateMediaMetadata(
  id: string,
  input: Pick<CreateMediaInput, 'title' | 'altText' | 'usage'>,
): Promise<MediaRecord> {
  return pb.collection(collections.mediaLibrary).update<MediaRecord>(id, {
    title: input.title.trim(),
    alt_text: input.altText?.trim() || '',
    usage: input.usage,
  })
}

export async function deleteMedia(id: string): Promise<boolean> {
  return pb.collection(collections.mediaLibrary).delete(id)
}

export function getMediaUrl(record: MediaRecord, thumb?: string): string {
  if (!record.file) return ''
  return pb.files.getURL(record, record.file, thumb ? { thumb } : undefined)
}
