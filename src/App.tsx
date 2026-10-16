import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  DocumentPlusIcon, ArrowUpTrayIcon, PlayIcon, ArrowDownTrayIcon, Cog6ToothIcon,
  FolderOpenIcon, ChevronDownIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { IS_PREVIEW } from './preview/mode';
import { useStages, type StageStatus } from './spec/useStages';
import { useProjectsStore } from './store/useProjectsStore';
import { currentRevision, useProjectStore } from './store/useProjectStore';
import { useHmiStore } from './store/useHmiStore';
import { useSettingsStore } from './store/useSettingsStore';
import type { StageId } from './store/useStageStore';
import UpdateAll from './components/UpdateAll';

// Stable empty list: a new [] inside a store selector would re-render forever.
const NO_SCREENS: never[] = [];

const DOT: Record<StageStatus | 'none', string> = {
  empty: 'bg-steel-300',
  stale: 'bg-amber-500',
  ready: 'bg-green-600',
  none: 'bg-transparent',
};

interface TreeNode { label: string; to?: string; stage?: StageId; children?: TreeNode[]; mono?: boolean }

/** Menu bar entry with a click-open dropdown (closes on outside click). */
function Menu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} className={`px-2.5 py-0.5 rounded-sm ${open ? 'bg-brand-100' : 'hover:bg-steel-200'}`}>{label}</button>
      {open && (
        <div onClick={() => setOpen(false)} className="absolute left-0 top-full mt-0.5 z-50 min-w-56 bg-white border border-steel-300 shadow-lg py-1">
          {children}
        </div>
      )}
    </div>
  );
}

function MenuItem({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className="w-full text-left px-4 py-1.5 hover:bg-brand-50 hover:text-brand-800">{children}</button>;
}

function ToolButton({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button title={title} aria-label={title} onClick={onClick}
      className="w-8 h-8 flex items-center justify-center rounded-sm text-steel-700 hover:bg-brand-50 hover:text-brand-700 border border-transparent hover:border-brand-200">
      {children}
    </button>
  );
}

function TreeItem({ node, depth, stages }: { node: TreeNode; depth: number; stages: Record<StageId, { status: StageStatus }> }) {
  const [open, setOpen] = useState(true);
  const location = useLocation();
  const hasChildren = Boolean(node.children?.length);
  const status = node.stage ? stages[node.stage].status : 'none';
  const active = node.to ? `${location.pathname}${location.search}` === node.to || (!node.to.includes('?') && location.pathname === node.to && !location.search) : false;
  const row = (
    <span className="flex items-center gap-1.5 min-w-0">
      <span className="w-3.5 flex-shrink-0" onClick={(e) => { if (hasChildren) { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); } }}>
        {hasChildren && (open ? <ChevronDownIcon className="w-3.5 h-3.5" /> : <ChevronRightIcon className="w-3.5 h-3.5" />)}
      </span>
      <span className={`truncate ${node.mono ? 'font-mono text-xs' : ''}`}>{node.label}</span>
      <span className={`ml-auto w-2 h-2 rounded-full flex-shrink-0 ${DOT[status]}`} title={status === 'none' ? undefined : status === 'ready' ? 'Done' : status === 'stale' ? 'Out of date' : 'Not started'} />
    </span>
  );
  return (
    <li>
      {node.to ? (
        <NavLink to={node.to} style={{ paddingLeft: 8 + depth * 14 }}
          className={`block pr-2 py-[3px] ${active ? 'bg-brand-600 text-white' : 'text-steel-800 hover:bg-brand-50'}`}>{row}</NavLink>
      ) : (
        <div style={{ paddingLeft: 8 + depth * 14 }} className="pr-2 py-[3px] text-steel-600 cursor-default" onClick={() => setOpen((v) => !v)}>{row}</div>
      )}
      {hasChildren && open && <ul>{node.children!.map((c) => <TreeItem key={c.label + (c.to ?? '')} node={c} depth={depth + 1} stages={stages} />)}</ul>}
    </li>
  );
}

export default function App() {
  const stages = useStages();
  const navigate = useNavigate();
  const { projects, activeId, openProject, ensureActive } = useProjectsStore();
  const { cpuId, modules } = useProjectStore();
  const hmiPart = useHmiStore((s) => s.design?.hmiPartNumber || s.hmiPartNumber);
  const hmiScreens = useHmiStore((s) => s.design?.screens) ?? NO_SCREENS;
  const model = useSettingsStore((s) => s.anthropicModel);
  const rev = currentRevision(useProjectStore((s) => s.info));
  useEffect(() => { ensureActive(); }, [ensureActive]);

  const projectName = projects.find((p) => p.id === activeId)?.name ?? 'Project';
  const equipmentDone = stages.equipment.status !== 'empty';

  const tree: TreeNode = {
    label: projectName,
    children: [
      { label: 'Project data', to: '/project' },
      { label: 'Machine description', to: '/spec', stage: 'spec' },
      {
        label: 'Equipment', to: '/equipment', stage: 'equipment',
        children: equipmentDone ? [
          { label: `CPU ${cpuId}`, mono: true },
          ...modules.map((m, i) => ({ label: `Slot ${i + 1}: ${m}`, mono: true })),
          ...(hmiPart ? [{ label: `HMI ${hmiPart}`, mono: true }] : []),
        ] : undefined,
      },
      { label: 'I/O list', to: '/io', stage: 'io' },
      {
        label: 'Electrical design', to: '/electrical?tab=design', stage: 'electrical',
        children: [
          { label: 'Cabinet wiring', to: '/electrical?tab=cabinet' },
          { label: 'Machine wiring', to: '/electrical?tab=machine' },
          { label: 'Cabinet picture', to: '/electrical?tab=picture' },
        ],
      },
      {
        label: 'HMI screens', to: '/hmi', stage: 'hmi',
        children: hmiScreens.length ? hmiScreens.map((s) => ({ label: s.name, to: `/hmi?screen=${s.id}` })) : undefined,
      },
      { label: 'PLC program', to: '/program', stage: 'program' },
      { label: 'Simulation', to: '/simulate' },
      { label: 'Deliverables', to: '/export' },
    ],
  };

  return (
    <div className="flex flex-col h-screen bg-[#f0f2f3] font-sans text-steel-900 text-[13px]">
      {/* Title bar */}
      <div className="h-7 flex-shrink-0 bg-brand-800 text-white flex items-center px-3 text-xs">
        <span className="font-semibold">PLC Autoprogrammer</span>
        <span className="mx-2 text-brand-300">—</span>
        <span className="truncate text-brand-100">{projectName}</span>
      </div>

      {/* Menu bar */}
      <div className="h-7 flex-shrink-0 bg-[#f7f8f9] border-b border-steel-200 flex items-center px-1 gap-0.5">
        <Menu label="Project">
          <MenuItem onClick={() => navigate('/new')}>New project…</MenuItem>
          <MenuItem onClick={() => navigate('/import')}>Import existing system…</MenuItem>
          <MenuItem onClick={() => navigate('/project')}>Project data and revisions…</MenuItem>
          <div className="border-t border-steel-200 my-1" />
          <div className="px-4 py-1 text-xs text-steel-500">Open project</div>
          {projects.map((p) => (
            <MenuItem key={p.id} onClick={() => openProject(p.id)}>{p.id === activeId ? '● ' : ''}{p.name}</MenuItem>
          ))}
          <div className="border-t border-steel-200 my-1" />
          <MenuItem onClick={() => navigate('/export')}>Deliverables…</MenuItem>
        </Menu>
        <Menu label="Tools">
          <MenuItem onClick={() => navigate('/simulate')}>Simulation</MenuItem>
          <MenuItem onClick={() => navigate('/plc')}>PLC addressing</MenuItem>
        </Menu>
        <Menu label="Options">
          <MenuItem onClick={() => navigate('/settings')}>Settings (AI provider, keys)…</MenuItem>
        </Menu>
      </div>

      {/* Toolbar */}
      <div className="h-10 flex-shrink-0 bg-white border-b border-steel-200 flex items-center px-2 gap-1">
        <ToolButton title="New project" onClick={() => navigate('/new')}><DocumentPlusIcon className="w-5 h-5" /></ToolButton>
        <ToolButton title="Import existing system" onClick={() => navigate('/import')}><ArrowUpTrayIcon className="w-5 h-5" /></ToolButton>
        <span className="w-px h-6 bg-steel-200 mx-1" />
        <ToolButton title="Simulation" onClick={() => navigate('/simulate')}><PlayIcon className="w-5 h-5" /></ToolButton>
        <ToolButton title="Deliverables" onClick={() => navigate('/export')}><ArrowDownTrayIcon className="w-5 h-5" /></ToolButton>
        <span className="w-px h-6 bg-steel-200 mx-1" />
        <ToolButton title="Settings" onClick={() => navigate('/settings')}><Cog6ToothIcon className="w-5 h-5" /></ToolButton>
        <div className="ml-3"><UpdateAll /></div>
        <div className="ml-auto flex items-center gap-2">
          <FolderOpenIcon className="w-4 h-4 text-steel-500" />
          <select aria-label="Open project" value={activeId ?? ''} onChange={(e) => openProject(e.target.value)}
            className="border border-steel-300 rounded-sm px-2 py-1 bg-white max-w-[16rem]">
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Project navigation */}
        <aside className="w-64 flex-shrink-0 bg-white border-r border-steel-300 flex flex-col">
          <div className="h-7 flex items-center px-2 bg-[#e9edef] border-b border-steel-300 text-xs font-semibold text-steel-700">Project navigation</div>
          <nav className="flex-1 overflow-y-auto py-1">
            <ul><TreeItem node={tree} depth={0} stages={stages} /></ul>
          </nav>
          <div className="border-t border-steel-200 px-2 py-1.5 flex gap-3 text-[11px] text-steel-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-600" /> done</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> out of date</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-steel-300" /> to do</span>
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          {IS_PREVIEW && (
            <div className="px-4 py-1 bg-brand-700 text-white text-xs">
              Preview with an example project. Everything is clickable and editable; AI generation and file downloads work when the app runs on your PC.
            </div>
          )}
          <Outlet />
        </main>
      </div>

      {/* Status bar */}
      <div className="h-6 flex-shrink-0 bg-brand-800 text-brand-50 flex items-center gap-5 px-3 text-[11px]">
        <span>Ready</span>
        <span>PLC: {cpuId || '—'}{modules.length ? ` + ${modules.length} module(s)` : ''}</span>
        <span>HMI: {hmiPart || '—'}</span>
        <span>Rev {rev.rev} · {rev.description}</span>
        <span className="ml-auto">AI: {model}</span>
        <span>v0.7.0</span>
      </div>
    </div>
  );
}
