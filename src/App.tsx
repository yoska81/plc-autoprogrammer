import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNoTouchPanel, useProjectPanelPart } from './hmi/projectPanel';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  DocumentPlusIcon, ArrowUpTrayIcon, PlayIcon, ArrowDownTrayIcon, Cog6ToothIcon,
  FolderOpenIcon, ArrowDownOnSquareIcon, ChevronDownIcon, ChevronRightIcon, FolderIcon, DocumentIcon, InformationCircleIcon, Bars3Icon,
} from '@heroicons/react/24/outline';
import { IS_PREVIEW } from './preview/mode';
import { useAutoReview } from './review/useAutoReview';
import { ReviewStatus, ReviewTreeBadge } from './review/ReviewBadge';
import { useStages, type StageStatus } from './spec/useStages';
import { useProjectsStore } from './store/useProjectsStore';
import { currentRevision, useProjectStore } from './store/useProjectStore';
import type { StageId } from './store/useStageStore';
import UpdateAll from './components/UpdateAll';
import ResizablePane from './components/ResizablePane';
import { useOpenCounts } from './components/questions/useQuestionStore';
import { useProjectFile } from './project/useProjectFile';
import AiJobsIndicator from './components/AiJobsIndicator';
import { useFileStore } from './project/useFileStore';


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
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
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

/** True while the window is phone-narrow (under 640 px). */
function useNarrow(): boolean {
  const query = '(max-width: 639px)';
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}

function ToolButton({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button title={title} aria-label={title} onClick={onClick}
      className="w-8 h-8 flex items-center justify-center rounded-sm text-steel-700 hover:bg-brand-50 hover:text-brand-800 border border-transparent hover:border-brand-200">
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
  const hmiPart = useProjectPanelPart();
  const noHmi = useNoTouchPanel();
  const rev = currentRevision(useProjectStore((s) => s.info));
  useEffect(() => { ensureActive(); }, [ensureActive]);
  // Phones: the project navigation folds behind a toolbar button and opens over the page.
  const narrow = useNarrow();
  // Open for the page it was opened on: going to another page closes it.
  const location = useLocation();
  const here = `${location.pathname}${location.search}`;
  const [navOpenOn, setNavOpenOn] = useState<string | null>(null);
  const navOpen = navOpenOn === here;
  const setNavOpen = (f: (v: boolean) => boolean) => setNavOpenOn(f(navOpen) ? here : null);
  const projectFile = useProjectFile();
  useAutoReview();

  const projectName = projects.find((p) => p.id === activeId)?.name ?? 'Project';
  const fileInfo = useFileStore((s) => (activeId ? s.byProject[activeId] : undefined));
  const dirty = Boolean(fileInfo?.dirty);
  useEffect(() => { document.title = `${dirty ? '*' : ''}${projectName}${fileInfo?.name ? ` (${fileInfo.name})` : ''} - ISA Auto Programmer`; }, [dirty, projectName, fileInfo?.name]);
  const equipmentDone = stages.equipment.status !== 'empty';

  const tree: TreeNode = {
    label: projectName,
    children: [
      { label: 'Project data', to: '/project' },
      { label: 'Machine description', to: '/spec', stage: 'spec', questions: Object.values(openQ).reduce((a, b) => a + b, 0) },
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
          { label: 'Machine layout', to: '/electrical?tab=layout' },
          { label: 'Cabinet picture', to: '/electrical?tab=picture' },
          { label: 'Machining (DXF)', to: '/electrical?tab=machining' },
          { label: 'Labels', to: '/electrical?tab=labels' },
          { label: 'Improve design', to: '/electrical?tab=improve' },
          { label: 'Sourcing', to: '/sourcing' },
          { label: 'Engineer review', to: '/engineer' },
          { label: 'Redlines / field changes', to: '/redlines' },
          { label: 'Cable & wire lists', to: '/electrical?tab=lists' },
        ],
      },
      {
        label: 'HMI screens', to: '/hmi', stage: 'hmi',
      },
      {
        label: 'PLC program', to: '/program', stage: 'program',
        children: [
          { label: 'I/O addressing', to: '/plc' },
          { label: 'Simulation', to: '/simulate' },
          { label: 'Online (real PLC)', to: '/online' },
          { label: 'Commissioning checklist', to: '/commissioning' },
        ],
      },
      { label: 'Design review', to: '/review', badge: <ReviewTreeBadge /> },
      { label: 'Deliverables', to: '/export' },
    ],
  };

  return (
    <div className="flex flex-col h-screen bg-[#f0f2f3] font-sans text-steel-900 text-[13px]">
      {/* Title bar */}
      <div className="h-9 flex-shrink-0 bg-white border-b border-steel-200 flex items-center px-3 gap-2" data-testid="title-bar">
        <span className="h-5 px-1 flex items-center bg-brand-600 text-white text-[10px] font-bold tracking-wider rounded-[3px]" aria-hidden>ISA</span>
        <span className="font-semibold tracking-[0.14em] text-steel-900 text-sm" aria-label="ISA AUTO PROGRAMMER">AUTO PROGRAMMER</span>
        <span className="mx-1 text-steel-300">|</span>
        <span className="truncate text-steel-600 text-xs" data-testid="window-title">{projectName}{dirty ? ' *' : ''}</span>
        {fileInfo?.name && <span className="truncate text-steel-400 text-xs">— {fileInfo.name}</span>}
      </div>

      {/* Menu bar */}
      <div className="h-7 flex-shrink-0 bg-[#f7f8f9] border-b border-steel-200 flex items-center px-1 gap-0.5">
        <Menu label="Project">
          <MenuItem onClick={() => navigate('/new')}>New project…</MenuItem>
          <MenuItem onClick={projectFile.open}>Open project file (.isap)…<span className="float-right pl-6 text-steel-400">Ctrl+O</span></MenuItem>
          <MenuItem onClick={projectFile.save}>Save<span className="float-right pl-6 text-steel-400">Ctrl+S</span></MenuItem>
          <MenuItem onClick={projectFile.saveAs}>Save as…<span className="float-right pl-6 text-steel-400">Ctrl+Shift+S</span></MenuItem>
          <div className="border-t border-steel-200 my-1" />
          <MenuItem onClick={() => navigate('/import')}>Import existing system…</MenuItem>
          <MenuItem onClick={() => navigate('/project')}>Project data and revisions…</MenuItem>
          <div className="border-t border-steel-200 my-1" />
          <MenuItem onClick={() => navigate('/review')}>Design review…</MenuItem>
          <MenuItem onClick={() => navigate('/export')}>Deliverables…</MenuItem>
          <MenuItem onClick={() => navigate('/export?action=print-full')}>Print full package…</MenuItem>
          <MenuItem onClick={() => navigate('/electrical?tab=labels')}>Print labels…</MenuItem>
        </Menu>
        <Menu label="Tools">
          <MenuItem onClick={() => navigate('/simulate')}>Simulation</MenuItem>
          <MenuItem onClick={() => navigate('/plc')}>PLC addressing</MenuItem>
        </Menu>
        <Menu label="Options">
          <MenuItem onClick={() => navigate('/settings')}>Settings (AI provider, keys)…</MenuItem>
          <MenuItem onClick={() => navigate('/settings#voice')}>Voice (microphone, language, read aloud)…</MenuItem>
        </Menu>
      </div>

      {/* Toolbar */}
      <div className="h-10 flex-shrink-0 bg-white border-b border-steel-200 flex items-center px-2 gap-1 min-w-0">
        {narrow && <ToolButton title={navOpen ? 'Hide project navigation' : 'Project navigation'} onClick={() => setNavOpen((v) => !v)}><Bars3Icon className="w-5 h-5" /></ToolButton>}
        <ToolButton title="New project" onClick={() => navigate('/new')}><DocumentPlusIcon className="w-5 h-5" /></ToolButton>
        <ToolButton title="Open project file (Ctrl+O)" onClick={projectFile.open}><FolderOpenIcon className="w-5 h-5" /></ToolButton>
        <ToolButton title={dirty ? 'Save (Ctrl+S) — unsaved changes' : 'Save (Ctrl+S)'} onClick={projectFile.save}>
          <span className="relative"><ArrowDownOnSquareIcon className="w-5 h-5" />{dirty && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500" />}</span>
        </ToolButton>
        <ToolButton title="Import existing system" onClick={() => navigate('/import')}><ArrowUpTrayIcon className="w-5 h-5" /></ToolButton>
        {projectFile.input}
        <span className="w-px h-6 bg-steel-200 mx-1" />
        <ToolButton title="Simulation" onClick={() => navigate('/simulate')}><PlayIcon className="w-5 h-5" /></ToolButton>
        <ToolButton title="Deliverables" onClick={() => navigate('/export')}><ArrowDownTrayIcon className="w-5 h-5" /></ToolButton>
        <span className="w-px h-6 bg-steel-200 mx-1" />
        <ToolButton title="Settings" onClick={() => navigate('/settings')}><Cog6ToothIcon className="w-5 h-5" /></ToolButton>
        <div className="ml-3"><UpdateAll /></div>
        <div className="ml-auto flex items-center gap-2 min-w-0">
          <FolderOpenIcon className="w-4 h-4 text-steel-500 shrink-0 hidden sm:block" />
          <select aria-label="Open project" value={activeId ?? ''} onChange={(e) => openProject(e.target.value)}
            className="border border-steel-300 rounded-sm px-2 py-1 bg-white min-w-0 w-full max-w-[16rem]">
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Project navigation (on phones: over the page, opened from the toolbar) */}
        {(!narrow || navOpen) && (
        <ResizablePane id="app.nav" defaultSize={256} min={180} max={520} className={`bg-white border-r border-steel-300 flex flex-col${narrow ? ' absolute inset-y-0 left-0 z-40 shadow-lg' : ''}`}>
          <div className="h-7 flex items-center px-2 bg-[#e9edef] border-b border-steel-300 text-xs font-semibold text-steel-700">Project navigation</div>
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
        )}

        <main className="flex-1 flex flex-col overflow-hidden">
          {IS_PREVIEW && (
            <div className="px-4 py-1.5 bg-brand-50 border-b border-brand-200 text-brand-900 text-xs flex items-center gap-2">
              <InformationCircleIcon className="w-4 h-4 text-brand-600 flex-shrink-0" />
              Preview: everything is clickable and editable, and the example project is in the project list (top right). AI runs on your Claude account (it asks once); files are saved through Claude.
            </div>
          )}
          {/* a page opened for the first time loads its chunk: the shell stays */}
          <Suspense fallback={<div className="flex-1 bg-gray-50" data-page-loading />}><Outlet /></Suspense>
        </main>
      </div>

      {/* Status bar */}
      <div className="h-6 flex-shrink-0 bg-brand-600 text-white flex items-center gap-5 px-3 text-[11px]">
        <span data-testid="save-state">{dirty ? 'Unsaved changes' : fileInfo?.savedAt ? `Saved ${new Date(fileInfo.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Ready'}</span>
        <AiJobsIndicator />
        <span>PLC: {cpuId || '—'}{modules.length ? ` + ${modules.length} module(s)` : ''}</span>
        <span>HMI: {hmiPart || (noHmi ? 'none (pushbuttons and lamps)' : '—')}</span>
        <span>Rev {rev.rev} · {rev.description}</span>
        <ReviewStatus />
        <span className="ml-auto" />
        <span>v{__APP_VERSION__}</span>
      </div>
    </div>
  );
}
