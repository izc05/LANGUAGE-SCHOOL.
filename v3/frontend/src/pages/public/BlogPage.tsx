import { useEffect, useMemo, useState } from 'react'
import SiteShell from '../../components/SiteShell'
import { isDemoMode } from '../../config/environment'
import { getBlogCoverUrl, listPublishedBlogPosts } from '../../services/pocketbase/blog'

type ArticleItem = {
  id: string
  category: string
  title: string
  meta: string
  description: string
  coverUrl?: string
}

const demoArticles: ArticleItem[] = [
  { id: 'demo-1', category: 'Speaking', title: '5 formas de ganar confianza al hablar inglés', meta: '7 min', description: 'Ideas prácticas para dejar de bloquearte y empezar a construir fluidez real.' },
  { id: 'demo-2', category: 'Vocabulary', title: 'Aprender vocabulario sin listas infinitas', meta: '5 min', description: 'Cómo recordar palabras gracias al contexto, la repetición y el uso.' },
  { id: 'demo-3', category: 'Exams', title: 'Qué debes dominar antes de preparar un B1', meta: '8 min', description: 'Una revisión sencilla de las bases que conviene tener antes de entrar en modo examen.' },
  { id: 'demo-4', category: 'Listening', title: 'Escuchar inglés cada día sin saturarte', meta: '6 min', description: 'Una rutina corta y progresiva para entrenar el oído sin convertirlo en una obligación.' },
  { id: 'demo-5', category: 'Grammar', title: 'Past Simple vs Present Perfect: una forma fácil de verlo', meta: '9 min', description: 'Menos reglas memorizadas y más ejemplos que realmente ayudan a decidir qué tiempo usar.' },
  { id: 'demo-6', category: 'Parents', title: 'Cómo acompañar el inglés de tus hijos en casa', meta: '4 min', description: 'Pequeñas acciones que ayudan mucho sin convertir a las familias en profesores.' },
]

function formatPublishedDate(value: string): string {
  if (!value) return 'Publicado'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Publicado'
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

export default function BlogPage() {
  const [articles, setArticles] = useState<ArticleItem[]>(isDemoMode ? demoArticles : [])
  const [filter, setFilter] = useState('Todos')
  const [loading, setLoading] = useState(!isDemoMode)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (isDemoMode) return

    let mounted = true
    listPublishedBlogPosts()
      .then((records) => {
        if (!mounted) return
        setArticles(records.map((record) => ({
          id: record.id,
          category: record.expand?.category?.name || 'English',
          title: record.title,
          meta: formatPublishedDate(record.published_at),
          description: record.excerpt || 'Nuevo artículo de Language School.',
          coverUrl: getBlogCoverUrl(record),
        })))
      })
      .catch(() => {
        if (mounted) setError(true)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  const categories = useMemo(() => ['Todos', ...Array.from(new Set(articles.map((article) => article.category)))], [articles])
  const visibleArticles = filter === 'Todos' ? articles : articles.filter((article) => article.category === filter)

  return (
    <SiteShell>
      <section className="page-hero">
        <div className="container narrow">
          <span className="eyebrow">LANGUAGE SCHOOL JOURNAL</span>
          <h1>Ideas para aprender mejor.</h1>
          <p>Consejos de clase, inglés práctico, preparación de exámenes y recursos seleccionados por la academia.</p>
        </div>
      </section>

      <section className="section section-soft">
        <div className="container">
          <div className="blog-toolbar">
            <strong>{loading ? 'Cargando artículos…' : 'Últimos artículos'}</strong>
            <div className="filter-pills">
              {categories.map((category) => (
                <button key={category} className={filter === category ? 'active' : ''} type="button" onClick={() => setFilter(category)}>
                  {category}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="panel"><p className="muted">El blog no está disponible temporalmente. La web principal continúa funcionando con normalidad.</p></div>}

          {!error && !loading && visibleArticles.length === 0 && (
            <div className="panel"><p className="muted">Todavía no hay artículos publicados en esta categoría.</p></div>
          )}

          <div className="blog-grid">
            {visibleArticles.map((article, index) => (
              <article className={`blog-card ${index === 0 ? 'blog-card-featured' : ''}`} key={article.id}>
                <div
                  className="blog-card-visual"
                  style={article.coverUrl ? { backgroundImage: `url(${article.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                >
                  {!article.coverUrl && <span>{article.category.slice(0, 1)}</span>}
                </div>
                <div className="blog-card-body">
                  <div className="article-meta"><span>{article.category}</span><small>{article.meta}</small></div>
                  <h2>{article.title}</h2>
                  <p>{article.description}</p>
                  <button type="button" className="text-link button-reset">Leer artículo →</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </SiteShell>
  )
}
