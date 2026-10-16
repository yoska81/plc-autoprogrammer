import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { IS_PREVIEW, PREVIEW_ACCOUNT_KEY } from './preview/mode'
import { useSettingsStore } from './store/useSettingsStore'
import { seedSampleProject } from './preview/sampleProject'
import './index.css'
import App from './App.tsx'
import Notice from './components/Notice.tsx'
import IOPage from './pages/IOPage.tsx'
import ProgramPage from './plc/pages/ProgramPage.tsx'
import ExportPage from './pages/ExportPage.tsx'
import SettingsPage from './pages/SettingsPage.tsx'
import ProjectDataPage from './pages/ProjectDataPage.tsx'
import PlcSetupPage from './plc/pages/PlcSetupPage.tsx'
import PrintPage from './plc/pages/PrintPage.tsx'
import ImportPage from './pages/ImportPage.tsx'
import ElectricalPage from './pages/ElectricalPage.tsx'
import PrintElectricalPage from './pages/PrintElectricalPage.tsx'
import SpecPage from './pages/SpecPage.tsx'
import HmiPage from './pages/HmiPage.tsx'
import SimulatePage from './plc/pages/SimulatePage.tsx'
import EquipmentPage from './pages/EquipmentPage.tsx'
import NewProjectPage from './pages/NewProjectPage.tsx'

// The side-panel preview frame needs hash routing, blocks confirm() dialogs
// (they always answer "cancel"), and opens with an example project.
// eslint-disable-next-line react-refresh/only-export-components -- entry file, never hot-reloaded as a module
const Router = IS_PREVIEW ? HashRouter : BrowserRouter
if (IS_PREVIEW) {
  window.confirm = () => true
  seedSampleProject()
  // AI runs on the viewer's Claude account here: no API key needed.
  const settings = useSettingsStore.getState()
  if (!settings.anthropicApiKey) settings.setAnthropicApiKey(PREVIEW_ACCOUNT_KEY)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <Routes>
        <Route path="/print" element={<PrintPage />} />
        <Route path="/new" element={<NewProjectPage />} />
        <Route path="/print-electrical" element={<PrintElectricalPage />} />
        <Route path="/" element={<App />}>
          <Route index element={<Navigate to="/spec" replace />} />
          <Route path="spec" element={<SpecPage />} />
          <Route path="equipment" element={<EquipmentPage />} />
          <Route path="hmi" element={<HmiPage />} />
          <Route path="simulate" element={<SimulatePage />} />
          <Route path="plc" element={<PlcSetupPage />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="electrical" element={<ElectricalPage />} />
          <Route path="io" element={<IOPage />} />
          <Route path="program" element={<ProgramPage />} />
          <Route path="export" element={<ExportPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="project" element={<ProjectDataPage />} />
        </Route>
      </Routes>
      <Notice />
    </Router>
  </StrictMode>,
)
