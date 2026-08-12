import { Navigate, Route, Routes } from 'react-router'
import HomePage from '../pages/public/HomePage'
import BlogPage from '../pages/public/BlogPage'
import LoginPage from '../pages/auth/LoginPage'
import StudentDashboard from '../pages/student/StudentDashboard'
import TeacherDashboard from '../pages/teacher/TeacherDashboard'
import AdminDashboard from '../pages/admin/AdminDashboard'
import AdminSiteEditor from '../pages/admin/AdminSiteEditor'
import AdminMediaLibrary from '../pages/admin/AdminMediaLibrary'
import AdminBlogManager from '../pages/admin/AdminBlogManager'
import AdminStudentsPage from '../pages/admin/AdminStudentsPage'
import AdminTeachersPage from '../pages/admin/AdminTeachersPage'
import AdminCoursesPage from '../pages/admin/AdminCoursesPage'
import AdminClassesPage from '../pages/admin/AdminClassesPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/acceso" element={<LoginPage />} />
      <Route path="/alumno" element={<StudentDashboard />} />
      <Route path="/profesor" element={<TeacherDashboard />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/web" element={<AdminSiteEditor />} />
      <Route path="/admin/blog" element={<AdminBlogManager />} />
      <Route path="/admin/multimedia" element={<AdminMediaLibrary />} />
      <Route path="/admin/alumnos" element={<AdminStudentsPage />} />
      <Route path="/admin/profesores" element={<AdminTeachersPage />} />
      <Route path="/admin/cursos" element={<AdminCoursesPage />} />
      <Route path="/admin/clases" element={<AdminClassesPage />} />
      <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
