import { type FormEvent, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import { adminNav } from './adminNav'

type Post = {
  id: number
  title: string
  category: string
  state: 'Publicado' | 'Borrador'
  updated: string
}

const initialPosts: Post[] = [
  { id: 1, title: '5 formas de ganar confianza al hablar', category: 'Speaking', state: 'Publicado', updated: 'Hoy' },
  { id: 2, title: 'Guía B1 para septiembre', category: 'Exams', state: 'Borrador', updated: 'Ayer' },
  { id: 3, title: 'Vocabulario sin listas infinitas', category: 'Vocabulary', state: 'Publicado', updated: 'Hace 4 días' },
]

export default function AdminBlogManager() {
  const [posts, setPosts] = useState(initialPosts)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Speaking')
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const stats = useMemo(() => ({
    published: posts.filter((post) => post.state === 'Publicado').length,
    drafts: posts.filter((post) => post.state === 'Borrador').length,
  }), [posts])

  function createPost(event: FormEvent<HTMLFormElement>, state: Post['state']) {
    event.preventDefault()
    if (!title.trim()) {
      setMessage('Escribe al menos un título antes de guardar.')
      return
    }

    setPosts((current) => [
      {
        id: Date.now(),
        title: title.trim(),
        category,
        state,
        updated: 'Ahora',
      },
      ...current,
    ])
    setMessage(state === 'Publicado' ? 'Artículo publicado en la demo.' : 'Borrador guardado en la demo.')
    setTitle('')
    setSummary('')
    setContent('')
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

        <div className="blog-admin-grid">
          <section className="panel blog-list-panel">
            <div className="panel-heading">
              <div><span className="eyebrow">ARTÍCULOS</span><h3>Últimos contenidos</h3></div>
              <button type="button">Filtrar</button>
            </div>

            <div className="admin-post-list">
              {posts.map((post) => (
                <article key={post.id}>
                  <span className={`content-state ${post.state === 'Publicado' ? 'published' : 'draft'}`}>{post.state}</span>
                  <div>
                    <strong>{post.title}</strong>
                    <small>{post.category} · {post.updated}</small>
                  </div>
                  <button type="button">Editar</button>
                </article>
              ))}
            </div>
          </section>

          <form className="panel blog-editor-panel" onSubmit={(event) => createPost(event, 'Borrador')}>
            <div className="panel-heading"><div><span className="eyebrow">EDITOR</span><h3>Nuevo artículo</h3></div><span className="status info">Demo</span></div>

            {message && <div className="cms-notice">{message}</div>}

            <label className="field-stack">
              <span>Título</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Cómo mejorar tu speaking cada semana" />
            </label>

            <div className="field-grid-two">
              <label className="field-stack">
                <span>Categoría</span>
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  <option>Speaking</option>
                  <option>Vocabulary</option>
                  <option>Grammar</option>
                  <option>Exams</option>
                  <option>Kids</option>
                  <option>Academia</option>
                </select>
              </label>
              <div className="field-stack">
                <span>Imagen de portada</span>
                <button className="input-like-button" type="button">Seleccionar de Multimedia</button>
              </div>
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
              <button className="button button-ghost" type="submit">Guardar borrador</button>
              <button className="button button-primary" type="button" onClick={(event) => {
                const form = event.currentTarget.form
                if (form) createPost({ preventDefault: () => undefined } as FormEvent<HTMLFormElement>, 'Publicado')
              }}>Publicar</button>
            </div>
          </form>
        </div>
      </div>
    </DashboardShell>
  )
}
