import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { IS_PREVIEW } from './preview/mode';
import { useStages, type StageStatus } from './spec/useStages';
import { useProjectsStore } from './store/useProjectsStore';
import type { StageId } from './store/useStageStore';
import UpdateAll from './components/UpdateAll';

const STAGES: { to: string; label: string; stage: StageId | null }[] = [
  { to: '/spec', label: 'Describe', stage: 'spec' },
  { to: '/io', label: 'I/O List', stage: 'io' },
  { to: '/electrical', label: 'Electrical', stage: 'electrical' },
  { to: '/hmi', label: 'HMI', stage: 'hmi' },
  { to: '/program', label: 'PLC Program', stage: 'program' },
  { to: '/simulate', label: 'Simulate', stage: null },
  { to: '/export', label: 'Deliverables', stage: null },
];

const TOOLS = [
  { to: '/import', label: 'Import existing system' },
  { to: '/plc', label: 'PLC addressing' },
  { to: '/settings', label: 'Settings' },
];

const BADGE: Record<StageStatus, { text: string; cls: string; title: string }> = {
  empty: { text: '', cls: 'bg-gray-700', title: 'Not started' },
  stale: { text: '!', cls: 'bg-amber-500 text-gray-900', title: 'Out of date' },
  ready: { text: '✓', cls: 'bg-green-600 text-white', title: 'Up to date' },
};

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${isActive ? 'text-white bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`;

function ProjectSwitcher() {
  const { projects, activeId, openProject, createProject, ensureActive } = useProjectsStore();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => { ensureActive(); }, [ensureActive]);

  const create = () => {
    if (!name.trim()) return;
    createProject(name.trim());
    setName('');
    setAdding(false);
  };

  return (
    <div className="px-3 py-3 border-b border-gray-700 space-y-2">
      <label htmlFor="project-select" className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">Project</label>
      <select id="project-select" value={activeId ?? ''} onChange={(e) => openProject(e.target.value)}
        className="w-full bg-gray-800 text-gray-100 text-sm rounded px-2 py-1.5 border border-gray-700">
        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      {adding ? (
        <div className="flex gap-1">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="New project name"
            onKeyDown={(e) => { if (e.key === 'Enter') create(); if (e.key === 'Escape') setAdding(false); }}
            className="flex-1 min-w-0 bg-gray-800 text-gray-100 text-sm rounded px-2 py-1 border border-gray-600" />
          <button onClick={create} className="px-2 text-sm bg-blue-600 text-white rounded">Add</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="w-full text-left text-xs text-gray-400 hover:text-white px-1">+ New project</button>
      )}
    </div>
  );
}

export default function App() {
  const stages = useStages();
  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-60 bg-gray-900 text-gray-300 flex flex-col flex-shrink-0">
        <div className="px-5 py-4 border-b border-gray-700">
          <h1 className="text-base font-bold text-white tracking-tight">PLC Autoprogrammer</h1>
          <p className="text-xs text-gray-500 mt-0.5">Spec → I/O → Electrical → HMI → PLC</p>
        </div>
        <ProjectSwitcher />
        <nav className="flex-1 px-3 py-3 overflow-y-auto">
          <ol className="space-y-0.5">
            {STAGES.map((s, i) => {
              const status = s.stage ? stages[s.stage].status : null;
              const badge = status ? BADGE[status] : null;
              return (
                <li key={s.to}>
                  <NavLink to={s.to} className={linkCls}>
                    <span className="w-5 h-5 flex-shrink-0 rounded-full border border-gray-600 text-xs flex items-center justify-center text-gray-400">{i + 1}</span>
                    <span className="flex-1">{s.label}</span>
                    {badge && status !== 'empty' && (
                      <span title={badge.title} className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center ${badge.cls}`}>{badge.text}</span>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ol>
          <UpdateAll />
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 mt-5 mb-1">Tools</p>
          {TOOLS.map((t) => <NavLink key={t.to} to={t.to} className={linkCls}>{t.label}</NavLink>)}
        </nav>
        <div className="px-5 py-3 border-t border-gray-700">
          <p className="text-xs text-gray-600">v0.5.0</p>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        {IS_PREVIEW && (
          <div className="px-6 py-2 bg-indigo-600 text-white text-xs">
            Preview with an example project. Everything is clickable and editable here; AI generation and file downloads work when the app runs on your PC.
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
