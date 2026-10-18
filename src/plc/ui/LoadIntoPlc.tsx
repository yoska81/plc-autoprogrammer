import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownTrayIcon, CpuChipIcon, XMarkIcon } from '@heroicons/react/20/solid';
import { collectProject } from '../../deliverables/collect';
import { programFiles, saveBlob } from '../../deliverables/files';
import { loadGuide, type LoadStep } from '../deploy/loadGuide';

const MIME: Record<string, string> = { html: 'text/html', csv: 'text/csv', json: 'application/json', L5X: 'application/xml', st: 'text/plain', scl: 'text/plain', sdf: 'text/plain', txt: 'text/plain' };

/**
 * "Load into PLC" button and its step-by-step guide for the project's PLC brand, with a download button for
 * each file a step needs. The program goes into the PLC through the maker's own software (see loadGuide.ts).
 */
export default function LoadIntoPlc({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ steps: LoadStep[]; files: Map<string, string>; title: string; empty: boolean } | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());
  const show = () => {
    const p = collectProject();
    const files = programFiles(p);
    const steps = loadGuide({
      profileId: p.profile.id, profileName: p.profile.name, vendor: p.profile.vendor, cpuId: p.cpu.id, modules: p.modules, fileBase: p.fileBase,
      files: files.map((f) => f.name), importSteps: p.profile.importSteps, errors: p.issues.filter((x) => x.severity === 'error').length,
    });
    setState({ steps, files: new Map(files.map((f) => [f.name, f.content])), title: `${p.profile.vendor} ${p.profile.name} ${p.cpu.id}`, empty: !p.ladder.rungs.length });
    setDone(new Set());
    setOpen(true);
  };
  const download = (name: string) => {
    const content = state?.files.get(name);
    if (content === undefined) return;
    saveBlob(name, new Blob([content], { type: MIME[name.split('.').pop() ?? ''] ?? 'text/plain' }));
  };
  return (
    <>
      <button onClick={show} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded bg-brand-600 text-white hover:bg-brand-700 ${className}`}
        title="Step-by-step: get this program into the real PLC">
        <CpuChipIcon className="h-4 w-4" /> Load into PLC
      </button>
      {open && state && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div role="dialog" aria-label="Load into PLC" className="w-full max-w-3xl rounded bg-white shadow-xl">
            <div className="flex items-start gap-3 border-b border-steel-200 px-5 py-3">
              <div className="flex-1">
                <h2 className="text-base font-semibold text-steel-900">Load the program into the PLC — {state.title}</h2>
                <p className="text-xs text-steel-500">The program goes into the PLC through the maker's own programming software; this app gives you the files for each step and then checks the result online.</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded p-1 text-steel-400 hover:bg-steel-100 hover:text-steel-700"><XMarkIcon className="h-5 w-5" /></button>
            </div>
            {state.empty && <p className="mx-5 mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">There is no program yet: build it on the PLC program page first.</p>}
            <ol className="space-y-3 px-5 py-4">
              {state.steps.map((s, k) => (
                <li key={k} className={`rounded border p-3 ${done.has(k) ? 'border-green-200 bg-green-50/50' : 'border-steel-200'}`} data-step={k + 1}>
                  <label className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1" checked={done.has(k)} aria-label={`Step ${k + 1} done`}
                      onChange={(e) => setDone((d) => { const n = new Set(d); if (e.target.checked) n.add(k); else n.delete(k); return n; })} />
                    <span className="font-semibold text-steel-900">{k + 1}. {s.title}</span>
                  </label>
                  <div className="ml-6 mt-1 space-y-1 text-sm text-steel-700">
                    {s.text.map((t, j) => <p key={j}>{t}</p>)}
                    {(s.files?.length || s.link || s.online) && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {s.files?.map((f) => (
                          <button key={f} onClick={() => download(f)} disabled={!state.files.has(f)}
                            className="inline-flex items-center gap-1 rounded border border-steel-300 bg-white px-2.5 py-1 text-xs font-medium text-steel-800 hover:bg-brand-50 disabled:opacity-40">
                            <ArrowDownTrayIcon className="h-3.5 w-3.5" /> {f}
                          </button>
                        ))}
                        {s.link && <a href={s.link.url} target="_blank" rel="noreferrer" className="rounded border border-brand-300 bg-white px-2.5 py-1 text-xs font-medium text-brand-800 hover:bg-brand-50">{s.link.label} ↗</a>}
                        {s.online && <Link to="/online" onClick={() => setOpen(false)} className="rounded border border-brand-300 bg-white px-2.5 py-1 text-xs font-medium text-brand-800 hover:bg-brand-50">Open Online</Link>}
                      </div>
                    )}
                    {s.files && !s.files.length && <p className="text-xs text-amber-800">No file for this step yet (build the program first).</p>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
