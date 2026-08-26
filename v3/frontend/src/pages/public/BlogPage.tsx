import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import SiteShell from '../../components/SiteShell'
import { isDemoMode } from '../../config/environment'
import { getBlogCoverUrl, listPublishedBlogPosts } from '../../services/pocketbase/blog'
import { getPublishedHomeVisualUrl } from '../../services/pocketbase/siteContent'

type ArticleItem = {
  id: string
  slug: string
  category: string
  title: string
  meta: string
  description: string
  coverUrl?: string
}

const demoArticles: ArticleItem[] = [
  { id: 'demo-1', slug: '5-formas-de-ganar-confianza-al-hablar-ingles', category: 'Speaking', title: '5 formas de ganar confianza al hablar inglés', meta: '7 min', description: 'Ideas prácticas para dejar de bloquearte y empezar a construir fluidez real.' },
  { id: 'demo-2', slug: 'aprender-vocabulario-sin-listas-infinitas', category: 'Vocabulary', title: 'Aprender vocabulario sin listas infinitas', meta: '5 min', description: 'Cómo recordar palabras gracias al contexto, la repetición y el uso.' },
  { id: 'demo-3', slug: 'que-debes-dominar-antes-de-preparar-un-b1', category: 'Exams', title: 'Qué debes dominar antes de preparar un B1', meta: '8 min', description: 'Una revisión sencilla de las bases que conviene tener antes de entrar en modo examen.' },
  { id: 'demo-4', slug: 'escuchar-ingles-cada-dia-sin-saturarte', category: 'Listening', title: 'Escuchar inglés cada día sin saturarte', meta: '6 min', description: 'Una rutina corta y progresiva para entrenar el oído sin convertirlo en una obligación.' },
  { id: 'demo-5', slug: 'past-simple-vs-present-perfect', category: 'Grammar', title: 'Past Simple vs Present Perfect: una forma fácil de verlo', meta: '9 min', description: 'Menos reglas memorizadas y más ejemplos que realmente ayudan a decidir qué tiempo usar.' },
  { id: 'demo-6', slug: 'como-acompanar-el-ingles-de-tus-hijos-en-casa', category: 'Parents', title: 'Cómo acompañar el inglés de tus hijos en casa', meta: '4 min', description: 'Pequeñas acciones que ayudan mucho sin convertir a las familias en profesores.' },
]

function formatPublishedDate(value: string): string {
  if (!value) return 'Publicado'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Publicado'
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function categoryVisual(category: string): string {
  const value = category.toLowerCase()
  if (value.includes('speak')) return 'journal-speaking.svg'
  if (value.includes('vocab')) return 'journal-vocabulary.svg'
  if (value.includes('exam') || value.includes('cambridge')) return 'journal-exams.svg'
  if (value.includes('listen')) return 'journal-listening.svg'
  if (value.includes('gram')) return 'journal-grammar.svg'
  if (value.includes('parent') || value.includes('famil')) return 'journal-parents.svg'
  return 'blog-journal.svg'
}

export default function BlogPage() {
  const [articles, setArticles] = useState<ArticleItem[]>(isDemoMode ? demoArticles : [])
  const [filter, setFilter] = useState('Todos')
  const [loading, setLoading] = useState(!isDemoMode)
  const [error, setError] = useState(false)
  const [heroPhoto, setHeroPhoto] = useState('')
  const visualBase = `${import.meta.env.BASE_URL}visuals/`
  const journalVisual = `${visualBase}blog-journal.svg`

  useEffect(() => {
    let mounted = true

    Promise.all([
      isDemoMode ? Promise.resolve([]) : listPublishedBlogPosts(),
      getPublishedHomeVisualUrl('blogHeroMediaId'),
    ])
      .then(([records, photo]) => {
        if (!mounted) return
        setHeroPhoto(photo)
        if (!isDemoMode) {
          setArticles(records.map((record) => ({
            id: record.id,
            slug: record.slug,
            category: record.expand?.category?.name || 'English',
            title: record.title,
            meta: formatPublishedDate(record.published_at),
            description: record.excerpt || 'Nuevo artículo de Language School.',
            coverUrl: getBlogCoverUrl(record),
          })))
        }
      })
      .catch(() => {
        if (mounted && !isDemoMode) setError(true)
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
  const featuredArticle = visibleArticles[0]
  const secondaryArticles = visibleArticles.slice(1)

  return (
    <SiteShell>
      <div className="blog-premium-v2">
        <section className="blog-v2-hero blog-v2-hero-editorial">
          <div className="container blog-v2-hero-grid">
            <div className="blog-v2-hero-copy">
              <span className="eyebrow">LANGUAGE SCHOOL JOURNAL</span>
              <h1>Ideas para aprender mejor.</h1>
              <p>Consejos de clase, inglés práctico, preparación de exámenes y recursos seleccionados por la academia.</p>
              <a className="text-link blog-v2-hero-link" href="#articulos">Ir a los últimos artículos →</a>
            </div>
            <div className={`blog-v2-hero-visual${heroPhoto ? ' has-cms-photo' : ''}`} style={heroPhoto ? { backgroundImage: `linear-gradient(180deg, rgba(53,25,39,.02), rgba(53,25,39,.18)), url(${heroPhoto})` } : undefined}>
              {!heroPhoto && <img src={journalVisual} alt="Ilustración editorial del Language School Journal" />}
              <div className="blog-v2-floating-note"><small>READ · LISTEN · PRACTISE</small><strong>Un poco de inglés, muchas veces.</strong></div>
            </div>
          </div>
        </section>

        <section className="section blog-v2-content-section" id="articulos">
          <div className="container">
            <div className="blog-v2-toolbar">
              <div><span className="eyebrow">JOURNAL</span><h2>{loading ? 'Cargando artículos…' : 'Últimos artículos'}</h2></div>
              <div className="blog-v2-filters" aria-label="Filtrar artículos por categoría">
                {categories.map((category) => (
                  <button key={category} className={filter === category ? 'active' : ''} type="button" onClick={() => setFilter(category)}>{category}</button>
                ))}
              </div>
            </div>

            {error && <div className="panel"><p className="muted">El blog no está disponible temporalmente. La web principal continúa funcionando con normalidad.</p></div>}
            {!error && !loading && visibleArticles.length === 0 && <div className="panel"><p className="muted">Todavía no hay artículos publicados en esta categoría.</p></div>}

            {!error && featuredArticle && (
              <article className="blog-v2-featured">
                <div className={`blog-v2-featured-visual ${featuredArticle.coverUrl ? 'has-cover' : 'has-generated-visual'}`} style={featuredArticle.coverUrl ? { backgroundImage: `url(${featuredArticle.coverUrl})` } : undefined}>
                  {!featuredArticle.coverUrl && <img className="journal-generated-visual" src={`${visualBase}${categoryVisual(featuredArticle.category)}`} alt="" loading="lazy" />}
                </div>
                <div className="blog-v2-featured-copy">
                  <div className="blog-v2-meta"><span>{featuredArticle.category}</span><small>{featuredArticle.meta}</small></div>
                  <h2>{featuredArticle.title}</h2>
                  <p>{featuredArticle.description}</p>
                  <Link className="text-link" to={`/blog/${featuredArticle.slug}`}>Leer artículo →</Link>
                </div>
              </article>
            )}

            <div className="blog-v2-grid">
              {secondaryArticles.map((article, index) => (
                <article className="blog-v2-card" key={article.id}>
                  <div className={`blog-v2-card-visual visual-${(index % 4) + 1} ${article.coverUrl ? 'has-cover' : 'has-generated-visual'}`} style={article.coverUrl ? { backgroundImage: `url(${article.coverUrl})` } : undefined}>
                    {!article.coverUrl && <img className="journal-generated-visual" src={`${visualBase}${categoryVisual(article.category)}`} alt="" loading="lazy" />}
                  </div>
                  <div className="blog-v2-card-copy">
                    <div className="blog-v2-meta"><span>{article.category}</span><small>{article.meta}</small></div>
                    <h3>{article.title}</h3>
                    <p>{article.description}</p>
                    <Link className="text-link" to={`/blog/${article.slug}`}>Leer artículo →</Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section blog-v2-note-section">
          <div className="container blog-v2-note">
            <span className="blog-v2-note-mark" aria-hidden="true">“</span>
            <div><span className="eyebrow">IDEA DEL JOURNAL</span><h2>No necesitas estudiar inglés todo el día. Necesitas volver a él con frecuencia.</h2></div>
          </div>
        </section>
      </div>
    </SiteShell>
  )
}
