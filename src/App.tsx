import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  DocumentPlusIcon, ArrowUpTrayIcon, PlayIcon, ArrowDownTrayIcon, Cog6ToothIcon,
  FolderOpenIcon, ChevronDownIcon, ChevronRightIcon, FolderIcon, DocumentIcon, InformationCircleIcon,
  ShieldCheckIcon, SignalIcon,
} from '@heroicons/react/24/outline';
import { IS_PREVIEW } from './preview/mode';
import { useAutoReview } from './review/useAutoReview';
import { ReviewStatus, ReviewTreeBadge } from './review/ReviewBadge';
import { useStages, type StageStatus } from './spec/useStages';
import { useProjectsStore } from './store/useProjectsStore';
import { currentRevision, useProjectStore } from './store/useProjectStore';
import { useHmiStore } from './store/useHmiStore';
import type { StageId } from './store/useStageStore';
import UpdateAll from './components/UpdateAll';
import ResizablePane from './components/ResizablePane';
import { EditorBar, PortalBrand, TaskCards } from './shell/tia';
import { useOpenCounts } from './components/questions/useQuestionStore';

// Stable empty list: a new [] inside a store selector would re-render forever.
const NO_SCREENS: never[] = [];

const DOT: Record<StageStatus | 'none', string> = {
  empty: 'bg-steel-300',
  stale: 'bg-amber-500',
  ready: 'bg-green-600',
  none: 'bg-transparent',
};

interface TreeNode { label: string; to?: string; stage?: StageId; children?: TreeNode[]; mono?: boolean; badge?: ReactNode; /** Open questions on this page. */ questions?: number }

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
      <button onClick={() => setOpen((v) => !v)} className={`h-6 px-2.5 text-[13px] ${open ? 'bg-brand-100 text-brand-900' : 'text-steel-800 hover:bg-steel-200'}`}>{label}</button>
      {open && (
        <div onClick={() => setOpen(false)} className="absolute left-0 top-full mt-1 z-50 min-w-56 bg-white text-steel-900 border border-steel-300 shadow-lg py-1">
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
      className="w-8 h-8 flex items-center justify-center text-steel-700 hover:bg-brand-50 hover:text-brand-800 border border-transparent hover:border-brand-200">
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
      {hasChildren ? <FolderIcon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-white' : 'text-steel-500'}`} /> : <DocumentIcon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-white' : 'text-steel-400'}`} />}
      <span className={`truncate ${node.mono ? 'font-mono text-xs' : ''}`}>{node.label}</span>
      {node.questions ? <span className="flex-shrink-0 rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-900" title={`${node.questions} open question${node.questions === 1 ? '' : 's'}`} aria-label={`${node.questions} open questions`}>{node.questions}?</span> : null}
      {node.badge}
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
  const openQ = useOpenCounts();
  const navigate = useNavigate();
  const { projects, activeId, openProject, ensureActive } = useProjectsStore();
  const { cpuId, modules } = useProjectStore();
  const hmiPart = useHmiStore((s) => s.design?.hmiPartNumber || s.hmiPartNumber);
  const hmiScreens = useHmiStore((s) => s.design?.screens) ?? NO_SCREENS;
  const rev = currentRevision(useProjectStore((s) => s.info));
  useEffect(() => { ensureActive(); }, [ensureActive]);
  useAutoReview();

  const projectName = projects.find((p) => p.id === activeId)?.name ?? 'Project';
  const equipmentDone = stages.equipment.status !== 'empty';

  const tree: TreeNode = {
    label: projectName,
    children: [
      { label: 'Project data', to: '/project' },
      { label: 'Machine description', to: '/spec', stage: 'spec', questions: openQ.spec },
      {
        label: 'Equipment', to: '/equipment', stage: 'equipment',
        children: equipmentDone ? [
          { label: `CPU ${cpuId}`, mono: true },
          ...modules.map((m, i) => ({ label: `Slot ${i + 1}: ${m}`, mono: true })),
          ...(hmiPart ? [{ label: `HMI ${hmiPart}`, mono: true }] : []),
        ] : undefined,
      },
      { label: 'I/O list', to: '/io', stage: 'io', questions: openQ.io },
      {
        label: 'Electrical design', to: '/electrical?tab=design', stage: 'electrical', questions: openQ.electrical,
        children: [
          { label: 'Cabinet wiring', to: '/electrical?tab=cabinet' },
          { label: 'Machine wiring', to: '/electrical?tab=machine' },
          { label: 'Machine layout', to: '/electrical?tab=layout' },
          { label: 'Cabinet picture', to: '/electrical?tab=picture' },
          { label: 'Machining (DXF)', to: '/electrical?tab=machining' },
          { label: 'Labels', to: '/electrical?tab=labels' },
        ],
      },
      {
        label: 'HMI screens', to: '/hmi', stage: 'hmi', questions: openQ.hmi,
        children: hmiScreens.length ? hmiScreens.map((s) => ({ label: s.name, to: `/hmi?screen=${s.id}` })) : undefined,
      },
      {
        label: 'PLC program', to: '/program', stage: 'program',
        children: [
          { label: 'Ladder program', to: '/program' },
          { label: 'I/O addressing', to: '/plc' },
          { label: 'Simulation', to: '/simulate' },
          { label: 'Online (real PLC)', to: '/online' },
        ],
      },
      { label: 'Design review', to: '/review', badge: <ReviewTreeBadge />, questions: openQ.review },
      { label: 'Deliverables', to: '/export' },
    ],
  };

  return (
    <div className="flex flex-col h-screen bg-[#eef1f5] font-sans text-steel-900 text-[13px]">
      {/* Header: menu bar and toolbar on the left, product name on the right (engineering-portal layout) */}
      <div className="flex-shrink-0 bg-[#f3f4f6] border-b border-steel-300 flex items-stretch" data-testid="title-bar">
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="h-7 flex items-center px-1 gap-0.5">
            <span className="h-5 px-1 mx-1.5 flex items-center bg-brand-600 text-white text-[10px] font-bold tracking-wider" aria-hidden>ISA</span>
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
              <MenuItem onClick={() => navigate('/review')}>Design review…</MenuItem>
              <MenuItem onClick={() => navigate('/export')}>Deliverables…</MenuItem>
              <MenuItem onClick={() => navigate('/export?action=print-full')}>Print full package…</MenuItem>
              <MenuItem onClick={() => navigate('/electrical?tab=labels')}>Print labels…</MenuItem>
            </Menu>
            <Menu label="Online">
              <MenuItem onClick={() => navigate('/simulate')}>Start simulation</MenuItem>
              <MenuItem onClick={() => navigate('/online')}>Go online (real PLC)…</MenuItem>
            </Menu>
            <Menu label="Tools">
              <MenuItem onClick={() => navigate('/simulate')}>Simulation</MenuItem>
              <MenuItem onClick={() => navigate('/plc')}>PLC addressing</MenuItem>
              <MenuItem onClick={() => navigate('/review')}>Design review (compile)</MenuItem>
            </Menu>
            <Menu label="Options">
              <MenuItem onClick={() => navigate('/settings')}>Settings (AI provider, keys)…</MenuItem>
            </Menu>
          </div>
          <div className="h-9 flex items-center px-1.5 gap-0.5 border-t border-steel-200">
            <ToolButton title="New project" onClick={() => navigate('/new')}><DocumentPlusIcon className="w-5 h-5" /></ToolButton>
            <ToolButton title="Import existing system" onClick={() => navigate('/import')}><ArrowUpTrayIcon className="w-5 h-5" /></ToolButton>
            <span className="w-px h-6 bg-steel-300 mx-1" />
            <ToolButton title="Compile (design review)" onClick={() => navigate('/review')}><ShieldCheckIcon className="w-5 h-5" /></ToolButton>
            <ToolButton title="Simulation" onClick={() => navigate('/simulate')}><PlayIcon className="w-5 h-5" /></ToolButton>
            <ToolButton title="Go online" onClick={() => navigate('/online')}><SignalIcon className="w-5 h-5" /></ToolButton>
            <ToolButton title="Deliverables" onClick={() => navigate('/export')}><ArrowDownTrayIcon className="w-5 h-5" /></ToolButton>
            <span className="w-px h-6 bg-steel-300 mx-1" />
            <ToolButton title="Settings" onClick={() => navigate('/settings')}><Cog6ToothIcon className="w-5 h-5" /></ToolButton>
            <div className="ml-2"><UpdateAll /></div>
            <div className="ml-auto flex items-center gap-2 min-w-0 pr-2">
              <FolderOpenIcon className="w-4 h-4 text-steel-500 flex-shrink-0" />
              <select aria-label="Open project" value={activeId ?? ''} onChange={(e) => openProject(e.target.value)}
                className="h-7 border border-steel-300 px-2 bg-white max-w-[16rem]">
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex items-center px-4 border-l border-steel-200 bg-white"><PortalBrand /></div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Project navigation */}
        <ResizablePane id="app.nav" defaultSize={256} min={180} max={520} className="bg-white border-r border-steel-300 flex flex-col">
          <div className="h-8 flex items-center px-3 border-b border-steel-300 text-xs font-semibold text-steel-800 bg-gradient-to-b from-[#f3f4f6] to-[#e3e7ec]">Project tree</div>
          <nav className="flex-1 overflow-y-auto py-1">
            <ul><TreeItem node={tree} depth={0} stages={stages} /></ul>
          </nav>
          <div className="border-t border-steel-200 px-2 py-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-steel-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-600" /> done</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> out of date</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-steel-300" /> to do</span>
            <span className="flex items-center gap-1" title="Questions the AI asked; answer them on the page or in Design review"><span className="rounded-full bg-amber-100 px-1 text-[10px] font-semibold text-amber-900">2?</span> questions</span>
          </div>
        </ResizablePane>

        <main className="flex-1 flex flex-col overflow-hidden">
          {IS_PREVIEW && (
            <div className="px-4 py-1.5 bg-brand-50 border-b border-brand-200 text-brand-900 text-xs flex items-center gap-2">
              <InformationCircleIcon className="w-4 h-4 text-brand-600 flex-shrink-0" />
              Preview: everything is clickable and editable, and the example project is in the project list (top right). AI runs on your Claude account (it asks once); files are saved through Claude.
            </div>
          )}
          <Outlet />
        </main>
        <TaskCards />
      </div>

      {/* Editor bar: portal view, open editors, status */}
      <EditorBar projectName={projectName}>
        <span>PLC: {cpuId || '—'}{modules.length ? ` + ${modules.length} module(s)` : ''}</span>
        <span>HMI: {hmiPart || '—'}</span>
        <span>Rev {rev.rev} · {rev.description}</span>
        <ReviewStatus />
        <span>v{__APP_VERSION__}</span>
      </EditorBar>
    </div>
  );
}
