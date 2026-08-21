import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import RequireRole from '../features/auth/RequireRole'

const IntroGatePage = lazy(() => import('../pages/public/IntroGatePage'))
const BlogPage = lazy(() => import('../pages/public/BlogPage'))
const BlogPostPage = lazy(() => import('../pages/public/BlogPostPage'))
const ProgramsPage = lazy(() => import('../pages/public/ProgramsPage'))
const CourseDetailPage = lazy(() => import('../pages/public/CourseDetailPage'))
const PlacementTestPage = lazy(() => import('../pages/public/PlacementTestPage'))
const PricingPage = lazy(() => import('../pages/public/PricingPage'))
const TeachersPage = lazy(() => import('../pages/public/TeachersPage'))
const AboutPage = lazy(() => import('../pages/public/AboutPage'))
const ContactPage = lazy(() => import('../pages/public/ContactPage'))
const LegalPage = lazy(() => import('../pages/public/LegalPage'))
const NotFoundPage = lazy(() => import('../pages/public/NotFoundPage'))
const LoginPage = lazy(() => import('../pages/auth/LoginPage'))
const AccountActivationPage = lazy(() => import('../pages/auth/AccountActivationPage'))
const PasswordRecoveryPage = lazy(() => import('../pages/auth/PasswordRecoveryPage'))
const AccountProfilePage = lazy(() => import('../pages/account/AccountProfilePage'))

const StudentDashboard = lazy(() => import('../pages/student/StudentDashboard'))
const StudentLevelPage = lazy(() => import('../pages/student/StudentLevelPage'))
const StudentFilesPage = lazy(() => import('../pages/student/StudentFilesPage'))
const StudentMaterialPage = lazy(() => import('../pages/student/StudentMaterialPage'))
const StudentAssignmentsPage = lazy(() => import('../pages/student/StudentAssignmentsPage'))
const StudentClassesPage = lazy(() => import('../pages/student/StudentClassesPage'))
const StudentOnlineClassPage = lazy(() => import('../pages/student/StudentOnlineClassPage'))
const StudentNotificationsPage = lazy(() => import('../pages/student/StudentNotificationsPage'))

const TeacherDashboard = lazy(() => import('../pages/teacher/TeacherDashboard'))
const TeacherStudentsPage = lazy(() => import('../pages/teacher/TeacherStudentsPage'))
const TeacherLevelsPage = lazy(() => import('../pages/teacher/TeacherLevelsPage'))
const TeacherClassesPage = lazy(() => import('../pages/teacher/TeacherClassesPage'))
const TeacherAgendaPage = lazy(() => import('../pages/teacher/TeacherAgendaPage'))
const TeacherMaterialPage = lazy(() => import('../pages/teacher/TeacherMaterialPage'))
const TeacherAssignmentsPage = lazy(() => import('../pages/teacher/TeacherAssignmentsPage'))
const TeacherCorrectionsPage = lazy(() => import('../pages/teacher/TeacherCorrectionsPage'))

const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'))
const AdminSiteEditor = lazy(() => import('../pages/admin/AdminSiteEditor'))
const AdminAboutEditor = lazy(() => import('../pages/admin/AdminAboutEditor'))
const AdminMediaLibrary = lazy(() => import('../pages/admin/AdminMediaLibrary'))
const AdminBlogManager = lazy(() => import('../pages/admin/AdminBlogManager'))
const AdminContactsPage = lazy(() => import('../pages/admin/AdminContactsPage'))
const AdminNotificationsPage = lazy(() => import('../pages/admin/AdminNotificationsPage'))
const AdminStudentsPage = lazy(() => import('../pages/admin/AdminStudentsPhase14Page'))
const AdminStudentDetailPage = lazy(() => import('../pages/admin/AdminStudentDetailPhase14Page'))
const AdminTeachersPage = lazy(() => import('../pages/admin/AdminTeachersPhase14Page'))
const AdminTeacherDetailPage = lazy(() => import('../pages/admin/AdminTeacherDetailPhase14Page'))
const AdminTeacherPublicProfilesPage = lazy(() => import('../pages/admin/AdminTeacherPublicProfilesPage'))
const AdminCoursesPage = lazy(() => import('../pages/admin/AdminCoursesPage'))
const AdminClassesPage = lazy(() => import('../pages/admin/AdminClassesPage'))
const AdminAgendaPage = lazy(() => import('../pages/admin/AdminAgendaPage'))
const AdminPaymentsPage = lazy(() => import('../pages/admin/AdminPaymentsPage'))
const AdminClassDeliveryPage = lazy(() => import('../pages/admin/AdminClassDeliveryPage'))
const AdminZoomIntegrationPage = lazy(() => import('../pages/admin/AdminZoomIntegrationPage'))
const AdminPlacementTestPage = lazy(() => import('../pages/admin/AdminPlacementTestPage'))
const AdminPlacementResultsPage = lazy(() => import('../pages/admin/AdminPlacementResultsPage'))
const AdminPricingPage = lazy(() => import('../pages/admin/AdminPricingPage'))
const AdminSettingsPage = lazy(() => import('../pages/admin/AdminSettingsPage'))
const AdminSystemStatusPage = lazy(() => import('../pages/admin/AdminSystemStatusPage'))

function RouteLoading() {
  return (
    <div className="route-loading" role="status" aria-live="polite" aria-label="Cargando página">
      Cargando…
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/" element={<IntroGatePage />} />
        <Route path="/programas" element={<ProgramsPage />} />
        <Route path="/programas/:slug" element={<CourseDetailPage />} />
        <Route path="/test-de-nivel" element={<PlacementTestPage />} />
        <Route path="/tarifas" element={<PricingPage />} />
        <Route path="/profesores" element={<TeachersPage />} />
        <Route path="/sobre-nosotros" element={<AboutPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
        <Route path="/contacto" element={<ContactPage />} />
        <Route path="/cookies" element={<LegalPage kind="cookies" />} />
        <Route path="/privacidad" element={<LegalPage kind="privacy" />} />
        <Route path="/aviso-legal" element={<LegalPage kind="legal" />} />
        <Route path="/acceso" element={<LoginPage />} />
        <Route path="/activar-cuenta" element={<AccountActivationPage />} />
        <Route path="/recuperar-cuenta" element={<PasswordRecoveryPage />} />

        <Route path="/alumno" element={<RequireRole allow={['STUDENT']}><StudentDashboard /></RequireRole>} />
        <Route path="/alumno/nivel" element={<RequireRole allow={['STUDENT']}><StudentLevelPage /></RequireRole>} />
        <Route path="/alumno/clases" element={<RequireRole allow={['STUDENT']}><StudentClassesPage /></RequireRole>} />
        <Route path="/alumno/aula/:classId" element={<RequireRole allow={['STUDENT']}><StudentOnlineClassPage /></RequireRole>} />
        <Route path="/alumno/material" element={<RequireRole allow={['STUDENT']}><StudentMaterialPage /></RequireRole>} />
        <Route path="/alumno/tareas" element={<RequireRole allow={['STUDENT']}><StudentAssignmentsPage /></RequireRole>} />
        <Route path="/alumno/archivos" element={<RequireRole allow={['STUDENT']}><StudentFilesPage /></RequireRole>} />
        <Route path="/alumno/avisos" element={<RequireRole allow={['STUDENT']}><StudentNotificationsPage /></RequireRole>} />
        <Route path="/alumno/perfil" element={<RequireRole allow={['STUDENT']}><AccountProfilePage portal="STUDENT" /></RequireRole>} />

        <Route path="/profesor" element={<RequireRole allow={['TEACHER']}><TeacherDashboard /></RequireRole>} />
        <Route path="/profesor/alumnos" element={<RequireRole allow={['TEACHER']}><TeacherStudentsPage /></RequireRole>} />
        <Route path="/profesor/niveles" element={<RequireRole allow={['TEACHER']}><TeacherLevelsPage /></RequireRole>} />
        <Route path="/profesor/clases" element={<RequireRole allow={['TEACHER']}><TeacherClassesPage /></RequireRole>} />
        <Route path="/profesor/agenda" element={<RequireRole allow={['TEACHER']}><TeacherAgendaPage /></RequireRole>} />
        <Route path="/profesor/material" element={<RequireRole allow={['TEACHER']}><TeacherMaterialPage /></RequireRole>} />
        <Route path="/profesor/tareas" element={<RequireRole allow={['TEACHER']}><TeacherAssignmentsPage /></RequireRole>} />
        <Route path="/profesor/correcciones" element={<RequireRole allow={['TEACHER']}><TeacherCorrectionsPage /></RequireRole>} />
        <Route path="/profesor/perfil" element={<RequireRole allow={['TEACHER']}><AccountProfilePage portal="TEACHER" /></RequireRole>} />

        <Route path="/admin" element={<RequireRole allow={['ADMIN']}><AdminDashboard /></RequireRole>} />
        <Route path="/admin/web" element={<RequireRole allow={['ADMIN']}><AdminSiteEditor /></RequireRole>} />
        <Route path="/admin/web/sobre-nosotros" element={<RequireRole allow={['ADMIN']}><AdminAboutEditor /></RequireRole>} />
        <Route path="/admin/blog" element={<RequireRole allow={['ADMIN']}><AdminBlogManager /></RequireRole>} />
        <Route path="/admin/multimedia" element={<RequireRole allow={['ADMIN']}><AdminMediaLibrary /></RequireRole>} />
        <Route path="/admin/contactos" element={<RequireRole allow={['ADMIN']}><AdminContactsPage /></RequireRole>} />
        <Route path="/admin/avisos" element={<RequireRole allow={['ADMIN']}><AdminNotificationsPage /></RequireRole>} />
        <Route path="/admin/alumnos" element={<RequireRole allow={['ADMIN']}><AdminStudentsPage /></RequireRole>} />
        <Route path="/admin/alumnos/:studentId" element={<RequireRole allow={['ADMIN']}><AdminStudentDetailPage /></RequireRole>} />
        <Route path="/admin/profesores" element={<RequireRole allow={['ADMIN']}><AdminTeachersPage /></RequireRole>} />
        <Route path="/admin/profesores/:teacherId" element={<RequireRole allow={['ADMIN']}><AdminTeacherDetailPage /></RequireRole>} />
        <Route path="/admin/profesores/publicos" element={<RequireRole allow={['ADMIN']}><AdminTeacherPublicProfilesPage /></RequireRole>} />
        <Route path="/admin/cursos" element={<RequireRole allow={['ADMIN']}><AdminCoursesPage /></RequireRole>} />
        <Route path="/admin/clases" element={<RequireRole allow={['ADMIN']}><AdminClassesPage /></RequireRole>} />
        <Route path="/admin/agenda" element={<RequireRole allow={['ADMIN']}><AdminAgendaPage /></RequireRole>} />
        <Route path="/admin/pagos" element={<RequireRole allow={['ADMIN']}><AdminPaymentsPage /></RequireRole>} />
        <Route path="/admin/aula-online" element={<RequireRole allow={['ADMIN']}><AdminClassDeliveryPage /></RequireRole>} />
        <Route path="/admin/zoom" element={<RequireRole allow={['ADMIN']}><AdminZoomIntegrationPage /></RequireRole>} />
        <Route path="/admin/test-de-nivel" element={<RequireRole allow={['ADMIN']}><AdminPlacementTestPage /></RequireRole>} />
        <Route path="/admin/test-de-nivel/resultados" element={<RequireRole allow={['ADMIN']}><AdminPlacementResultsPage /></RequireRole>} />
        <Route path="/admin/tarifas" element={<RequireRole allow={['ADMIN']}><AdminPricingPage /></RequireRole>} />
        <Route path="/admin/configuracion" element={<RequireRole allow={['ADMIN']}><AdminSettingsPage /></RequireRole>} />
        <Route path="/admin/sistema" element={<RequireRole allow={['ADMIN']}><AdminSystemStatusPage /></RequireRole>} />

        <Route path="/alumno/*" element={<Navigate to="/alumno" replace />} />
        <Route path="/profesor/*" element={<Navigate to="/profesor" replace />} />
        <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
