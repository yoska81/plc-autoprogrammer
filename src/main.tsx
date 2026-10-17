import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { IS_PREVIEW, PREVIEW_ACCOUNT_KEY } from './preview/mode'
import { useSettingsStore } from './store/useSettingsStore'
import { seedSampleProject } from './preview/sampleProject'
import './index.css'
import App from './App.tsx'
import { installQaSync } from './components/questions/qa'
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
import ReviewPage from './review/ReviewPage.tsx'
import SourcingPage from './pages/SourcingPage.tsx'
import EngineerPage from './pages/EngineerPage.tsx'
import SimulatePage from './plc/pages/SimulatePage.tsx'
import OnlinePage from './online/OnlinePage.tsx'
import EquipmentPage from './pages/EquipmentPage.tsx'
import NewProjectPage from './pages/NewProjectPage.tsx'
import CommissioningPage from './commissioning/CommissioningPage.tsx'
import RedlinesPage from './redlines/RedlinesPage.tsx'

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

// Questions & answers are part of the spec (sections.qa), kept in step with the question list.
installQaSync()

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
          <Route path="online" element={<OnlinePage />} />
          <Route path="plc" element={<PlcSetupPage />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="electrical" element={<ElectricalPage />} />
          <Route path="io" element={<IOPage />} />
          <Route path="program" element={<ProgramPage />} />
          <Route path="review" element={<ReviewPage />} />
          <Route path="sourcing" element={<SourcingPage />} />
          <Route path="engineer" element={<EngineerPage />} />
          <Route path="export" element={<ExportPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="project" element={<ProjectDataPage />} />
          <Route path="commissioning" element={<CommissioningPage />} />
          <Route path="redlines" element={<RedlinesPage />} />
        </Route>
      </Routes>
      <Notice />
    </Router>
  </StrictMode>,
)
