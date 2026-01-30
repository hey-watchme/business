import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'
import { SubjectProvider } from './contexts/SubjectContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <SubjectProvider>
        <App />
      </SubjectProvider>
    </AuthProvider>
  </StrictMode>,
)
