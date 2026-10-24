import { useEffect, useRef, useState } from 'react';
import { ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon, PaperAirplaneIcon, StopIcon, XMarkIcon } from '@heroicons/react/20/solid';
import BridgeFailed from './BridgeFailed';
import { plcBridges } from '../../desktop/plcHelper';
import { type Studio5000Detect } from '../../desktop/bridge';
import { collectProject } from '../../deliverables/collect';
import { studioImport } from '../studio5000/studioSend';

interface Imported { project: string; imported: string[] }
interface Downloaded { mode: 'run' | 'program'; commPath: string }

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));
/** "Controller/Programs/Program[@Name='MainProgram']" → "MainProgram". */
const part = (xpath: string) => /@Name='([^']+)'/.exec(xpath)?.[1] ?? xpath.replace(/^Controller\//, '').replace('AddOnInstructionDefinitions', 'Add-On Instructions').replace('DataTypes', 'data types').replace('Tags', 'controller tags');

/**
 * "Send to Studio 5000": the Windows desktop app puts the program into the user's Studio 5000 Logix Designer project
 * through Rockwell's Logix Designer SDK (the user's licence; the Studio 5000 bridge runs the SDK's Python client,
 * tools/studio5000-bridge). Shown for a Logix project in the desktop app only. 1. Check this PC (Logix Designer, the
 * SDK, its Python); where the SDK is missing: what to install, and meanwhile the .L5X opened in Studio 5000 (it makes
 * a new project from it). 2. The user's project (.ACD): the app works on its copy next to it (<name>_ISA.ACD),
 * theirs is only read. 3. The program in: the data types, the controller tags and MainProgram imported over what is
 * there (the controller, its I/O configuration and its tasks stay the user's); then Open in Studio 5000.
 * 4. Download, only from the confirm screen: the path to the controller (the project's own, as Studio 5000 has it),
 * "it is safe" and leave to put the controller in Program mode (a Logix download needs it: the controller stops)
 * ticked; Run mode afterwards only when ticked. The bridge refuses a download without that confirm.
 */
export default function SendToStudio5000({ profileId }: { profileId: string }) {
  const s5k = plcBridges()?.studio5000;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [found, setFound] = useState<Studio5000Detect | null>(null);
  const [acd, setAcd] = useState<string | null>(null);
  const [imported, setImported] = useState<Imported | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logPath, setLogPath] = useState('');
  // Stop pressed between the bridge calls (while the L5X is written): the import does not start
  const stopAsked = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [commPath, setCommPath] = useState('');
  const [safe, setSafe] = useState(false);
  const [programAllowed, setProgramAllowed] = useState(false);
  const [runAfter, setRunAfter] = useState(false);
  const [downloaded, setDownloaded] = useState<Downloaded | null>(null);

  useEffect(() => (open && s5k ? s5k.onProgress((p) => setProgress(p.text)) : undefined), [open, s5k]);

  if (!s5k || profileId !== 'logix') return null;

  const step = async <T,>(name: string, run: () => Promise<T>): Promise<T | null> => {
    setBusy(name); setError(null); setProgress('');
    try { return await run(); }
    catch (err) { setError(message(err)); return null; }
    finally { setBusy(null); setProgress(''); s5k.logPath().then(setLogPath, () => undefined); }
  };
  const check = async () => { setFound(null); setImported(null); setFound(await step('check', () => s5k.call('detect'))); };
  const show = () => { setOpen(true); void check(); };
  const pick = async () => { const p = await s5k.pickProject(); if (p) { setAcd(p); setImported(null); } };
  /** The L5X written for the import (and for opening in Studio 5000 by hand). */
  const writeL5x = async () => {
    const p = collectProject();
    const s = studioImport(p);
    const { path } = await s5k.call('writeL5x', { name: p.fileBase, text: s.l5x }) as { path: string };
    return { path, xpaths: s.xpaths };
  };
  const openL5x = () => void step('open', async () => { const { path } = await writeL5x(); return s5k.call('open', { file: path }); });
  const closeConfirm = () => { setConfirming(false); setSafe(false); setProgramAllowed(false); setRunAfter(false); };
  const send = async () => {
    setImported(null); setDownloaded(null); closeConfirm();
    stopAsked.current = false;
    const r = await step('import', async () => {
      const { path, xpaths } = await writeL5x();
      if (stopAsked.current) throw new Error('Stopped, as you asked. Your own Studio 5000 project was not changed.');
      return s5k.call('import', { acd, l5x: path, xpaths }) as Promise<Imported>;
    });
    if (r) setImported(r);
  };
  /** The confirm screen, with the path the project has to the controller. Nothing is downloaded here. */
  const askDownload = async () => {
    setDownloaded(null);
    const r = await step('download', () => s5k.call('info', { project: imported!.project }) as Promise<{ commPath: string }>);
    if (!r) return;
    closeConfirm();
    setCommPath(r.commPath);
    setConfirming(true);
  };
  const download = async () => {
    if (!imported || !safe || !programAllowed || !commPath.trim()) return;
    const r = await step('download', () => s5k.call('download', { confirmed: true, project: imported.project, commPath: commPath.trim(), programAllowed, runAfter }) as Promise<Downloaded>);
    if (r) { setDownloaded(r); closeConfirm(); }
  };
  const stop = () => { stopAsked.current = true; void s5k.call('stop').catch(() => undefined); setProgress('Stopping…'); };

  const sub = 'rounded border border-steel-300 px-2.5 py-1 text-xs font-medium text-steel-800 hover:bg-steel-50 disabled:opacity-40';
  return (
    <>
      <button onClick={show} data-testid="send-to-studio5000" title="Put the program into your Studio 5000 project on this PC"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded border border-brand-300 bg-white text-brand-800 hover:bg-brand-50">
        <PaperAirplaneIcon className="h-4 w-4" /> Send to PLC software
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-6" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setOpen(false); }}>
          <div role="dialog" aria-label="Send to Studio 5000" className="w-full max-w-2xl rounded bg-white shadow-xl">
            <div className="flex items-start gap-3 border-b border-steel-200 px-5 py-3">
              <div className="flex-1">
                <h2 className="text-base font-semibold text-steel-900">Send to Studio 5000</h2>
                <p className="text-xs text-steel-500">The app puts the program into your Studio 5000 project with Rockwell's Logix Designer SDK. Your own project is never changed: the app works on its copy next to it.</p>
              </div>
              <button onClick={() => setOpen(false)} disabled={Boolean(busy)} aria-label="Close" className="rounded p-1 text-steel-400 hover:bg-steel-100 hover:text-steel-700 disabled:opacity-40"><XMarkIcon className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 px-5 py-4 text-sm">
              {busy && (
                <div className="flex items-center gap-3">
                  <p className="flex flex-1 items-center gap-2 text-steel-600" role="status"><ArrowPathIcon className="h-4 w-4 animate-spin" /> {progress || 'Working…'}</p>
                  {(busy === 'import' || busy === 'download') && <button onClick={stop} data-testid="studio5000-stop" className="inline-flex items-center gap-1 rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"><StopIcon className="h-4 w-4" /> Stop</button>}
                </div>
              )}

              <section className="space-y-2" data-testid="studio5000-check">
                <h3 className="font-semibold text-steel-900">1. Check this PC</h3>
                {found && (
                  <>
                    <ul className="space-y-1 text-steel-700">
                      <Line ok={found.logix.length > 0}>{found.logix.length ? `${found.logix[0].name} (${found.logix[0].version})` : 'Studio 5000 Logix Designer not found'}</Line>
                      <Line ok={Boolean(found.sdk)}>{found.sdk ? 'Logix Designer SDK' : 'Logix Designer SDK not installed'}</Line>
                      {found.sdk && <Line ok={Boolean(found.python)}>{found.python ? `Its Python client (${found.python})` : 'Its Python client not installed'}</Line>}
                    </ul>
                    {!found.ready && (
                      <div className="space-y-2 rounded border border-amber-200 bg-amber-50 p-2 text-amber-900" data-testid="studio5000-steps">
                        <ol className="ml-5 list-decimal space-y-1">{found.steps.map((x, i) => <li key={i}>{x}</li>)}</ol>
                        {found.logix.length > 0 && <button onClick={openL5x} disabled={Boolean(busy)} data-testid="studio5000-open-l5x" className={sub}>Open the .L5X in Studio 5000</button>}
                      </div>
                    )}
                  </>
                )}
                <button onClick={() => void check()} disabled={Boolean(busy)} className={sub}>Check again</button>
              </section>

              {found?.ready && (
                <section className="space-y-2" data-testid="studio5000-project">
                  <h3 className="font-semibold text-steel-900">2. Your project</h3>
                  <p className="text-xs text-steel-500">Your Studio 5000 project (.ACD) with your controller and its I/O. The app copies it next to it ({acd ? <span className="font-mono">{acd.replace(/\.ACD$/i, '_ISA.ACD')}</span> : '<name>_ISA.ACD'}) and works on the copy. Close it in Studio 5000 first.</p>
                  <button onClick={() => void pick()} disabled={Boolean(busy)} data-testid="studio5000-pick" className={sub}>Choose my project…</button>
                  {acd && <p className="font-mono text-xs text-steel-700" data-testid="studio5000-acd">{acd}</p>}
                </section>
              )}

              {found?.ready && (
                <section className="space-y-2" data-testid="studio5000-send">
                  <h3 className="font-semibold text-steel-900">3. Put the program in</h3>
                  <p className="text-xs text-steel-500">The program's data types, controller tags and MainProgram go in over what is there; the controller, its I/O configuration and its tasks stay yours.</p>
                  <button onClick={() => void send()} disabled={Boolean(busy) || !acd} data-testid="studio5000-send-button"
                    className="rounded bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-40">Put the program in</button>
                  {imported && (
                    <div className="space-y-1 text-steel-700" data-testid="studio5000-imported">
                      <p><CheckCircleIcon className="mr-1 inline h-4 w-4 text-green-600" />In <span className="font-mono text-xs">{imported.project}</span>: {imported.imported.map(part).join(', ')}.</p>
                      <p className="text-xs text-steel-500">Studio 5000 checks the program when you open it (Logic › Verify Controller).</p>
                      <button onClick={() => void step('open', () => s5k.call('open', { file: imported.project }))} disabled={Boolean(busy)} data-testid="studio5000-open" className={sub}>Open in Studio 5000</button>
                    </div>
                  )}
                </section>
              )}

              {imported && (
                <section className="space-y-2" data-testid="studio5000-download">
                  <h3 className="font-semibold text-steel-900">4. Download to the controller</h3>
                  {!confirming && <button onClick={() => void askDownload()} disabled={Boolean(busy)} data-testid="studio5000-download-button" className="rounded border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50 disabled:opacity-40">Download to the controller…</button>}
                  {confirming && (
                    <div className="space-y-2 rounded border-2 border-red-300 bg-red-50 p-3 text-red-950" data-testid="studio5000-confirm">
                      <p className="font-semibold">Download <span className="font-mono text-xs">{imported.project}</span> to the controller?</p>
                      <p className="text-xs">The controller then runs this program. Outputs can switch as soon as it runs.</p>
                      <label className="block text-xs">Path to the controller (as in Studio 5000's Who Active){' '}
                        <input value={commPath} onChange={(e) => setCommPath(e.target.value)} placeholder="AB_ETH-1\192.168.1.10\Backplane\0" aria-label="Path to the controller" className="mt-1 w-full rounded border border-red-300 bg-white px-1.5 py-0.5 font-mono" />
                      </label>
                      <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={safe} onChange={(e) => setSafe(e.target.checked)} data-testid="studio5000-safe" />
                        <span>I am at the machine, and it is safe for the controller to stop and to run this program (nobody in the machine, moving parts and outputs checked).</span></label>
                      <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={programAllowed} onChange={(e) => setProgramAllowed(e.target.checked)} data-testid="studio5000-program-allowed" />
                        <span>The controller may be put in Program mode (it stops: a Logix download needs it).</span></label>
                      <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={runAfter} onChange={(e) => setRunAfter(e.target.checked)} data-testid="studio5000-run-after" />
                        <span>Put it in Run mode after the download.</span></label>
                      <div className="flex gap-2">
                        <button onClick={() => void download()} disabled={Boolean(busy) || !safe || !programAllowed || !commPath.trim()} data-testid="studio5000-download-now" className="rounded bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-40">Download now</button>
                        <button onClick={closeConfirm} disabled={Boolean(busy)} className="rounded border border-steel-300 bg-white px-3 py-1.5 text-xs font-medium text-steel-800 hover:bg-steel-50 disabled:opacity-40">Cancel</button>
                      </div>
                    </div>
                  )}
                  {downloaded && <p className="text-steel-700" data-testid="studio5000-downloaded"><CheckCircleIcon className="mr-1 inline h-4 w-4 text-green-600" />Downloaded to <span className="font-mono text-xs">{downloaded.commPath}</span>; the controller is in {downloaded.mode === 'run' ? 'Run' : 'Program'} mode.{downloaded.mode === 'program' ? ' Put it in Run mode from Studio 5000 when you are ready.' : ''}</p>}
                </section>
              )}

              {error && <BridgeFailed error={error} logPath={logPath} logName="studio5000-bridge.log" showLog={s5k.showLog} testId="studio5000" />}
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
