import { isDemoMode } from '../../config/environment'
import { listAdminBlogPosts, type BlogPostRecord } from './blog'
import { collections } from './collections'
import { countNewContactRequests } from './contactRequests'
import { pb } from './client'

export type AdminDashboardMetrics = {
  activeStudents: number
  activeTeachers: number
  blogPosts: number
  blogDrafts: number
  activeStudentFiles: number
  newContacts: number
  recentPosts: BlogPostRecord[]
}

const demoMetrics: AdminDashboardMetrics = {
  activeStudents: 36,
  activeTeachers: 3,
  blogPosts: 12,
  blogDrafts: 2,
  activeStudentFiles: 284,
  newContacts: 1,
  recentPosts: [],
}

function requireAdmin() {
  if (isDemoMode) return
  const user = pb.authStore.record
  if (!user || user.role !== 'ADMIN') throw new Error('Se requiere una sesión ADMIN.')
}

async function count(collection: string, filter = ''): Promise<number> {
  const result = await pb.collection(collection).getList(1, 1, {
    filter,
    fields: 'id',
  })
  return result.totalItems
}

export async function getAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  if (isDemoMode) return demoMetrics
  requireAdmin()

  const [activeStudents, activeTeachers, blogPosts, blogDrafts, activeStudentFiles, newContacts, recentPosts] = await Promise.all([
    count(collections.users, 'role = "STUDENT" && status = "ACTIVE"'),
    count(collections.users, 'role = "TEACHER" && status = "ACTIVE"'),
    count(collections.blogPosts),
    count(collections.blogPosts, 'status = "DRAFT"'),
    count(collections.studentFiles, 'status = "ACTIVE"'),
    countNewContactRequests(),
    listAdminBlogPosts(),
  ])

  return {
    activeStudents,
    activeTeachers,
    blogPosts,
    blogDrafts,
    activeStudentFiles,
    newContacts,
    recentPosts: recentPosts.slice(0, 3),
  }
}
