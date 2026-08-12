import { Navigate, Route, Routes } from 'react-router'
import RequireRole from '../features/auth/RequireRole'
import HomePage from '../pages/public/HomePage'
import BlogPage from '../pages/public/BlogPage'
import LoginPage from '../pages/auth/LoginPage'
import StudentDashboard from '../pages/student/StudentDashboard'
import StudentFilesPage from '../pages/student/StudentFilesPage'
import StudentMaterialPage from '../pages/student/StudentMaterialPage'
import StudentAssignmentsPage from '../pages/student/StudentAssignmentsPage'
import StudentClassesPage from '../pages/student/StudentClassesPage'
import StudentNotificationsPage from '../pages/student/StudentNotificationsPage'
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

      <Route path="/alumno" element={<RequireRole allow={['STUDENT']}><StudentDashboard /></RequireRole>} />
      <Route path="/alumno/clases" element={<RequireRole allow={['STUDENT']}><StudentClassesPage /></RequireRole>} />
      <Route path="/alumno/material" element={<RequireRole allow={['STUDENT']}><StudentMaterialPage /></RequireRole>} />
      <Route path="/alumno/tareas" element={<RequireRole allow={['STUDENT']}><StudentAssignmentsPage /></RequireRole>} />
      <Route path="/alumno/archivos" element={<RequireRole allow={['STUDENT']}><StudentFilesPage /></RequireRole>} />
      <Route path="/alumno/avisos" element={<RequireRole allow={['STUDENT']}><StudentNotificationsPage /></RequireRole>} />
      <Route path="/profesor" element={<RequireRole allow={['TEACHER']}><TeacherDashboard /></RequireRole>} />

      <Route path="/admin" element={<RequireRole allow={['ADMIN']}><AdminDashboard /></RequireRole>} />
      <Route path="/admin/web" element={<RequireRole allow={['ADMIN']}><AdminSiteEditor /></RequireRole>} />
      <Route path="/admin/blog" element={<RequireRole allow={['ADMIN']}><AdminBlogManager /></RequireRole>} />
      <Route path="/admin/multimedia" element={<RequireRole allow={['ADMIN']}><AdminMediaLibrary /></RequireRole>} />
      <Route path="/admin/alumnos" element={<RequireRole allow={['ADMIN']}><AdminStudentsPage /></RequireRole>} />
      <Route path="/admin/profesores" element={<RequireRole allow={['ADMIN']}><AdminTeachersPage /></RequireRole>} />
      <Route path="/admin/cursos" element={<RequireRole allow={['ADMIN']}><AdminCoursesPage /></RequireRole>} />
      <Route path="/admin/clases" element={<RequireRole allow={['ADMIN']}><AdminClassesPage /></RequireRole>} />

      <Route path="/alumno/*" element={<Navigate to="/alumno" replace />} />
      <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
