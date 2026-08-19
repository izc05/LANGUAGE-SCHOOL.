export const adminNav = [
  { label: 'Dashboard', to: '/admin', section: 'Operación' },
  { label: 'Contactos', to: '/admin/contactos' },
  { label: 'Avisos', to: '/admin/avisos' },

  { label: 'Alumnos', to: '/admin/alumnos', section: 'Academia' },
  { label: 'Profesores', to: '/admin/profesores' },
  { label: 'Cursos', to: '/admin/cursos' },
  { label: 'Clases', to: '/admin/clases' },
  { label: 'Agenda', to: '/admin/agenda' },
  { label: 'Aula online', to: '/admin/aula-online' },
  { label: 'Zoom', to: '/admin/zoom' },
  { label: 'Test de nivel', to: '/admin/test-de-nivel' },
  { label: 'Resultados nivel', to: '/admin/test-de-nivel/resultados' },

  { label: 'Página web', to: '/admin/web', section: 'Web y contenido' },
  { label: 'Sobre nosotros', to: '/admin/web/sobre-nosotros' },
  { label: 'Profesores web', to: '/admin/profesores/publicos' },
  { label: 'Blog', to: '/admin/blog' },
  { label: 'Multimedia', to: '/admin/multimedia' },
  { label: 'Tarifas', to: '/admin/tarifas' },

  { label: 'Configuración', to: '/admin/configuracion', section: 'Sistema' },
  { label: 'Sistema', to: '/admin/sistema' },
] as const