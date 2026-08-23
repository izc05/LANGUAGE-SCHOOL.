import { type ChangeEvent, useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import { isDemoMode } from '../../config/environment'
import {
  createBlogPost,
  deleteBlogPost,
  getBlogMediaItems,
  listAdminBlogPosts,
  listBlogCategories,
  updateBlogPost,
  type BlogCategoryRecord,
  type BlogPostRecord,
  type BlogStatus,
} from '../../services/pocketbase/blog'
import { normalizeInstagramPublicPostUrl } from '../../utils/instagram'
import { adminNav } from './adminNav'

type PostItem = {
  id: string
  title: string
  category: string
  status: BlogStatus
  updated: string
  record?: BlogPostRecord
}

const demoCategories = [
  { id: 'speaking', name: 'Speaking' },
  { id: 'vocabulary', name: 'Vocabulary' },
  { id: 'grammar', name: 'Grammar' },
  { id: 'exams', name: 'Exams' },
  { id: 'kids', name: 'Kids' },
  { id: 'academia', name: 'Academia' },
]

const initialPosts: PostItem[] = [
  { id: 'demo-1', title: '5 formas de ganar confianza al hablar', category: 'Speaking', status: 'PUBLISHED', updated: 'Hoy' },
  { id: 'demo-2', title: 'Guía B1 para septiembre', category: 'Exams', status: 'DRAFT', updated: 'Ayer' },
  { id: 'demo-3', title: 'Vocabulario sin listas infinitas', category: 'Vocabulary', status: 'PUBLISHED', updated: 'Hace 4 días' },
]

const MAX_BLOG_MEDIA_FILES = 12
const MAX_BLOG_MEDIA_FILE_BYTES = 50 * 1024 * 1024
const MAX_BLOG_MEDIA_UPLOAD_BYTES = 70 * 1024 * 1024
const BLOG_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'])

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function statusLabel(status: BlogStatus): string {
  if (status === 'PUBLISHED') return 'Publicado'
  if (status === 'ARCHIVED') return 'Archivado'
  return 'Borrador'
}

function statusClass(status: BlogStatus): string {
  return status === 'PUBLISHED' ? 'published' : 'draft'
}

function recordToPost(record: BlogPostRecord): PostItem {
  return {
    id: record.id,
    title: record.title,
    category: record.expand?.category?.name || 'Sin categoría',
    status: record.status,
    updated: record.updated ? new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(new Date(record.updated)) : 'Ahora',
    record,
  }
}

export default function AdminBlogManager() {
  const [posts, setPosts] = useState<PostItem[]>(isDemoMode ? initialPosts : [])
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>(isDemoMode ? demoCategories : [])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')
  const [coverImage, setCoverImage] = useState<File | null>(null)
  const [coverImageName, setCoverImageName] = useState('Sin imagen nueva')
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const [existingMedia, setExistingMedia] = useState<string[]>([])
  const [removedMedia, setRemovedMedia] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!isDemoMode)
  const [saving, setSaving] = useState(false)

  async function reloadConnectedData() {
    const [postRecords, categoryRecords] = await Promise.all([
      listAdminBlogPosts(),
      listBlogCategories(),
    ])
    setPosts(postRecords.map(recordToPost))
    setCategories(categoryRecords.map((item: BlogCategoryRecord) => ({ id: item.id, name: item.name })))
    setCategory((current) => current || categoryRecords[0]?.id || '')
  }

  useEffect(() => {
    if (isDemoMode) {
      setCategory(demoCategories[0].id)
      return
    }

    let mounted = true
    reloadConnectedData()
      .catch(() => {
        if (mounted) setError('No se han podido cargar los artículos o las categorías. Inténtalo de nuevo.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  const stats = useMemo(() => ({
    published: posts.filter((post) => post.status === 'PUBLISHED').length,
    drafts: posts.filter((post) => post.status === 'DRAFT').length,
  }), [posts])

  const editingRecord = useMemo(
    () => posts.find((post) => post.id === editingId)?.record,
    [editingId, posts],
  )
  const existingMediaItems = useMemo(
    () => editingRecord ? getBlogMediaItems(editingRecord).filter((item) => existingMedia.includes(item.name)) : [],
    [editingRecord, existingMedia],
  )

  function resetEditor() {
    setEditingId(null)
    setTitle('')
    setSummary('')
    setContent('')
    setCoverImage(null)
    setCoverImageName('Sin imagen nueva')
    setMediaFiles([])
    setExistingMedia([])
    setRemovedMedia([])
    setCategory(categories[0]?.id || '')
  }

  function beginEdit(post: PostItem) {
    setMessage(null)
    setError(null)
    setEditingId(post.id)
    setTitle(post.record?.title || post.title)
    setSummary(post.record?.excerpt || '')
    setContent(post.record?.content || '')
    setCategory(post.record?.category || categories.find((item) => item.name === post.category)?.id || categories[0]?.id || '')
    setCoverImage(null)
    setCoverImageName(post.record?.cover_image ? `Actual: ${post.record.cover_image}` : 'Sin imagen actual')
    setMediaFiles([])
    setExistingMedia(post.record?.media || [])
    setRemovedMedia([])
  }

  function handleCoverImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null
    setCoverImage(file)
    setCoverImageName(file?.name || 'Sin imagen nueva')
  }

  function handleMediaFiles(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files || [])
    event.target.value = ''
    if (selectedFiles.length === 0) return

    const invalidFile = selectedFiles.find((file) => !BLOG_MEDIA_TYPES.has(file.type))
    if (invalidFile) {
      setError(`“${invalidFile.name}” no es compatible. Usa JPG, PNG, WebP, MP4 o WebM.`)
      return
    }

    const oversizedFile = selectedFiles.find((file) => file.size > MAX_BLOG_MEDIA_FILE_BYTES)
    if (oversizedFile) {
      setError(`“${oversizedFile.name}” supera el máximo de 50 MB por archivo.`)
      return
    }

    if (existingMedia.length + mediaFiles.length + selectedFiles.length > MAX_BLOG_MEDIA_FILES) {
      setError(`Puedes incluir hasta ${MAX_BLOG_MEDIA_FILES} archivos multimedia por artículo.`)
      return
    }

    const selectedBytes = [...mediaFiles, ...selectedFiles].reduce((total, file) => total + file.size, 0)
    if (selectedBytes > MAX_BLOG_MEDIA_UPLOAD_BYTES) {
      setError('La selección nueva supera 70 MB. Reduce el vídeo o reparte las imágenes en otra carga.')
      return
    }

    setError(null)
    setMediaFiles((current) => [...current, ...selectedFiles])
  }

  function insertInstagramPost() {
    setMessage(null)
    const rawUrl = window.prompt('Pega la URL pública de la publicación o Reel de Instagram:')
    if (!rawUrl) return

    const instagramUrl = normalizeInstagramPublicPostUrl(rawUrl)
    if (!instagramUrl) {
      setError('La URL no parece una publicación o Reel público de Instagram.')
      return
    }

    setError(null)
    setContent((current) => `${current.trimEnd()}${current.trim() ? '\n\n' : ''}${instagramUrl}`)
    setMessage('Publicación de Instagram añadida al artículo. Guarda o publica para verla integrada en el blog.')
  }

  function removePendingMedia(index: number) {
    setMediaFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  function removeExistingMedia(filename: string) {
    setExistingMedia((current) => current.filter((item) => item !== filename))
    setRemovedMedia((current) => current.includes(filename) ? current : [...current, filename])
  }

  async function savePost(status: BlogStatus) {
    setMessage(null)
    setError(null)

    if (!title.trim()) {
      setError('Escribe un título antes de guardar.')
      return
    }
    if (!content.trim()) {
      setError('Escribe el contenido del artículo antes de guardar.')
      return
    }

    if (isDemoMode) {
      const categoryName = categories.find((item) => item.id === category)?.name || 'Sin categoría'
      if (editingId) {
        setPosts((current) => current.map((post) => post.id === editingId
          ? { ...post, title: title.trim(), category: categoryName, status, updated: 'Ahora' }
          : post))
      } else {
        setPosts((current) => [{ id: `demo-${Date.now()}`, title: title.trim(), category: categoryName, status, updated: 'Ahora' }, ...current])
      }
      setMessage(status === 'PUBLISHED' ? 'Artículo publicado en la demo.' : 'Borrador guardado en la demo.')
      resetEditor()
      return
    }

    setSaving(true)
    try {
      const input = {
        title,
        excerpt: summary,
        content,
        category: category || undefined,
        coverImage: coverImage || undefined,
        mediaFiles,
        removedMedia,
        status,
      }

      if (editingId) {
        await updateBlogPost(editingId, input)
      } else {
        await createBlogPost(input)
      }

      await reloadConnectedData()
      setMessage(status === 'PUBLISHED' ? 'Artículo publicado correctamente.' : 'Borrador guardado correctamente.')
      resetEditor()
    } catch {
      setError('No se ha podido guardar el artículo. Revisa datos, conexión y permisos ADMIN.')
    } finally {
      setSaving(false)
    }
  }

  async function removeCurrentPost() {
    if (!editingId) return
    const post = posts.find((item) => item.id === editingId)
    if (!post || !window.confirm(`¿Eliminar el artículo "${post.title}"?`)) return

    if (isDemoMode) {
      setPosts((current) => current.filter((item) => item.id !== editingId))
      setMessage('Artículo eliminado de la demo.')
      resetEditor()
      return
    }

    setSaving(true)
    setError(null)
    try {
      await deleteBlogPost(editingId)
      await reloadConnectedData()
      setMessage('Artículo eliminado correctamente.')
      resetEditor()
    } catch {
      setError('No se ha podido eliminar el artículo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page">
        <header className="cms-page-heading">
          <div>
            <span className="eyebrow">CMS · BLOG</span>
            <h2>Contenido del blog</h2>
            <p>Crea artículos, trabaja en borradores y controla qué contenidos están publicados en la web.</p>
          </div>
          <div className="blog-admin-stats">
            <span><strong>{stats.published}</strong> publicados</span>
            <span><strong>{stats.drafts}</strong> borradores</span>
          </div>
        </header>

        {loading && <div className="cms-notice">Cargando contenido del blog…</div>}
        {message && <div className="cms-notice success-notice">{message}</div>}
        {error && <div className="cms-notice">{error}</div>}

        <div className="blog-admin-grid">
          <section className="panel blog-list-panel">
            <div className="panel-heading">
              <div><span className="eyebrow">ARTÍCULOS</span><h3>Últimos contenidos</h3></div>
              <button type="button" onClick={resetEditor}>Nuevo</button>
            </div>

            <div className="admin-post-list">
              {posts.map((post) => (
                <article key={post.id}>
                  <span className={`content-state ${statusClass(post.status)}`}>{statusLabel(post.status)}</span>
                  <div>
                    <strong>{post.title}</strong>
                    <small>{post.category} · {post.updated}</small>
                  </div>
                  <button type="button" onClick={() => beginEdit(post)}>Editar</button>
                </article>
              ))}
            </div>
          </section>

          <form className="panel blog-editor-panel" onSubmit={(event) => { event.preventDefault(); void savePost('DRAFT') }}>
            <div className="panel-heading">
              <div><span className="eyebrow">EDITOR</span><h3>{editingId ? 'Editar artículo' : 'Nuevo artículo'}</h3></div>
              <span className="status info">{isDemoMode ? 'Demo' : 'Contenido activo'}</span>
            </div>

            <label className="field-stack">
              <span>Título</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Cómo mejorar tu speaking cada semana" />
            </label>

            <div className="field-grid-two">
              <label className="field-stack">
                <span>Categoría</span>
                <select value={category} onChange={(event) => setCategory(event.target.value)} disabled={categories.length === 0}>
                  {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label className="field-stack">
                <span>Imagen de portada</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleCoverImage} />
                <small>{coverImageName}</small>
              </label>
            </div>

            <section className="blog-media-field" aria-labelledby="blog-media-title">
              <div className="blog-media-heading">
                <div>
                  <span id="blog-media-title">Galería del artículo</span>
                  <small>Selecciona varias imágenes o vídeos de una vez. Máximo 12 archivos y 70 MB por carga.</small>
                </div>
                <strong>{existingMedia.length + mediaFiles.length}/{MAX_BLOG_MEDIA_FILES}</strong>
              </div>
              <label className="blog-media-picker">
                <span>Añadir imágenes o vídeos</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                  multiple
                  onChange={handleMediaFiles}
                  disabled={existingMedia.length + mediaFiles.length >= MAX_BLOG_MEDIA_FILES}
                />
                <small>JPG, PNG, WebP, MP4 o WebM · hasta 50 MB por archivo.</small>
              </label>

              {existingMediaItems.length > 0 && (
                <div className="blog-media-existing" aria-label="Archivos guardados">
                  {existingMediaItems.map((item) => (
                    <article key={item.name}>
                      {item.type === 'VIDEO'
                        ? <video src={item.url} muted preload="metadata" />
                        : <img src={item.url} alt="" loading="lazy" />}
                      <div><strong>{item.type === 'VIDEO' ? 'Vídeo' : 'Imagen'}</strong><small>{item.name}</small></div>
                      <button type="button" onClick={() => removeExistingMedia(item.name)}>Quitar</button>
                    </article>
                  ))}
                </div>
              )}

              {mediaFiles.length > 0 && (
                <div className="blog-media-pending" aria-label="Archivos nuevos seleccionados">
                  {mediaFiles.map((file, index) => (
                    <article key={`${file.name}-${file.lastModified}-${index}`}>
                      <span>{file.type.startsWith('video/') ? 'VÍDEO' : 'IMAGEN'}</span>
                      <div><strong>{file.name}</strong><small>{formatFileSize(file.size)}</small></div>
                      <button type="button" onClick={() => removePendingMedia(index)}>Quitar</button>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <label className="field-stack">
              <span>Resumen</span>
              <textarea rows={3} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Texto breve que aparecerá en la tarjeta del blog..." />
            </label>

            <label className="field-stack">
              <span>Contenido</span>
              <div className="editor-toolbar" aria-label="Herramientas del editor">
                <b aria-hidden="true">B</b><i aria-hidden="true">I</i><span aria-hidden="true">H2</span><span aria-hidden="true">Lista</span><span aria-hidden="true">Enlace</span>
                <button className="instagram-insert-button" type="button" onClick={insertInstagramPost}>◎ Instagram</button>
              </div>
              <textarea className="article-editor" rows={10} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Escribe aquí el artículo o añade una publicación pública de Instagram con el botón superior..." />
              <small>Instagram se inserta como un bloque dentro del artículo y siempre enlaza a la publicación original.</small>
            </label>

            <div className="cms-form-actions">
              <button className="button button-ghost" type="submit" disabled={saving || loading}>{saving ? 'Guardando…' : 'Guardar borrador'}</button>
              <button className="button button-primary" type="button" disabled={saving || loading} onClick={() => void savePost('PUBLISHED')}>Publicar</button>
              {editingId && <button className="button button-ghost" type="button" disabled={saving} onClick={() => void removeCurrentPost()}>Eliminar</button>}
            </div>
          </form>
        </div>
      </div>
    </DashboardShell>
  )
}
