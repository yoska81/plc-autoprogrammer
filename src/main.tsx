import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import IOPage from './pages/IOPage.tsx'
import ProgramPage from './pages/ProgramPage.tsx'
import ExportPage from './pages/ExportPage.tsx'
import SettingsPage from './pages/SettingsPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Navigate to="/io" replace />} />
          <Route path="io" element={<IOPage />} />
          <Route path="program" element={<ProgramPage />} />
          <Route path="export" element={<ExportPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
