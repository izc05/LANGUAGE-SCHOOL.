import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './app/App'
import { AuthProvider } from './features/auth/AuthProvider'
import './styles/global.css'
import './styles/admin-cms.css'
import './styles/admin-students.css'
import './styles/admin-academy.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('No se ha encontrado el elemento #root')
}

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
