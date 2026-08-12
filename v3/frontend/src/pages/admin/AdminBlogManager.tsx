import { type ChangeEvent, useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import { isDemoMode } from '../../config/environment'
import {
  createBlogPost,
  deleteBlogPost,
  listAdminBlogPosts,
  listBlogCategories,
  updateBlogPost,
  type BlogCategoryRecord,
  type BlogPostRecord,
  type BlogStatus,
} from '../../services/pocketbase/blog'
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
        if (mounted) setError('No se han podido cargar los artículos o categorías desde PocketBase.')
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

  function resetEditor() {
    setEditingId(null)
    setTitle('')
    setSummary('')
    setContent('')
    setCoverImage(null)
    setCoverImageName('Sin imagen nueva')
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
  }

  function handleCoverImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null
    setCoverImage(file)
    setCoverImageName(file?.name || 'Sin imagen nueva')
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
        status,
      }

      if (editingId) {
        await updateBlogPost(editingId, input)
      } else {
        await createBlogPost(input)
      }

      await reloadConnectedData()
      setMessage(status === 'PUBLISHED' ? 'Artículo publicado correctamente en PocketBase.' : 'Borrador guardado correctamente en PocketBase.')
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
      setMessage('Artículo eliminado de PocketBase.')
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

        {loading && <div className="cms-notice">Cargando blog desde PocketBase…</div>}
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
              <span className="status info">{isDemoMode ? 'Demo' : 'PocketBase'}</span>
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

            <label className="field-stack">
              <span>Resumen</span>
              <textarea rows={3} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Texto breve que aparecerá en la tarjeta del blog..." />
            </label>

            <label className="field-stack">
              <span>Contenido</span>
              <div className="editor-toolbar" aria-hidden="true"><b>B</b><i>I</i><span>H2</span><span>Lista</span><span>Enlace</span></div>
              <textarea className="article-editor" rows={10} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Escribe aquí el artículo..." />
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
