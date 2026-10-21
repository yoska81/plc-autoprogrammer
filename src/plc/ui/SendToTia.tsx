import { useEffect, useState } from 'react';
import { ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon, PaperAirplaneIcon, XMarkIcon } from '@heroicons/react/20/solid';
import { desktopBridge, type TiaDetect } from '../../desktop/bridge';
import { collectProject } from '../../deliverables/collect';
import { tiaPlcRequest, tiaProjectName, tiaTagRows } from '../tia/tiaSend';
import { useProjectStore } from '../../store/useProjectStore';
import { useProgramStore } from '../../store/useProgramStore';

interface Portal { processId: number; project: string | null }
interface Opened { version: string; project: string; plc: { name: string; orderNumber: string; firmware: string } | null }
interface PlcDone { plc: { name: string; orderNumber: string; firmware: string }; added: boolean; problems: string[] }
interface TagsDone { table: string; created: number; updated: number; failed: { name: string; error: string }[] }

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * "Send to TIA Portal": the Windows desktop app drives the user's own TIA Portal through TIA Openness
 * (electron/tiaBridge.cjs → tools/tia-bridge). Shown for a Siemens S7 project in the desktop app only (a browser
 * cannot start programs). 1. Check this PC (TIA Portal, TIA Openness, the user's permission, what to fix).
 * 2. Open TIA Portal: a running one (with its project) or a new one with a new project. 3. The PLC (its firmware:
 * the newest TIA knows, or the one chosen) and its modules, and the PLC tags.
 */
export default function SendToTia({ profileId }: { profileId: string }) {
  const tia = desktopBridge()?.tia;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [found, setFound] = useState<TiaDetect | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logPath, setLogPath] = useState('');
  const [portals, setPortals] = useState<Portal[] | null>(null);
  const [target, setTarget] = useState<number | 'new'>('new');
  const [opened, setOpened] = useState<Opened | null>(null);
  const [firmware, setFirmware] = useState<string[]>([]);
  const [fw, setFw] = useState('');
  const [plcDone, setPlcDone] = useState<PlcDone | null>(null);
  const [tagsDone, setTagsDone] = useState<TagsDone | null>(null);

  const cpu = useProjectStore((st) => st.cpuId);
  const projectName = useProgramStore((st) => st.projectName);
  useEffect(() => (open && tia ? tia.onProgress((p) => setProgress(p.text)) : undefined), [open, tia]);

  if (!tia || profileId !== 'siemens-s7') return null;

  /** Runs one step: busy while it runs (its progress shown), its error shown in plain words. */
  const step = async <T,>(name: string, run: () => Promise<T>): Promise<T | null> => {
    setBusy(name); setError(null); setProgress('');
    try { return await run(); }
    catch (err) { setError(message(err)); return null; }
    finally { setBusy(null); setProgress(''); tia.logPath().then(setLogPath, () => undefined); }
  };

  const check = async () => {
    setFound(null); setPortals(null); setOpened(null); setPlcDone(null); setTagsDone(null);
    const d = await step('check', () => tia.call('detect'));
    setFound(d);
    if (d?.ready) {
      const r = await step('check', () => tia.call('portals') as Promise<{ portals: Portal[] }>);
      setPortals(r?.portals ?? []);
      setTarget(r?.portals[0]?.processId ?? 'new');
    }
  };
  const show = () => { setOpen(true); void check(); };

  const openTia = async () => {
    setPlcDone(null); setTagsDone(null);
    const p = collectProject();
    const r = await step('open', () => tia.call('open', target === 'new' ? { name: newProject } : { processId: target }) as Promise<Opened>);
    if (!r) return;
    setOpened(r);
    const f = await step('open', () => tia.call('firmware', { orderNumber: r.plc?.orderNumber ?? p.cpu.id }) as Promise<{ versions: string[] }>);
    setFirmware(f?.versions ?? []);
    setFw(r.plc?.firmware ?? f?.versions[0] ?? '');
  };

  const send = async () => {
    const p = collectProject();
    const req = tiaPlcRequest(p);
    const plc = await step('send', () => tia.call('plc', { orderNumber: req.orderNumber, name: req.name, modules: req.modules, firmware: fw || undefined }) as Promise<PlcDone>);
    if (!plc) return;
    setPlcDone({ ...plc, problems: [...plc.problems, ...(plc.added ? req.notes : [])] });
    setTagsDone(await step('send', () => tia.call('tags', { tags: tiaTagRows(p) }) as Promise<TagsDone>));
  };

  const newProject = tiaProjectName(projectName);
  const otherPlc = opened?.plc && opened.plc.orderNumber.replace(/\s/g, '') !== cpu;

  return (
    <>
      <button onClick={show} data-testid="send-to-tia" title="Open TIA Portal on this PC and put the program into it"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded border border-brand-300 bg-white text-brand-800 hover:bg-brand-50">
        <PaperAirplaneIcon className="h-4 w-4" /> Send to TIA Portal
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-6" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setOpen(false); }}>
          <div role="dialog" aria-label="Send to TIA Portal" className="w-full max-w-2xl rounded bg-white shadow-xl">
            <div className="flex items-start gap-3 border-b border-steel-200 px-5 py-3">
              <div className="flex-1">
                <h2 className="text-base font-semibold text-steel-900">Send to TIA Portal</h2>
                <p className="text-xs text-steel-500">The app opens TIA Portal on this PC and puts the PLC and its tags into it. TIA Portal asks once whether to allow this app: choose Yes.</p>
              </div>
              <button onClick={() => setOpen(false)} disabled={Boolean(busy)} aria-label="Close" className="rounded p-1 text-steel-400 hover:bg-steel-100 hover:text-steel-700 disabled:opacity-40"><XMarkIcon className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 px-5 py-4 text-sm">
              {busy && <p className="flex items-center gap-2 text-steel-600" role="status"><ArrowPathIcon className="h-4 w-4 animate-spin" /> {progress || 'Working…'}</p>}
              {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-red-800">{error}</p>}

              <section className="space-y-2" data-testid="tia-check">
                <h3 className="font-semibold text-steel-900">1. Check this PC</h3>
                {found && (
                  <>
                    <ul className="space-y-1 text-steel-700">
                      <Line ok={found.installed.length > 0}>TIA Portal {found.installed.length ? found.installed.join(', ') : 'not found'}</Line>
                      <Line ok={found.openness.length > 0}>TIA Openness {found.openness.length ? `${found.openness.map((o) => o.version).join(', ')} (the app uses ${found.openness[0].version})` : 'not installed'}</Line>
                      {found.openness.length > 0 && <Line ok={found.inOpennessGroup}>{found.user} {found.inOpennessGroup ? 'may use TIA Openness' : 'is not in the "Siemens TIA Openness" group'}</Line>}
                    </ul>
                    {!found.ready && (
                      <div className="rounded border border-amber-200 bg-amber-50 p-2 text-amber-900" data-testid="tia-steps">
                        <p className="font-medium">To fix:</p>
                        <ol className="ml-5 list-decimal space-y-1">{found.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                      </div>
                    )}
                  </>
                )}
                <button onClick={() => void check()} disabled={Boolean(busy)} className="rounded border border-steel-300 px-2.5 py-1 text-xs font-medium text-steel-800 hover:bg-steel-50 disabled:opacity-40">Check again</button>
              </section>

              {found?.ready && portals && (
                <section className="space-y-2" data-testid="tia-open">
                  <h3 className="font-semibold text-steel-900">2. Open TIA Portal</h3>
                  <fieldset className="space-y-1" disabled={Boolean(busy)}>
                    {portals.map((x) => (
                      <label key={x.processId} className="flex items-start gap-2">
                        <input type="radio" name="tia-target" className="mt-1" checked={target === x.processId} onChange={() => setTarget(x.processId)} />
                        <span>The TIA Portal that is open{x.project ? <> with <span className="font-mono text-xs">{x.project}</span></> : ' (no project open: a new project is created)'}</span>
                      </label>
                    ))}
                    <label className="flex items-start gap-2">
                      <input type="radio" name="tia-target" className="mt-1" checked={target === 'new'} onChange={() => setTarget('new')} />
                      <span>Start TIA Portal {found.openness[0].version} with a new project "{newProject}" (Documents › ISA Auto Programmer › TIA)</span>
                    </label>
                  </fieldset>
                  <button onClick={() => void openTia()} disabled={Boolean(busy)} data-testid="tia-open-button"
                    className="rounded bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-40">Open TIA Portal</button>
                  {opened && <p className="text-steel-700" data-testid="tia-opened"><CheckCircleIcon className="mr-1 inline h-4 w-4 text-green-600" />TIA Portal {opened.version}, project <span className="font-mono text-xs">{opened.project}</span>{opened.plc ? `, PLC ${opened.plc.name} (${opened.plc.orderNumber} ${opened.plc.firmware})` : ''}.</p>}
                </section>
              )}

              {opened && (
                <section className="space-y-2" data-testid="tia-send">
                  <h3 className="font-semibold text-steel-900">3. PLC and PLC tags</h3>
                  {otherPlc
                    ? <p className="rounded border border-amber-200 bg-amber-50 p-2 text-amber-900">This TIA Portal project already has another PLC ({opened.plc!.orderNumber}); the project's PLC is {cpu}. Start TIA Portal with a new project instead, or change the PLC on the PLC page.</p>
                    : (
                      <>
                        {!opened.plc && (
                          <label className="block text-steel-700">
                            Firmware of the {cpu}{' '}
                            <select value={fw} onChange={(e) => setFw(e.target.value)} disabled={Boolean(busy)} aria-label="Firmware" className="ml-1 rounded border border-steel-300 px-1.5 py-0.5">
                              {firmware.map((v) => <option key={v} value={v}>{v}{v === firmware[0] ? ' (newest)' : ''}</option>)}
                            </select>
                            <span className="mt-1 block text-xs text-steel-500">Choose the firmware of the CPU on the machine (on its label, or in TIA Portal › Online › Accessible devices): a different one stops the download later. TIA Openness cannot read it from the PLC.</span>
                          </label>
                        )}
                        <button onClick={() => void send()} disabled={Boolean(busy) || (!opened.plc && !fw)} data-testid="tia-send-button"
                          className="rounded bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-40">{opened.plc ? 'Write the PLC tags' : 'Add the PLC and its tags'}</button>
                      </>
                    )}
                  {plcDone && (
                    <div className="text-steel-700" data-testid="tia-plc-done">
                      <p><CheckCircleIcon className="mr-1 inline h-4 w-4 text-green-600" />{plcDone.added ? 'Added' : 'Kept'} the PLC {plcDone.plc.name} ({plcDone.plc.orderNumber}, firmware {plcDone.plc.firmware}).</p>
                      {plcDone.problems.length > 0 && <ul className="ml-5 list-disc text-amber-900">{plcDone.problems.map((x, i) => <li key={i}>{x}</li>)}</ul>}
                    </div>
                  )}
                  {tagsDone && (
                    <div className="text-steel-700" data-testid="tia-tags-done">
                      <p><CheckCircleIcon className="mr-1 inline h-4 w-4 text-green-600" />PLC tags in the table "{tagsDone.table}": {tagsDone.created} new, {tagsDone.updated} updated{tagsDone.failed.length ? `, ${tagsDone.failed.length} not written` : ''}.</p>
                      {tagsDone.failed.length > 0 && <ul className="ml-5 list-disc text-amber-900">{tagsDone.failed.map((x) => <li key={x.name}>{x.name}: {x.error}</li>)}</ul>}
                      <p className="mt-1 text-xs text-steel-500">The program blocks follow in the next update of the app; until then use Load into PLC for them.</p>
                    </div>
                  )}
                </section>
              )}

              {logPath && <p className="text-xs text-steel-500">Log for support: <span className="select-all font-mono">{logPath}</span></p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Line({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-label="OK" /> : <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-label="Missing" />}
      <span>{children}</span>
    </li>
  );
}
