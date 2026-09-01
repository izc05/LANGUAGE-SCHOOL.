# Auditoría web local · Language School V3

Fecha: 1 de septiembre de 2026. Alcance: ejecución local de `v3/frontend` en modo `demo`, sin acceder a datos persistentes, secretos ni servicios de producción.

## Resumen general

La web pública existente carga correctamente en las rutas implementadas y mantiene una base visual coherente. Se verificaron foco visible, enlace para saltar al contenido, reducción de movimiento, ausencia de scroll horizontal en 390 px, 768 px y escritorio, y separación explícita de los datos demo. El formulario muestra etiquetas y mensajes comprensibles.

No está preparada para publicación: faltan las páginas legales, el favicon, y archivos reales `robots.txt` y `sitemap.xml`. Varios flujos solicitados no existen aún como rutas: detalle de programa, artículo de blog y test de nivel. No se han creado contenidos legales ni editoriales ficticios.

## Hallazgos

| Prioridad | Problema | Archivo afectado | Solución propuesta | Estado | Cómo verificar |
| --- | --- | --- | --- | --- | --- |
| P0 | No existen aviso legal, privacidad, cookies ni condiciones de matrícula; las URLs devuelven la 404. | `src/app/App.tsx`, `src/components/SiteShell.tsx` | Aportar razón social/titular, NIF, domicilio, contacto, tratamiento, conservación, derechos, encargados, cookies y condiciones aprobadas; crear las páginas, metadatos y enlaces de footer. | Pendiente | Visitar las cuatro rutas, comprobar el footer y revisar el texto legal con la persona responsable. |
| P0 | No hay `favicon.ico`; `/robots.txt` y `/sitemap.xml` devuelven la SPA HTML en lugar de archivos de publicación. | `frontend/public/` (inexistente) | Añadir favicon de marca autorizado, `robots.txt` y sitemap con la URL canónica definida antes de publicar. | Pendiente | Solicitar cada recurso y validar `Content-Type`; comprobar URLs con una herramienta SEO. |
| P0 | El remoto configurado termina en `LANGUAGE-SCHOOL..git`; puede impedir una futura operación remota. | `.git/config` | Corregirlo únicamente tras confirmación del propietario y prueba no destructiva. | Pendiente | `git ls-remote origin` tras autorización; no hacer push desde esta rama. |
| P1 | No hay detalle de programa; `/programas/:slug` muestra 404. | `src/app/App.tsx`, páginas públicas y servicio de cursos | Diseñar la ficha con contenido aprobado, CTA y datos que estén disponibles en el modelo de cursos. | Pendiente | Abrir cada slug publicado y comprobar título, CTA y regreso a programas. |
| P1 | No hay detalle de artículo; `/blog/:slug` muestra 404 y el blog no ofrece lectura individual. | `src/app/App.tsx`, `pages/public/BlogPage.tsx`, `services/pocketbase/blog.ts` | Implementar ruta de solo artículos `PUBLISHED`, con contenido/editorial y SEO por artículo. | Pendiente | Abrir un slug publicado en demo y connected; comprobar que borradores no se exponen. |
| P1 | No existe test de nivel (`/test-nivel`). | `src/app/App.tsx` | Definir preguntas, aviso de carácter orientativo, tratamiento de respuestas y CTA antes de implementar. | Pendiente | Completar el test sin datos personales y validar resultado, móvil y privacidad. |
| P1 | El contacto no declaraba tipos/autocompletado para nombre, email y teléfono. | `src/pages/public/ContactPage.tsx` | Añadir `autocomplete`, tipo `tel` e `inputMode`. | Completado | En `/contacto`, inspeccionar los atributos y probar autocompletado/teclado en móvil. |
| P2 | La navegación en móvil permanece en una fila desplazable; es utilizable, pero no indica visualmente que haya opciones fuera de vista. | `src/components/SiteShell.tsx`, `styles/public-pages.css` | Valorar un menú desplegable accesible con botón, Escape y gestión de foco. | Pendiente | A 390 px, recorrer todos los enlaces con Tab y usar el menú sin ratón. |
| P2 | La entrada 3D puede dejar inicialmente el mensaje “Preparando la entrada…” mientras se carga el módulo. | `pages/public/IntroGatePage.tsx`, `pages/public/intro/IntroPage.tsx` | Medir en red lenta; considerar una portada HTML inmediata o un límite de espera más corto. | Pendiente | Simular red lenta y verificar que Entrar/Saltar intro siempre estén disponibles a tiempo. |
| P2 | El título base de acceso no es específico de ruta. | `pages/auth/LoginPage.tsx`, metadatos de app | Definir `title` y `meta description` propios para acceso y portales sin revelar información privada. | Pendiente | Abrir `/acceso` y comprobar metadatos. |
| P2 | Las imágenes de contenido deben revisarse cuando se carguen desde CMS para garantizar alternativas útiles; los logos decorativos actuales llevan `alt` vacío correctamente. | Componentes públicos y multimedia CMS | Definir campos de texto alternativo obligatorio para imágenes informativas. | Pendiente | Cargar una imagen informativa en entorno de prueba y revisar el árbol de accesibilidad. |
| P3 | Consolidar la documentación histórica: README y ROADMAP contienen estados anteriores a la integración actual. | `frontend/README.md`, `docs/ROADMAP.md` | Actualizar en una fase documental separada, sin usarlo como fuente única de estado de producción. | Pendiente | Comparar documentación con rutas y pruebas actuales. |

## Comprobaciones realizadas

- Rutas públicas implementadas: inicio, programas, profesores, sobre nosotros, tarifas, blog, contacto, acceso y 404.
- Rutas solicitadas que faltan: detalle de programa, artículo, test de nivel y cuatro páginas legales.
- Responsive: escritorio grande, 768 px y 390 px, sin scroll horizontal de documento en las páginas probadas.
- Accesibilidad: salto a contenido, foco visible global, labels del contacto, estados `status`/`alert` y `prefers-reduced-motion` presentes.
- Privacidad y modo de datos: el envío de contacto se simula en demo; en connected usa el servicio correspondiente. Las rutas privadas aplican autenticación y roles en modo connected. La relajación de roles en demo es intencionada para revisar vistas y no debe desplegarse como connected.
- SEO/publicación: metadatos por varias rutas públicas y 404 presentes; faltan favicon, robots, sitemap y metadatos de acceso/detalles pendientes.

## Límites de esta auditoría

No se enviaron formularios a un servicio real, no se usaron credenciales, ni se inspeccionaron archivos `.env`, `pb_data`, backups o datos personales. Las pruebas E2E conectadas pueden requerir variables de entorno y una instancia de prueba, por lo que se ejecutan solo cuando el entorno las proporciona.
