/**
 * Engineering-tool chrome in the style of an automation portal: the brand block
 * at the top right, the task-card strip on the right edge and the editor bar at
 * the bottom (portal view button + open editors + status).
 */
import { useState, type ComponentType, type ReactNode, type SVGProps } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ArchiveBoxArrowDownIcon, BoltIcon, ChevronLeftIcon, CodeBracketIcon, ComputerDesktopIcon, CpuChipIcon,
  DocumentTextIcon, FolderIcon, ListBulletIcon, PlayCircleIcon, ShieldCheckIcon, SignalIcon, Cog6ToothIcon,
  WrenchScrewdriverIcon, Squares2X2Icon, XMarkIcon, CheckCircleIcon,
} from '@heroicons/react/24/outline';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/** Editor name and icon for a page path. */
const EDITORS: Record<string, { label: string; Icon: Icon }> = {
  '/project': { label: 'Project data', Icon: FolderIcon },
  '/spec': { label: 'Machine description', Icon: DocumentTextIcon },
  '/equipment': { label: 'Devices & equipment', Icon: CpuChipIcon },
  '/io': { label: 'I/O list', Icon: ListBulletIcon },
  '/electrical': { label: 'Electrical design', Icon: BoltIcon },
  '/hmi': { label: 'HMI screens', Icon: ComputerDesktopIcon },
  '/program': { label: 'PLC program', Icon: CodeBracketIcon },
  '/plc': { label: 'I/O addressing', Icon: CpuChipIcon },
  '/simulate': { label: 'Simulation', Icon: PlayCircleIcon },
  '/online': { label: 'Online & diagnostics', Icon: SignalIcon },
  '/review': { label: 'Design review', Icon: ShieldCheckIcon },
  '/export': { label: 'Deliverables', Icon: ArchiveBoxArrowDownIcon },
  '/settings': { label: 'Settings', Icon: Cog6ToothIcon },
  '/import': { label: 'Import', Icon: WrenchScrewdriverIcon },
};

/** Product name block at the top right of the header. */
export function PortalBrand() {
  return (
    <div className="flex flex-col items-end justify-center leading-none pr-1 select-none" aria-label="ISA AUTO PROGRAMMER">
      <span className="text-[11px] font-semibold tracking-[0.12em] text-steel-600 whitespace-nowrap">ISA AUTO PROGRAMMER</span>
      <span className="text-[22px] font-light tracking-[0.18em] text-brand-600 mt-0.5">PORTAL</span>
    </div>
  );
}

const CARDS: { label: string; to: string }[] = [
  { label: 'Hardware catalog', to: '/equipment' },
  { label: 'Online tools', to: '/online' },
  { label: 'Tasks', to: '/review' },
  { label: 'Libraries', to: '/export' },
];

/** Vertical task-card tabs on the right edge. */
export function TaskCards() {
  const { pathname } = useLocation();
  return (
    <aside className="w-7 flex-shrink-0 bg-[#e3e7ec] border-l border-steel-300 flex flex-col items-stretch pt-1 gap-px" aria-label="Task cards" data-testid="task-cards">
      {CARDS.map((c) => {
        const on = pathname.startsWith(c.to);
        return (
          <NavLink key={c.label} to={c.to} title={c.label}
            className={`py-3 flex items-center justify-center text-[11px] font-medium border-y border-transparent ${on ? 'bg-white text-brand-800 border-steel-300 border-l-2 border-l-brand-600' : 'text-steel-700 hover:bg-white/70'}`}>
            <span style={{ writingMode: 'vertical-rl' }} className="whitespace-nowrap">{c.label}</span>
          </NavLink>
        );
      })}
    </aside>
  );
}

function editorFor(path: string) {
  const base = '/' + (path.split('?')[0].split('/')[1] ?? '');
  return EDITORS[base] ? { base, ...EDITORS[base] } : null;
}

/** Bottom bar: portal view, the editors opened in this session, project status. */
export function EditorBar({ projectName, children }: { projectName: string; children?: ReactNode }) {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState<{ base: string; path: string }[]>([]);
  const current = editorFor(pathname);
  // Remember each editor opened this session (state adjusted during render, no effect needed).
  const path = pathname + search;
  if (current && !open.some((e) => e.base === current.base && e.path === path)) {
    setOpen((list) => (list.some((e) => e.base === current.base)
      ? list.map((e) => (e.base === current.base ? { ...e, path } : e))
      : [...list, { base: current.base, path }].slice(-8)));
  }

  return (
    <div className="h-8 flex-shrink-0 bg-[#e3e7ec] border-t border-steel-300 flex items-stretch text-xs" data-testid="editor-bar">
      <button onClick={() => navigate('/portal')} className="flex items-center gap-1.5 px-3 bg-brand-950 text-white hover:bg-brand-900 whitespace-nowrap" title="Portal view">
        <ChevronLeftIcon className="w-3.5 h-3.5" /><Squares2X2Icon className="w-4 h-4" /> Portal view
      </button>
      <div className="flex items-stretch overflow-x-auto min-w-0">
        {open.map((e) => {
          const ed = EDITORS[e.base];
          const on = current?.base === e.base;
          return (
            <div key={e.base} className={`flex items-center border-r border-steel-300 ${on ? 'bg-white text-brand-900 border-t-2 border-t-brand-600 -mt-px' : 'text-steel-700 hover:bg-white/60'}`}>
              <button onClick={() => navigate(e.path)} className="flex items-center gap-1.5 pl-2.5 pr-1 h-full whitespace-nowrap">
                <ed.Icon className="w-4 h-4" />{ed.label}
              </button>
              <button aria-label={`Close ${ed.label}`} onClick={() => { const rest = open.filter((x) => x.base !== e.base); setOpen(rest); if (on) navigate(rest.length ? rest[rest.length - 1].path : '/portal'); }} className="px-1 h-full text-steel-400 hover:text-steel-800">
                <XMarkIcon className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
      <div className="ml-auto flex items-center gap-4 px-3 text-[11px] text-steel-700 whitespace-nowrap">
        {children}
        <span className="flex items-center gap-1"><CheckCircleIcon className="w-4 h-4 text-green-600" /> Project {projectName} opened.</span>
      </div>
    </div>
  );
}
