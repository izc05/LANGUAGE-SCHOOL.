/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const blogPosts = app.findCollectionByNameOrId('blog_posts')

  blogPosts.fields.add(
    new FileField({
      name: 'media',
      maxSelect: 12,
      maxSize: 52428800,
      mimeTypes: [
        'image/jpeg',
        'image/png',
        'image/webp',
        'video/mp4',
        'video/webm',
      ],
      thumbs: ['600x450', '1200x900'],
    }),
  )

  app.save(blogPosts)
}, (app) => {
  const blogPosts = app.findCollectionByNameOrId('blog_posts')
  blogPosts.fields.removeByName('media')
  app.save(blogPosts)
})
