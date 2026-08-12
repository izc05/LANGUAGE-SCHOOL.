import SiteShell from '../../components/SiteShell'

const articles = [
  ['Speaking', '5 formas de ganar confianza al hablar inglés', '7 min', 'Ideas prácticas para dejar de bloquearte y empezar a construir fluidez real.'],
  ['Vocabulary', 'Aprender vocabulario sin listas infinitas', '5 min', 'Cómo recordar palabras gracias al contexto, la repetición y el uso.'],
  ['Exams', 'Qué debes dominar antes de preparar un B1', '8 min', 'Una revisión sencilla de las bases que conviene tener antes de entrar en modo examen.'],
  ['Listening', 'Escuchar inglés cada día sin saturarte', '6 min', 'Una rutina corta y progresiva para entrenar el oído sin convertirlo en una obligación.'],
  ['Grammar', 'Past Simple vs Present Perfect: una forma fácil de verlo', '9 min', 'Menos reglas memorizadas y más ejemplos que realmente ayudan a decidir qué tiempo usar.'],
  ['Parents', 'Cómo acompañar el inglés de tus hijos en casa', '4 min', 'Pequeñas acciones que ayudan mucho sin convertir a las familias en profesores.'],
]

export default function BlogPage() {
  return (
    <SiteShell>
      <section className="page-hero">
        <div className="container narrow">
          <span className="eyebrow">LANGUAGE SCHOOL JOURNAL</span>
          <h1>Ideas para aprender mejor.</h1>
          <p>Consejos de clase, inglés práctico, preparación de exámenes y recursos que también podrán gestionarse desde el futuro CMS del administrador.</p>
        </div>
      </section>

      <section className="section section-soft">
        <div className="container">
          <div className="blog-toolbar">
            <strong>Últimos artículos</strong>
            <div className="filter-pills"><button className="active">Todos</button><button>Speaking</button><button>Exams</button><button>Grammar</button></div>
          </div>
          <div className="blog-grid">
            {articles.map(([category, title, time, description], index) => (
              <article className={`blog-card ${index === 0 ? 'blog-card-featured' : ''}`} key={title}>
                <div className="blog-card-visual"><span>{category.slice(0, 1)}</span></div>
                <div className="blog-card-body">
                  <div className="article-meta"><span>{category}</span><small>{time}</small></div>
                  <h2>{title}</h2>
                  <p>{description}</p>
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
