import { useEffect, useState } from 'react';
import { ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon, PaperAirplaneIcon, StopIcon, XMarkIcon } from '@heroicons/react/20/solid';
import { desktopBridge, type CodesysDetect } from '../../desktop/bridge';
import { codesysProgram } from '../codesys/codesysObjects';
import { useProgramStore } from '../../store/useProgramStore';
import { tiaProjectName } from '../tia/tiaSend';

interface Built {
  project: string;
  objects: { name: string; kind: string; action: 'created' | 'replaced' }[];
  errors: number; warnings: number;
  messages: { severity: 'error' | 'warning'; text: string; object: string | null; line: number | null }[];
  notes: string[];
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * "Send to CODESYS": the Windows desktop app puts the project's Structured Text into a CODESYS project and builds it,
 * through the user's own CODESYS (the CODESYS bridge runs it in the background with a ScriptEngine job,
 * tools/codesys-bridge). Shown for a Structured Text project in the desktop app only. 1. Check this PC. 2. The
 * project: a new one for CODESYS Control Win V3 (the soft PLC on this PC), or the user's own; theirs is never
 * changed (the app saves its copy next to it, <name>_ISA.project). 3. Put the program in (each POU, DUT and GVL
 * created or replaced, the main program in the MainTask) and build: the errors and warnings, each with its object
 * and line; then Open in CODESYS.
 */
export default function SendToCodesys({ profileId }: { profileId: string }) {
  const codesys = desktopBridge()?.codesys;
  const stCode = useProgramStore((st) => st.generatedCode);
  const projectName = useProgramStore((st) => st.projectName);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [found, setFound] = useState<CodesysDetect | null>(null);
  const [mine, setMine] = useState<string | null>(null);
  const [useMine, setUseMine] = useState(false);
  const [built, setBuilt] = useState<Built | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logPath, setLogPath] = useState('');

  useEffect(() => (open && codesys ? codesys.onProgress((p) => setProgress(p.text)) : undefined), [open, codesys]);

  if (!codesys || profileId !== 'generic-st') return null;

  const step = async <T,>(name: string, run: () => Promise<T>): Promise<T | null> => {
    setBusy(name); setError(null); setProgress('');
    try { return await run(); }
    catch (err) { setError(message(err)); return null; }
    finally { setBusy(null); setProgress(''); codesys.logPath().then(setLogPath, () => undefined); }
  };
  const check = async () => { setFound(null); setBuilt(null); setFound(await step('check', () => codesys.call('detect'))); };
  const show = () => { setOpen(true); void check(); };
  const pick = async () => { const p = await codesys.pickProject(); if (p) { setMine(p); setUseMine(true); } };

  const program = codesysProgram(stCode ?? '');
  const name = tiaProjectName(projectName);
  const send = async () => {
    setBuilt(null);
    const r = await step('build', () => codesys.call('build', { project: useMine ? mine : undefined, name, objects: program.objects, main: program.main || undefined }) as Promise<Built>);
    if (r) setBuilt(r);
  };
  const stop = () => { void codesys.call('stop').catch(() => undefined); setProgress('Stopping…'); };
  const openIt = () => void step('open', () => codesys.call('open', { project: built!.project }));

  const sub = 'rounded border border-steel-300 px-2.5 py-1 text-xs font-medium text-steel-800 hover:bg-steel-50 disabled:opacity-40';
  return (
    <>
      <button onClick={show} data-testid="send-to-codesys" title="Put the program into a CODESYS project on this PC and build it"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded border border-brand-300 bg-white text-brand-800 hover:bg-brand-50">
        <PaperAirplaneIcon className="h-4 w-4" /> Send to CODESYS
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-6" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setOpen(false); }}>
          <div role="dialog" aria-label="Send to CODESYS" className="w-full max-w-2xl rounded bg-white shadow-xl">
            <div className="flex items-start gap-3 border-b border-steel-200 px-5 py-3">
              <div className="flex-1">
                <h2 className="text-base font-semibold text-steel-900">Send to CODESYS</h2>
                <p className="text-xs text-steel-500">The app puts the program into a CODESYS project with your CODESYS (in the background) and builds it. Your own project is never changed: the app saves its copy next to it.</p>
              </div>
              <button onClick={() => setOpen(false)} disabled={Boolean(busy)} aria-label="Close" className="rounded p-1 text-steel-400 hover:bg-steel-100 hover:text-steel-700 disabled:opacity-40"><XMarkIcon className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 px-5 py-4 text-sm">
              {busy && (
                <div className="flex items-center gap-3">
                  <p className="flex flex-1 items-center gap-2 text-steel-600" role="status"><ArrowPathIcon className="h-4 w-4 animate-spin" /> {progress || 'Working…'}</p>
                  {busy === 'build' && <button onClick={stop} data-testid="codesys-stop" className="inline-flex items-center gap-1 rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"><StopIcon className="h-4 w-4" /> Stop</button>}
                </div>
              )}

              <section className="space-y-2" data-testid="codesys-check">
                <h3 className="font-semibold text-steel-900">1. Check this PC</h3>
                {found && (found.ready
                  ? <p className="text-steel-700"><CheckCircleIcon className="mr-1 inline h-4 w-4 text-green-600" />{found.installs[0].name} ({found.installs[0].version}).</p>
                  : <p className="text-amber-900" data-testid="codesys-steps"><ExclamationTriangleIcon className="mr-1 inline h-4 w-4 text-amber-600" />{found.steps.join(' ')}</p>)}
                <button onClick={() => void check()} disabled={Boolean(busy)} className={sub}>Check again</button>
              </section>

              {found?.ready && (
                <section className="space-y-2" data-testid="codesys-project">
                  <h3 className="font-semibold text-steel-900">2. The project</h3>
                  <fieldset className="space-y-1" disabled={Boolean(busy)}>
                    <label className="flex items-start gap-2">
                      <input type="radio" name="codesys-target" className="mt-1" checked={!useMine} onChange={() => setUseMine(false)} />
                      <span>A new project "{name}" for CODESYS Control Win V3 (the soft PLC on this PC), in <span className="font-mono text-xs">{found.projectsDir}</span></span>
                    </label>
                    <label className="flex items-start gap-2">
                      <input type="radio" name="codesys-target" className="mt-1" checked={useMine} disabled={!mine} onChange={() => setUseMine(true)} />
                      <span>{mine ? <>My project <span className="font-mono text-xs">{mine}</span> (with my PLC): the app saves its copy next to it</> : 'My own CODESYS project (with my PLC)'}</span>
                    </label>
                  </fieldset>
                  <button onClick={() => void pick()} disabled={Boolean(busy)} data-testid="codesys-pick" className={sub}>Choose my project…</button>
                  {useMine && <p className="text-xs text-steel-500">Close it in CODESYS first (CODESYS cannot open a project twice).</p>}
                </section>
              )}

              {found?.ready && (
                <section className="space-y-2" data-testid="codesys-send">
                  <h3 className="font-semibold text-steel-900">3. Put the program in and build</h3>
                  {program.objects.length
                    ? <p className="text-xs text-steel-500">{program.objects.length} object{program.objects.length === 1 ? '' : 's'} ({program.objects.map((o) => o.name).join(', ')}){program.main ? `; ${program.main} goes into the MainTask` : ''}.</p>
                    : <p className="text-amber-900">There is no program yet: generate it first.</p>}
                  {program.notes.length > 0 && <ul className="ml-5 list-disc text-xs text-amber-900">{program.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
                  <button onClick={() => void send()} disabled={Boolean(busy) || !program.objects.length || (useMine && !mine)} data-testid="codesys-send-button"
                    className="rounded bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-40">Put the program in and build</button>
                  {built && (
                    <div className="space-y-1 text-steel-700" data-testid="codesys-built">
                      <p><CheckCircleIcon className="mr-1 inline h-4 w-4 text-green-600" />In <span className="font-mono text-xs">{built.project}</span>: {built.objects.filter((o) => o.action === 'created').length} created, {built.objects.filter((o) => o.action === 'replaced').length} replaced.</p>
                      <p>{built.errors
                        ? <><ExclamationTriangleIcon className="mr-1 inline h-4 w-4 text-red-600" />Built with {built.errors} error{built.errors === 1 ? '' : 's'} and {built.warnings} warning{built.warnings === 1 ? '' : 's'}.</>
                        : <><CheckCircleIcon className="mr-1 inline h-4 w-4 text-green-600" />Built: no errors{built.warnings ? `, ${built.warnings} warning${built.warnings === 1 ? '' : 's'}` : ''}.</>}</p>
                      {built.messages.length > 0 && <ul className="ml-5 list-disc">{built.messages.slice(0, 40).map((m, i) => <li key={i} className={m.severity === 'error' ? 'text-red-800' : 'text-amber-900'}>{m.object ?? 'CODESYS'}{m.line ? `, line ${m.line}` : ''}: {m.text}</li>)}{built.messages.length > 40 && <li>… and {built.messages.length - 40} more, in CODESYS (Messages)</li>}</ul>}
                      {built.notes.length > 0 && <ul className="ml-5 list-disc text-amber-900">{built.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
                      <button onClick={openIt} disabled={Boolean(busy)} data-testid="codesys-open" className={sub}>Open in CODESYS</button>
                    </div>
                  )}
                </section>
              )}

              {error && (
                <div role="alert" className="space-y-1 rounded border border-red-200 bg-red-50 p-3 text-red-900" data-testid="codesys-failed">
                  <p>{error}</p>
                  <p className="text-xs">Send this log to support: <span className="select-all font-mono">{logPath || 'codesys-bridge.log'}</span><button onClick={() => void codesys.showLog().catch(() => undefined)} className="ml-2 rounded border border-red-300 bg-white px-2 py-0.5 font-medium hover:bg-red-100">Open folder</button></p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
