import { Navigate, Route, Routes } from 'react-router'
import HomePage from '../pages/public/HomePage'
import BlogPage from '../pages/public/BlogPage'
import LoginPage from '../pages/auth/LoginPage'
import StudentDashboard from '../pages/student/StudentDashboard'
import TeacherDashboard from '../pages/teacher/TeacherDashboard'
import AdminDashboard from '../pages/admin/AdminDashboard'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/acceso" element={<LoginPage />} />
      <Route path="/alumno" element={<StudentDashboard />} />
      <Route path="/profesor" element={<TeacherDashboard />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
