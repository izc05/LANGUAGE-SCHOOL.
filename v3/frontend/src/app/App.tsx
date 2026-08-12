import { Navigate, Route, Routes } from 'react-router'
import RequireRole from '../features/auth/RequireRole'
import HomePage from '../pages/public/HomePage'
import BlogPage from '../pages/public/BlogPage'
import ProgramsPage from '../pages/public/ProgramsPage'
import PricingPage from '../pages/public/PricingPage'
import TeachersPage from '../pages/public/TeachersPage'
import AboutPage from '../pages/public/AboutPage'
import ContactPage from '../pages/public/ContactPage'
import NotFoundPage from '../pages/public/NotFoundPage'
import LoginPage from '../pages/auth/LoginPage'
import StudentDashboard from '../pages/student/StudentDashboard'
import StudentFilesPage from '../pages/student/StudentFilesPage'
import StudentMaterialPage from '../pages/student/StudentMaterialPage'
import StudentAssignmentsPage from '../pages/student/StudentAssignmentsPage'
import StudentClassesPage from '../pages/student/StudentClassesPage'
import StudentNotificationsPage from '../pages/student/StudentNotificationsPage'
import TeacherDashboard from '../pages/teacher/TeacherDashboard'
import TeacherStudentsPage from '../pages/teacher/TeacherStudentsPage'
import TeacherClassesPage from '../pages/teacher/TeacherClassesPage'
import TeacherMaterialPage from '../pages/teacher/TeacherMaterialPage'
import TeacherAssignmentsPage from '../pages/teacher/TeacherAssignmentsPage'
import TeacherCorrectionsPage from '../pages/teacher/TeacherCorrectionsPage'
import AdminDashboard from '../pages/admin/AdminDashboard'
import AdminSiteEditor from '../pages/admin/AdminSiteEditor'
import AdminAboutEditor from '../pages/admin/AdminAboutEditor'
import AdminMediaLibrary from '../pages/admin/AdminMediaLibrary'
import AdminBlogManager from '../pages/admin/AdminBlogManager'
import AdminStudentsPage from '../pages/admin/AdminStudentsPage'
import AdminTeachersPage from '../pages/admin/AdminTeachersPage'
import AdminTeacherPublicProfilesPage from '../pages/admin/AdminTeacherPublicProfilesPage'
import AdminCoursesPage from '../pages/admin/AdminCoursesPage'
import AdminClassesPage from '../pages/admin/AdminClassesPage'
import AdminPricingPage from '../pages/admin/AdminPricingPage'
import AdminSettingsPage from '../pages/admin/AdminSettingsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/programas" element={<ProgramsPage />} />
      <Route path="/tarifas" element={<PricingPage />} />
      <Route path="/profesores" element={<TeachersPage />} />
      <Route path="/sobre-nosotros" element={<AboutPage />} />
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/contacto" element={<ContactPage />} />
      <Route path="/acceso" element={<LoginPage />} />

      <Route path="/alumno" element={<RequireRole allow={['STUDENT']}><StudentDashboard /></RequireRole>} />
      <Route path="/alumno/clases" element={<RequireRole allow={['STUDENT']}><StudentClassesPage /></RequireRole>} />
      <Route path="/alumno/material" element={<RequireRole allow={['STUDENT']}><StudentMaterialPage /></RequireRole>} />
      <Route path="/alumno/tareas" element={<RequireRole allow={['STUDENT']}><StudentAssignmentsPage /></RequireRole>} />
      <Route path="/alumno/archivos" element={<RequireRole allow={['STUDENT']}><StudentFilesPage /></RequireRole>} />
      <Route path="/alumno/avisos" element={<RequireRole allow={['STUDENT']}><StudentNotificationsPage /></RequireRole>} />

      <Route path="/profesor" element={<RequireRole allow={['TEACHER']}><TeacherDashboard /></RequireRole>} />
      <Route path="/profesor/alumnos" element={<RequireRole allow={['TEACHER']}><TeacherStudentsPage /></RequireRole>} />
      <Route path="/profesor/clases" element={<RequireRole allow={['TEACHER']}><TeacherClassesPage /></RequireRole>} />
      <Route path="/profesor/material" element={<RequireRole allow={['TEACHER']}><TeacherMaterialPage /></RequireRole>} />
      <Route path="/profesor/tareas" element={<RequireRole allow={['TEACHER']}><TeacherAssignmentsPage /></RequireRole>} />
      <Route path="/profesor/correcciones" element={<RequireRole allow={['TEACHER']}><TeacherCorrectionsPage /></RequireRole>} />

      <Route path="/admin" element={<RequireRole allow={['ADMIN']}><AdminDashboard /></RequireRole>} />
      <Route path="/admin/web" element={<RequireRole allow={['ADMIN']}><AdminSiteEditor /></RequireRole>} />
      <Route path="/admin/web/sobre-nosotros" element={<RequireRole allow={['ADMIN']}><AdminAboutEditor /></RequireRole>} />
      <Route path="/admin/blog" element={<RequireRole allow={['ADMIN']}><AdminBlogManager /></RequireRole>} />
      <Route path="/admin/multimedia" element={<RequireRole allow={['ADMIN']}><AdminMediaLibrary /></RequireRole>} />
      <Route path="/admin/alumnos" element={<RequireRole allow={['ADMIN']}><AdminStudentsPage /></RequireRole>} />
      <Route path="/admin/profesores" element={<RequireRole allow={['ADMIN']}><AdminTeachersPage /></RequireRole>} />
      <Route path="/admin/profesores/publicos" element={<RequireRole allow={['ADMIN']}><AdminTeacherPublicProfilesPage /></RequireRole>} />
      <Route path="/admin/cursos" element={<RequireRole allow={['ADMIN']}><AdminCoursesPage /></RequireRole>} />
      <Route path="/admin/clases" element={<RequireRole allow={['ADMIN']}><AdminClassesPage /></RequireRole>} />
      <Route path="/admin/tarifas" element={<RequireRole allow={['ADMIN']}><AdminPricingPage /></RequireRole>} />
      <Route path="/admin/configuracion" element={<RequireRole allow={['ADMIN']}><AdminSettingsPage /></RequireRole>} />

      <Route path="/alumno/*" element={<Navigate to="/alumno" replace />} />
      <Route path="/profesor/*" element={<Navigate to="/profesor" replace />} />
      <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
