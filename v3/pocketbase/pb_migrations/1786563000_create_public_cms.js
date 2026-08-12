migrate((app) => {
  const users = app.findCollectionByNameOrId('users')

  const blogCategories = new Collection({
    type: 'base',
    name: 'blog_categories',
    listRule: 'active = true || @request.auth.role = "ADMIN"',
    viewRule: 'active = true || @request.auth.role = "ADMIN"',
    createRule: '@request.auth.role = "ADMIN"',
    updateRule: '@request.auth.role = "ADMIN"',
    deleteRule: '@request.auth.role = "ADMIN"',
    fields: [
      { type: 'text', name: 'name', required: true, max: 100 },
      { type: 'text', name: 'slug', required: true, max: 120, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
      { type: 'text', name: 'description', max: 600 },
      { type: 'bool', name: 'active' },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_blog_categories_slug ON blog_categories (slug)',
    ],
  })
  app.save(blogCategories)

  const blogPosts = new Collection({
    type: 'base',
    name: 'blog_posts',
    listRule: '(status = "PUBLISHED" && published_at <= @now) || @request.auth.role = "ADMIN"',
    viewRule: '(status = "PUBLISHED" && published_at <= @now) || @request.auth.role = "ADMIN"',
    createRule: '@request.auth.role = "ADMIN"',
    updateRule: '@request.auth.role = "ADMIN"',
    deleteRule: '@request.auth.role = "ADMIN"',
    fields: [
      { type: 'text', name: 'title', required: true, max: 220 },
      { type: 'text', name: 'slug', required: true, max: 240, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
      { type: 'text', name: 'excerpt', max: 600 },
      { type: 'editor', name: 'content', required: true, maxSize: 120000 },
      {
        type: 'file',
        name: 'cover_image',
        maxSelect: 1,
        maxSize: 8388608,
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        thumbs: ['600x400', '1200x800'],
      },
      { type: 'relation', name: 'category', maxSelect: 1, collectionId: blogCategories.id, cascadeDelete: false },
      { type: 'relation', name: 'author', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
      { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] },
      { type: 'date', name: 'published_at' },
      { type: 'text', name: 'seo_title', max: 70 },
      { type: 'text', name: 'seo_description', max: 180 },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_blog_posts_slug ON blog_posts (slug)',
      'CREATE INDEX idx_blog_posts_status_published ON blog_posts (status, published_at)',
    ],
  })
  app.save(blogPosts)

  const mediaLibrary = new Collection({
    type: 'base',
    name: 'media_library',
    listRule: 'usage != "INTERNAL" || @request.auth.role = "ADMIN"',
    viewRule: 'usage != "INTERNAL" || @request.auth.role = "ADMIN"',
    createRule: '@request.auth.role = "ADMIN"',
    updateRule: '@request.auth.role = "ADMIN"',
    deleteRule: '@request.auth.role = "ADMIN"',
    fields: [
      { type: 'text', name: 'title', required: true, max: 180 },
      {
        type: 'file',
        name: 'file',
        required: true,
        maxSelect: 1,
        maxSize: 12582912,
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
        thumbs: ['300x300', '800x600', '1400x1000'],
      },
      { type: 'text', name: 'alt_text', max: 220 },
      { type: 'select', name: 'media_type', required: true, maxSelect: 1, values: ['IMAGE', 'DOCUMENT'] },
      { type: 'select', name: 'usage', required: true, maxSelect: 1, values: ['WEBSITE', 'BLOG', 'INTERNAL'] },
      { type: 'relation', name: 'uploaded_by', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
    ],
    indexes: [
      'CREATE INDEX idx_media_library_usage_created ON media_library (usage, created)',
    ],
  })
  app.save(mediaLibrary)

  const sitePages = new Collection({
    type: 'base',
    name: 'site_pages',
    listRule: 'status = "PUBLISHED" || @request.auth.role = "ADMIN"',
    viewRule: 'status = "PUBLISHED" || @request.auth.role = "ADMIN"',
    createRule: '@request.auth.role = "ADMIN"',
    updateRule: '@request.auth.role = "ADMIN"',
    deleteRule: '@request.auth.role = "ADMIN"',
    fields: [
      { type: 'text', name: 'key', required: true, max: 80, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
      { type: 'text', name: 'title', required: true, max: 180 },
      { type: 'json', name: 'content', required: true, maxSize: 120000 },
      { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_site_pages_key ON site_pages (`key`)',
    ],
  })
  app.save(sitePages)

  const pricingPlans = new Collection({
    type: 'base',
    name: 'pricing_plans',
    listRule: 'active = true || @request.auth.role = "ADMIN"',
    viewRule: 'active = true || @request.auth.role = "ADMIN"',
    createRule: '@request.auth.role = "ADMIN"',
    updateRule: '@request.auth.role = "ADMIN"',
    deleteRule: '@request.auth.role = "ADMIN"',
    fields: [
      { type: 'text', name: 'name', required: true, max: 140 },
      { type: 'text', name: 'description', max: 700 },
      { type: 'number', name: 'price', min: 0, max: 99999 },
      { type: 'text', name: 'billing_text', max: 140 },
      { type: 'json', name: 'features', maxSize: 20000 },
      { type: 'number', name: 'sort_order', min: 0, max: 9999, onlyInt: true },
      { type: 'bool', name: 'active' },
      { type: 'bool', name: 'featured' },
    ],
    indexes: [
      'CREATE INDEX idx_pricing_plans_active_sort ON pricing_plans (active, sort_order)',
    ],
  })
  app.save(pricingPlans)

  const siteSettings = new Collection({
    type: 'base',
    name: 'site_settings',
    listRule: '',
    viewRule: '',
    createRule: '@request.auth.role = "ADMIN"',
    updateRule: '@request.auth.role = "ADMIN"',
    deleteRule: '@request.auth.role = "ADMIN"',
    fields: [
      { type: 'text', name: 'academy_name', required: true, max: 180 },
      {
        type: 'file',
        name: 'logo',
        maxSelect: 1,
        maxSize: 5242880,
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
      },
      { type: 'text', name: 'phone', max: 30 },
      { type: 'email', name: 'email' },
      { type: 'text', name: 'whatsapp', max: 30 },
      { type: 'text', name: 'address', max: 500 },
      { type: 'json', name: 'social_links', maxSize: 10000 },
      { type: 'json', name: 'legal_texts', maxSize: 40000 },
    ],
  })
  app.save(siteSettings)

  const contactRequests = new Collection({
    type: 'base',
    name: 'contact_requests',
    listRule: '@request.auth.role = "ADMIN"',
    viewRule: '@request.auth.role = "ADMIN"',
    createRule: '@request.body.status = "NEW"',
    updateRule: '@request.auth.role = "ADMIN"',
    deleteRule: '@request.auth.role = "ADMIN"',
    fields: [
      { type: 'text', name: 'name', required: true, max: 160 },
      { type: 'email', name: 'email', required: true },
      { type: 'text', name: 'phone', max: 30 },
      { type: 'text', name: 'interest', max: 160 },
      { type: 'text', name: 'message', required: true, max: 4000 },
      { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['NEW', 'CONTACTED', 'CLOSED'] },
    ],
    indexes: [
      'CREATE INDEX idx_contact_requests_status_created ON contact_requests (status, created)',
    ],
  })
  app.save(contactRequests)

  const defaultHome = new Record(sitePages)
  defaultHome.set('key', 'home')
  defaultHome.set('title', 'Inicio')
  defaultHome.set('status', 'PUBLISHED')
  defaultHome.set('content', {
    hero: {
      eyebrow: 'ENGLISH WITH CONFIDENCE',
      title: 'Aprende inglés para usarlo de verdad.',
      subtitle: 'Clases cercanas, objetivos claros y un espacio privado para continuar aprendiendo entre sesiones.',
      primaryCta: 'Quiero información',
      secondaryCta: 'Ver programas',
    },
  })
  app.save(defaultHome)

  const defaultSettings = new Record(siteSettings)
  defaultSettings.set('academy_name', 'Language School')
  defaultSettings.set('social_links', {})
  defaultSettings.set('legal_texts', {})
  app.save(defaultSettings)
}, (app) => {
  for (const name of ['contact_requests', 'site_settings', 'pricing_plans', 'site_pages', 'media_library', 'blog_posts', 'blog_categories']) {
    try {
      const collection = app.findCollectionByNameOrId(name)
      app.delete(collection)
    } catch {
      // Safe rollback when a collection is already absent.
    }
  }
})
