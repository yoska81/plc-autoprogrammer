import { useEffect, useState, type ComponentType, type SVGProps } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArchiveBoxArrowDownIcon, BoltIcon, ChevronRightIcon, CodeBracketIcon, ComputerDesktopIcon, CpuChipIcon,
  PlayCircleIcon, RocketLaunchIcon, CheckCircleIcon, ExclamationTriangleIcon, MinusCircleIcon,
} from '@heroicons/react/24/outline';
import { useProjectsStore } from '../store/useProjectsStore';
import { useStages, type StageInfo } from '../spec/useStages';
import type { StageId } from '../store/useStageStore';
import { PortalBrand } from '../shell/tia';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;
interface Action { label: string; to: string; hint: string }
interface Portal { id: string; label: string; Icon: Icon; stages: StageId[]; actions: Action[] }

const PORTALS: Portal[] = [
  { id: 'start', label: 'Start', Icon: RocketLaunchIcon, stages: [], actions: [
    { label: 'Open existing project', to: '', hint: 'Pick a project from the list below.' },
    { label: 'Create new project', to: '/new', hint: 'Name the machine, describe it, choose the PLC and HMI.' },
    { label: 'Import existing system', to: '/import', hint: 'Start from an existing program, I/O list or drawings.' },
    { label: 'Settings', to: '/settings', hint: 'AI provider, API key and generation quality.' },
  ] },
  { id: 'devices', label: 'Machine & devices', Icon: CpuChipIcon, stages: ['spec', 'equipment', 'io'], actions: [
    { label: 'Describe the machine', to: '/spec', hint: 'The specification that drives every step.' },
    { label: 'Configure devices', to: '/equipment', hint: 'CPU, I/O modules, HMI panel and options.' },
    { label: 'I/O list', to: '/io', hint: 'Every input and output with its address.' },
  ] },
  { id: 'electrical', label: 'Electrical design', Icon: BoltIcon, stages: ['electrical'], actions: [
    { label: 'Cabinet wiring', to: '/electrical?tab=cabinet', hint: 'Schematics, power and control circuits.' },
    { label: 'Machine wiring', to: '/electrical?tab=machine', hint: 'Field devices, cables and junction boxes.' },
    { label: 'Machine layout', to: '/electrical?tab=layout', hint: 'Scaled plan, cable routes and lengths.' },
    { label: 'Cabinet picture', to: '/electrical?tab=picture', hint: 'Back panel and front door, to scale.' },
    { label: 'Machining (DXF)', to: '/electrical?tab=machining', hint: '1:1 cut-outs and drilling.' },
    { label: 'Labels', to: '/electrical?tab=labels', hint: 'Wire, terminal and device labels.' },
  ] },
  { id: 'plc', label: 'PLC programming', Icon: CodeBracketIcon, stages: ['program'], actions: [
    { label: 'Ladder program', to: '/program', hint: 'Generate, edit and fix the PLC program.' },
    { label: 'I/O addressing', to: '/plc', hint: 'Tags and addresses in the PLC.' },
  ] },
  { id: 'hmi', label: 'Visualization', Icon: ComputerDesktopIcon, stages: ['hmi'], actions: [
    { label: 'HMI screens', to: '/hmi', hint: 'Operator screens, linked to the PLC.' },
  ] },
  { id: 'online', label: 'Online & diagnostics', Icon: PlayCircleIcon, stages: [], actions: [
    { label: 'Simulation', to: '/simulate', hint: 'Run the program and the HMI without hardware.' },
    { label: 'Online (real PLC)', to: '/online', hint: 'Connect to the PLC over Modbus TCP.' },
    { label: 'Design review', to: '/review', hint: 'Code rules and engineering checks.' },
  ] },
  { id: 'deliver', label: 'Deliverables', Icon: ArchiveBoxArrowDownIcon, stages: [], actions: [
    { label: 'Deliverables', to: '/export', hint: 'Drawings, BOM, programs and documents.' },
    { label: 'Print full package', to: '/export?action=print-full', hint: 'One PDF with everything.' },
    { label: 'Print labels', to: '/electrical?tab=labels', hint: 'Label printer output.' },
  ] },
];

const STAGE_NAME: Record<StageId, string> = { spec: 'Machine description', equipment: 'Devices', io: 'I/O list', electrical: 'Electrical design', hmi: 'HMI screens', program: 'PLC program' };

function StageLine({ info }: { info: StageInfo }) {
  const icon = info.status === 'ready' ? <CheckCircleIcon className="w-5 h-5 text-green-600" />
    : info.status === 'stale' ? <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
    : <MinusCircleIcon className="w-5 h-5 text-steel-400" />;
  return (
    <li className="flex items-start gap-2 py-1.5">
      {icon}
      <div>
        <div className="font-medium text-steel-900">{STAGE_NAME[info.id]}</div>
        <div className="text-xs text-steel-500">{info.status === 'ready' ? 'Done' : info.status === 'stale' ? (info.reason ?? 'Out of date') : 'Not started'}</div>
      </div>
    </li>
  );
}

/** Start view: portals on the left, their actions in the middle, details on the right. */
export default function PortalPage() {
  const navigate = useNavigate();
  const { projects, activeId, openProject, ensureActive } = useProjectsStore();
  useEffect(() => { ensureActive(); }, [ensureActive]);
  const stages = useStages();
  const [portalId, setPortalId] = useState('start');
  const [actionIdx, setActionIdx] = useState(0);
  const portal = PORTALS.find((p) => p.id === portalId)!;
  const action = portal.actions[actionIdx] ?? portal.actions[0];
  const projectName = projects.find((p) => p.id === activeId)?.name ?? '';

  const run = (a: Action, i: number) => { setActionIdx(i); if (a.to) navigate(a.to); };

  return (
    <div className="flex flex-col h-screen bg-[#eef1f5] font-sans text-steel-900 text-[13px]" data-testid="portal-view">
      <header className="h-14 flex-shrink-0 bg-white border-b border-steel-300 flex items-center px-4">
        <span className="h-6 px-1.5 flex items-center bg-brand-600 text-white text-[11px] font-bold tracking-wider" aria-hidden>ISA</span>
        <span className="ml-3 text-steel-500 text-xs">{projectName ? `Project: ${projectName}` : 'No project open'}</span>
        <div className="ml-auto"><PortalBrand /></div>
      </header>

      <div className="flex flex-1 min-h-0">
        <nav className="w-64 flex-shrink-0 bg-[#dfe4ea] border-r border-steel-300 py-3 flex flex-col gap-1" aria-label="Portals">
          {PORTALS.map((p) => {
            const on = p.id === portalId;
            return (
              <button key={p.id} onClick={() => { setPortalId(p.id); setActionIdx(0); }}
                className={`mx-2 flex items-center gap-3 px-3 py-2.5 text-left text-sm ${on ? 'bg-brand-600 text-white' : 'text-steel-800 hover:bg-white/70'}`}>
                <span className={`w-9 h-9 flex items-center justify-center flex-shrink-0 ${on ? 'bg-white/15' : 'bg-white border border-steel-300'}`}>
                  <p.Icon className={`w-6 h-6 ${on ? 'text-white' : 'text-brand-700'}`} />
                </span>
                <span className="font-medium">{p.label}</span>
              </button>
            );
          })}
        </nav>

        <section className="w-72 flex-shrink-0 bg-white border-r border-steel-300 py-3" aria-label="Actions">
          <h2 className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-steel-500">{portal.label}</h2>
          <ul>
            {portal.actions.map((a, i) => (
              <li key={a.label}>
                <button onClick={() => run(a, i)} onMouseEnter={() => setActionIdx(i)}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-left ${action === a ? 'bg-brand-50 text-brand-900' : 'hover:bg-steel-50'}`}>
                  <ChevronRightIcon className="w-3.5 h-3.5 text-brand-600" />{a.label}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex-1 min-w-0 overflow-auto p-6">
          <h3 className="text-lg font-light text-brand-900">{action.label}</h3>
          <p className="text-steel-600 mt-1">{action.hint}</p>
          {portal.id === 'start' && actionIdx === 0 && (
            <table className="mt-4 w-full max-w-2xl bg-white border border-steel-300">
              <thead><tr className="bg-[#e9edef] text-left text-xs text-steel-600"><th className="px-3 py-1.5 font-medium">Project</th><th className="px-3 py-1.5 font-medium">Created</th><th /></tr></thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-t border-steel-200">
                    <td className="px-3 py-1.5">{p.id === activeId ? <b>{p.name}</b> : p.name}</td>
                    <td className="px-3 py-1.5 text-xs text-steel-500">{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : ''}</td>
                    <td className="px-3 py-1.5 text-right">
                      <button onClick={() => { openProject(p.id); navigate('/spec'); }} className="px-3 py-1 text-xs bg-brand-600 text-white hover:bg-brand-700">Open</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {portal.stages.length > 0 && (
            <div className="mt-5 max-w-md bg-white border border-steel-300">
              <div className="px-3 py-1.5 bg-[#e9edef] border-b border-steel-300 text-xs font-semibold text-steel-700">Status</div>
              <ul className="px-3 py-1">{portal.stages.map((s) => <StageLine key={s} info={stages[s]} />)}</ul>
            </div>
          )}
          {action.to && (
            <button onClick={() => navigate(action.to)} className="mt-5 px-4 py-2 bg-brand-600 text-white hover:bg-brand-700">Open {action.label.toLowerCase()}</button>
          )}
        </section>
      </div>

      <footer className="h-9 flex-shrink-0 bg-[#e3e7ec] border-t border-steel-300 flex items-stretch text-xs">
        <button onClick={() => navigate('/spec')} className="flex items-center gap-1.5 px-4 bg-brand-950 text-white hover:bg-brand-900">
          Project view <ChevronRightIcon className="w-3.5 h-3.5" />
        </button>
        <span className="ml-auto self-center px-3 text-steel-600">{projectName ? `Opened project: ${projectName}` : ''}</span>
      </footer>
    </div>
  );
}
