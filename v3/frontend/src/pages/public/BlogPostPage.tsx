import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import SiteShell from '../../components/SiteShell'
import { isDemoMode } from '../../config/environment'
import {
  getBlogCoverUrl,
  getPublishedBlogPostBySlug,
  type BlogPostRecord,
} from '../../services/pocketbase/blog'

type ArticleDetail = {
  title: string
  slug: string
  excerpt: string
  content: string
  category: string
  publishedAt: string
  coverUrl: string
  seoTitle: string
  seoDescription: string
}

function demoArticle(slug: string, title: string, category: string, excerpt: string, content: string): ArticleDetail {
  return { title, slug, excerpt, content, category, publishedAt: '', coverUrl: '', seoTitle: '', seoDescription: '' }
}

const demoArticles: Record<string, ArticleDetail> = {
  '5-formas-de-ganar-confianza-al-hablar-ingles': demoArticle(
    '5-formas-de-ganar-confianza-al-hablar-ingles',
    '5 formas de ganar confianza al hablar inglés',
    'Speaking',
    'Ideas prácticas para dejar de bloquearte y empezar a construir fluidez real.',
    'Hablar con confianza no significa hablar sin errores. Significa poder seguir comunicándote aunque tengas que corregirte.\n\nEmpieza con frases cortas, repite estructuras útiles y busca situaciones en las que puedas usar el idioma con frecuencia.',
  ),
  'aprender-vocabulario-sin-listas-infinitas': demoArticle(
    'aprender-vocabulario-sin-listas-infinitas',
    'Aprender vocabulario sin listas infinitas',
    'Vocabulary',
    'Cómo recordar palabras gracias al contexto, la repetición y el uso.',
    'Las palabras se recuerdan mejor cuando aparecen dentro de una situación que tiene sentido.\n\nAgrupa vocabulario por contexto, vuelve a encontrarlo varios días después y úsalo en frases propias.',
  ),
  'que-debes-dominar-antes-de-preparar-un-b1': demoArticle(
    'que-debes-dominar-antes-de-preparar-un-b1',
    'Qué debes dominar antes de preparar un B1',
    'Exams',
    'Una revisión sencilla de las bases que conviene tener antes de entrar en modo examen.',
    'Antes de hacer simulacros conviene revisar comprensión, vocabulario de uso frecuente y las estructuras que necesitas para expresarte con claridad.\n\nEl examen se prepara mejor cuando la base lingüística ya permite concentrarse en la estrategia.',
  ),
  'escuchar-ingles-cada-dia-sin-saturarte': demoArticle(
    'escuchar-ingles-cada-dia-sin-saturarte',
    'Escuchar inglés cada día sin saturarte',
    'Listening',
    'Una rutina corta y progresiva para entrenar el oído sin convertirlo en una obligación.',
    'Cinco o diez minutos de escucha frecuente suelen aportar más que una sesión muy larga una vez por semana.\n\nElige audios adecuados a tu nivel y repite fragmentos breves antes de aumentar la dificultad.',
  ),
  'past-simple-vs-present-perfect': demoArticle(
    'past-simple-vs-present-perfect',
    'Past Simple vs Present Perfect: una forma fácil de verlo',
    'Grammar',
    'Menos reglas memorizadas y más ejemplos que realmente ayudan a decidir qué tiempo usar.',
    'Piensa primero en la relación que el hablante establece con el presente.\n\nLos ejemplos contextualizados ayudan a elegir el tiempo verbal con más naturalidad que una lista aislada de reglas.',
  ),
  'como-acompanar-el-ingles-de-tus-hijos-en-casa': demoArticle(
    'como-acompanar-el-ingles-de-tus-hijos-en-casa',
    'Cómo acompañar el inglés de tus hijos en casa',
    'Parents',
    'Pequeñas acciones que ayudan mucho sin convertir a las familias en profesores.',
    'Acompañar no significa impartir otra clase en casa. Puedes ayudar creando pequeñas oportunidades de contacto positivo con el idioma.\n\nCanciones, cuentos, juegos y curiosidad compartida refuerzan el aprendizaje sin añadir presión.',
  ),
}

function toDetail(record: BlogPostRecord): ArticleDetail {
  return {
    title: record.title,
    slug: record.slug,
    excerpt: record.excerpt || '',
    content: record.content,
    category: record.expand?.category?.name || 'English',
    publishedAt: record.published_at,
    coverUrl: getBlogCoverUrl(record, '1200x800'),
    seoTitle: record.seo_title || '',
    seoDescription: record.seo_description || '',
  }
}

function formatPublishedDate(value: string): string {
  if (!value) return 'Language School Journal'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Language School Journal'
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }).format(date)
}

export default function BlogPostPage() {
  const { slug = '' } = useParams()
  const [article, setArticle] = useState<ArticleDetail | null>(isDemoMode ? demoArticles[slug] || null : null)
  const [loading, setLoading] = useState(!isDemoMode)
  const [notFound, setNotFound] = useState(isDemoMode && !demoArticles[slug])

  useEffect(() => {
    if (isDemoMode) {
      setArticle(demoArticles[slug] || null)
      setNotFound(!demoArticles[slug])
      setLoading(false)
      return
    }

    let mounted = true
    setLoading(true)
    setNotFound(false)

    getPublishedBlogPostBySlug(slug)
      .then((record) => {
        if (!mounted) return
        setArticle(toDetail(record))
      })
      .catch(() => {
        if (!mounted) return
        setArticle(null)
        setNotFound(true)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => { mounted = false }
  }, [slug])

  useEffect(() => {
    if (!article) return
    document.title = article.seoTitle || `${article.title} · Language School`
    let description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!description) {
      description = document.createElement('meta')
      description.name = 'description'
      document.head.appendChild(description)
    }
    description.content = article.seoDescription || article.excerpt || 'Artículo de Language School Journal.'
  }, [article])

  const blocks = useMemo(
    () => article?.content.split(/\n\s*\n/).map((value) => value.trim()).filter(Boolean) || [],
    [article],
  )

  return (
    <SiteShell>
      <div className="blog-detail-page">
        {loading && (
          <section className="section blog-detail-state"><div className="container"><div className="panel public-empty-state">Cargando artículo…</div></div></section>
        )}

        {!loading && notFound && (
          <section className="section blog-detail-state">
            <div className="container blog-detail-not-found">
              <span className="eyebrow">LANGUAGE SCHOOL JOURNAL</span>
              <h1>Artículo no disponible.</h1>
              <p>Puede que el artículo no exista, siga en borrador o ya no esté publicado.</p>
              <Link className="button button-primary" to="/blog">Volver al blog</Link>
            </div>
          </section>
        )}

        {!loading && article && (
          <>
            <article className="blog-detail-article">
              <header className="blog-detail-hero">
                <div className="container blog-detail-hero-inner">
                  <Link className="blog-detail-back" to="/blog">← Volver al blog</Link>
                  <div className="blog-detail-meta"><span>{article.category}</span><small>{formatPublishedDate(article.publishedAt)}</small></div>
                  <h1>{article.title}</h1>
                  {article.excerpt && <p className="blog-detail-excerpt">{article.excerpt}</p>}
                </div>
              </header>

              {article.coverUrl && (
                <div className="container blog-detail-cover-wrap">
                  <img className="blog-detail-cover" src={article.coverUrl} alt="" />
                </div>
              )}

              <div className="container blog-detail-layout">
                <div className="blog-detail-body">
                  {blocks.map((block, index) => <p key={`${index}-${block.slice(0, 24)}`}>{block}</p>)}
                </div>
                <aside className="blog-detail-aside">
                  <span className="eyebrow">SIGUE AVANZANDO</span>
                  <h2>¿Quieres llevarlo a clase?</h2>
                  <p>Cuéntanos tu nivel y tu objetivo y te orientamos hacia el programa que mejor encaje contigo.</p>
                  <Link className="button button-primary" to="/contacto">Pedir información</Link>
                </aside>
              </div>
            </article>

            <section className="section blog-detail-footer-cta">
              <div className="container blog-detail-footer-inner">
                <div><span className="eyebrow">ENGLISH JOURNAL</span><h2>Más ideas para seguir aprendiendo.</h2></div>
                <Link className="button button-ghost" to="/blog">Ver todos los artículos</Link>
              </div>
            </section>
          </>
        )}
      </div>
    </SiteShell>
  )
}
