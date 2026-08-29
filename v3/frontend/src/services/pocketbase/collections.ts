export const collections = {
  users: 'users',
  studentProfiles: 'student_profiles',
  teacherProfiles: 'teacher_profiles',
  courses: 'courses',
  groups: 'groups',
  enrollments: 'enrollments',
  classes: 'classes',
  attendance: 'attendance',
  materials: 'materials',
  studentFiles: 'student_files',
  assignments: 'assignments',
  assignmentSubmissions: 'assignment_submissions',
  blogCategories: 'blog_categories',
  blogPosts: 'blog_posts',
  mediaLibrary: 'media_library',
  sitePages: 'site_pages',
  pricingPlans: 'pricing_plans',
  siteSettings: 'site_settings',
  notifications: 'notifications',
  contactRequests: 'contact_requests',
} as const

export type CollectionName = (typeof collections)[keyof typeof collections]
