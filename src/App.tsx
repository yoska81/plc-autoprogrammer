import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { IS_PREVIEW } from './preview/mode';
import { useStages, type StageStatus } from './spec/useStages';
import { useProjectsStore } from './store/useProjectsStore';
import type { StageId } from './store/useStageStore';
import UpdateAll from './components/UpdateAll';

const STEPS: { to: string; label: string; hint: string; stage: StageId | null }[] = [
  { to: '/spec', label: 'Describe', hint: 'What the machine does', stage: 'spec' },
  { to: '/equipment', label: 'Equipment', hint: 'PLC, I/O modules, HMI', stage: 'equipment' },
  { to: '/io', label: 'I/O List', hint: 'Every input and output', stage: 'io' },
  { to: '/electrical', label: 'Electrical', hint: 'Cabinet & machine wiring', stage: 'electrical' },
  { to: '/hmi', label: 'HMI', hint: 'Operator screens', stage: 'hmi' },
  { to: '/program', label: 'PLC Program', hint: 'Ladder logic', stage: 'program' },
  { to: '/simulate', label: 'Simulate', hint: 'Run it before building', stage: null },
  { to: '/export', label: 'Deliverables', hint: 'Drawings, BOM, reports', stage: null },
];

const TOOLS = [
  { to: '/import', label: 'Import existing system' },
  { to: '/plc', label: 'PLC addressing' },
  { to: '/settings', label: 'Settings' },
];

const STATUS: Record<StageStatus, { text: string; dot: string }> = {
  empty: { text: 'Not started', dot: 'bg-steel-300' },
  stale: { text: 'Out of date', dot: 'bg-amber-500' },
  ready: { text: 'Done', dot: 'bg-petrol-500' },
};

function ProjectBar() {
  const { projects, activeId, openProject, ensureActive } = useProjectsStore();
  const navigate = useNavigate();
  useEffect(() => { ensureActive(); }, [ensureActive]);
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="project-select" className="text-xs uppercase tracking-wider text-petrol-200">Project</label>
      <select id="project-select" value={activeId ?? ''} onChange={(e) => openProject(e.target.value)}
        className="bg-petrol-800 text-white text-sm rounded px-2 py-1 border border-petrol-600 max-w-[16rem]">
        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <button onClick={() => navigate('/new')} className="text-sm px-3 py-1 rounded bg-petrol-500 hover:bg-petrol-400 text-white font-medium">
        + New project
      </button>
    </div>
  );
}

export default function App() {
  const stages = useStages();
  return (
    <div className="flex flex-col h-screen bg-steel-50 font-sans text-steel-900">
      <header className="h-12 flex-shrink-0 bg-petrol-900 text-white flex items-center gap-6 px-4">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-semibold tracking-tight">PLC Autoprogrammer</span>
          <span className="text-xs text-petrol-200 hidden md:inline">Machine control configurator</span>
        </div>
        <ProjectBar />
        <div className="ml-auto flex items-center gap-3">
          <UpdateAll />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-white border-r border-steel-200 flex flex-col flex-shrink-0">
          <p className="px-5 pt-4 pb-2 text-xs font-semibold text-steel-500 uppercase tracking-wider">Configuration steps</p>
          <nav className="flex-1 overflow-y-auto">
            <ol>
              {STEPS.map((s, i) => {
                const status = s.stage ? STATUS[stages[s.stage].status] : null;
                return (
                  <li key={s.to}>
                    <NavLink to={s.to} className={({ isActive }) =>
                      `flex items-start gap-3 px-5 py-2.5 border-l-4 transition-colors ${isActive ? 'border-petrol-600 bg-petrol-50' : 'border-transparent hover:bg-steel-50'}`}>
                      {({ isActive }) => (
                        <>
                          <span className={`mt-0.5 w-6 h-6 flex-shrink-0 rounded-full text-xs font-semibold flex items-center justify-center ${isActive ? 'bg-petrol-600 text-white' : 'bg-steel-100 text-steel-600'}`}>{i + 1}</span>
                          <span className="flex-1 min-w-0">
                            <span className={`block text-sm font-medium ${isActive ? 'text-petrol-800' : 'text-steel-800'}`}>{s.label}</span>
                            <span className="flex items-center gap-1.5 text-xs text-steel-500">
                              {status && <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />}
                              {status ? status.text : s.hint}
                            </span>
                          </span>
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ol>
            <p className="px-5 pt-5 pb-1 text-xs font-semibold text-steel-500 uppercase tracking-wider">Tools</p>
            {TOOLS.map((t) => (
              <NavLink key={t.to} to={t.to} className={({ isActive }) => `block px-5 py-1.5 text-sm ${isActive ? 'text-petrol-700 font-medium' : 'text-steel-600 hover:text-steel-900'}`}>{t.label}</NavLink>
            ))}
          </nav>
          <p className="px-5 py-3 text-xs text-steel-400 border-t border-steel-100">v0.6.0</p>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          {IS_PREVIEW && (
            <div className="px-6 py-1.5 bg-petrol-700 text-white text-xs">
              Preview with an example project. Everything is clickable and editable; AI generation and file downloads work when the app runs on your PC.
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
