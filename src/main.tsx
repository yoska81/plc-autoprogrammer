import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { IS_PREVIEW } from './preview/mode'
import { seedSampleProject } from './preview/sampleProject'
import './index.css'
import App from './App.tsx'
import IOPage from './pages/IOPage.tsx'
import ProgramPage from './pages/ProgramPage.tsx'
import ExportPage from './pages/ExportPage.tsx'
import SettingsPage from './pages/SettingsPage.tsx'
import PlcSetupPage from './pages/PlcSetupPage.tsx'
import PrintPage from './pages/PrintPage.tsx'
import ImportPage from './pages/ImportPage.tsx'
import ElectricalPage from './pages/ElectricalPage.tsx'
import PrintElectricalPage from './pages/PrintElectricalPage.tsx'

// The side-panel preview frame needs hash routing, blocks confirm() dialogs
// (they always answer "cancel"), and opens with an example project.
// eslint-disable-next-line react-refresh/only-export-components -- entry file, never hot-reloaded as a module
const Router = IS_PREVIEW ? HashRouter : BrowserRouter
if (IS_PREVIEW) {
  window.confirm = () => true
  seedSampleProject()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <Routes>
        <Route path="/print" element={<PrintPage />} />
        <Route path="/print-electrical" element={<PrintElectricalPage />} />
        <Route path="/" element={<App />}>
          <Route index element={<Navigate to="/plc" replace />} />
          <Route path="plc" element={<PlcSetupPage />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="electrical" element={<ElectricalPage />} />
          <Route path="io" element={<IOPage />} />
          <Route path="program" element={<ProgramPage />} />
          <Route path="export" element={<ExportPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Router>
  </StrictMode>,
)
