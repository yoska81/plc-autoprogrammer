import { useEffect, useRef, useState } from 'react';
import { ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon, PaperAirplaneIcon, StopIcon, XMarkIcon } from '@heroicons/react/20/solid';
import BridgeFailed from './BridgeFailed';
import { plcBridges } from '../../desktop/plcHelper';
import { type ClickDetect } from '../../desktop/bridge';
import { collectProject } from '../../deliverables/collect';
import { hmiExtraTags } from '../../deliverables/exportContext';
import { clickNicknameCsv } from '../core/clickExport';
import { clickPasswordNote, modulesLine, newProjectPlan, setupPlan, writeToPlcPlan, type WriteToPlc } from '../click/clickPlan';
import { CALIBRATION_PDF, CALIBRATION_REPORT, calibrationPlan, calibrationReport, calibrationResult, type Calibration } from '../click/clickCalibrate';
import { rungsPlan } from '../click/clickRungs';
import { compareNicknames, compareRungs, exportNicknamesPlan, printLadderPlan, type NicknameCheck, type RungCheck } from '../click/clickVerify';
import { loadPdfjs } from '../../lib/pdfjs';

const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** The text of a PDF, in reading order (the printed ladder: rung numbers, addresses, nicknames). */
async function pdfText(bytes: Uint8Array): Promise<string> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const tc = await (await doc.getPage(n)).getTextContent();
    pages.push(tc.items.map((it) => ('str' in it ? it.str : '')).join(' '));
  }
  return pages.join('\n');
}

interface Started { version: string; processId: number; windows: string[]; attached: boolean }

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** What one click did: the result, and what is left for the user in CLICK. */
interface Sent { version: string; cpu: string; nicknames: boolean; entered: number; rungs: number; toDo: string[] }

/**
 * "Send to CLICK": one click, and the project is in CLICK Programming Software. The Windows desktop app drives CLICK
 * while the user watches (AutomationDirect publishes no API: the CLICK bridge works its windows, tools/click-bridge):
 * it uses the open CLICK or starts it (restored and maximized), makes a new project with the CPU, imports the
 * nicknames into the Address Picker and enters every rung, in order. What it cannot do (the modules, which are
 * added in System Configuration; a rung it cannot enter) is listed at the end, not asked in the middle. Stop (or
 * the Pause key) ends it at once; the app saves only for Write to the machine, after the user confirmed it, as its own
 * copy in its machines folder. On a failure: one plain sentence, and the log to send to
 * support (the bridge records every CLICK window it opens in it, and all of them on a failure). Under Support:
 * the sample-rung calibration, the check of what CLICK has (its nickname export and printed ladder), and a
 * recording of the windows open now.
 */
export default function SendToClick({ profileId }: { profileId: string }) {
  const click = plcBridges()?.click;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [found, setFound] = useState<ClickDetect | null>(null);
  const [started, setStarted] = useState<Started | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logPath, setLogPath] = useState('');
  const [recorded, setRecorded] = useState<string | null>(null);
  // Stop pressed between the bridge calls of one click (e.g. while the nickname file is written): no more calls
  const stopAsked = useRef(false);
  const [checked, setChecked] = useState<{ nicknames: NicknameCheck; rungs: RungCheck } | null>(null);
  const [calibrated, setCalibrated] = useState<{ result: Calibration | null; report: string } | null>(null);
  // Write to the machine: asked first (the confirm panel), then saved in the app's machines folder and written
  const [confirmWrite, setConfirmWrite] = useState(false);
  const [port, setPort] = useState<WriteToPlc['port']>('USB');
  const [runAfter, setRunAfter] = useState(true);
  const [written, setWritten] = useState<{ file: string } | null>(null);

  useEffect(() => (open && click ? click.onProgress((p) => setProgress(p.text)) : undefined), [open, click]);

  if (!click || profileId !== 'click') return null;

  const step = async <T,>(name: string, run: () => Promise<T>): Promise<T | null> => {
    setBusy(name); setError(null); setProgress('');
    try { return await run(); }
    catch (err) { setError(message(err)); return null; }
    finally { setBusy(null); setProgress(''); click.logPath().then(setLogPath, () => undefined); }
  };
  const notStopped = () => { if (stopAsked.current) throw new Error('Stopped, as you asked. Nothing was saved.'); };
  /** CLICK open: asked of the bridge before every run (it attaches to the one open, else starts it), since the user may close or open CLICK between runs. */
  const ensureStarted = async (): Promise<Started> => {
    setProgress('Opening CLICK…');
    const s = await click.call('start') as Started;
    setStarted(s);
    return s;
  };

  const check = async () => {
    setFound(null); setSent(null);
    setFound(await step('check', () => click.call('detect')));
  };
  const show = () => { setOpen(true); void check(); };

  /** One click: CLICK open, a new project with the CPU, the nicknames, every rung; then what is left to do. */
  const sendAll = async () => {
    setSent(null); setChecked(null);
    stopAsked.current = false;
    const p = collectProject();
    const r = await step('run', async () => {
      const s = await ensureStarted();
      notStopped();
      const file = await click.call('writeFile', { name: `${p.fileBase}_nicknames.csv`, text: clickNicknameCsv(p.ladder, p.io, p.addresses, hmiExtraTags(p)) }) as { path: string };
      notStopped();
      await click.call('run', { steps: setupPlan({ cpuId: p.cpu.id, nicknameCsvPath: file.path }) });
      notStopped();
      const plan = rungsPlan(p.ladder, p.labels, undefined, 'list');
      if (plan.steps.length) await click.call('run', { steps: plan.steps });
      const toDo = [
        ...(modulesLine(p.modules) ? [modulesLine(p.modules)!] : []),
        ...(/^4/.test(s.version) ? [clickPasswordNote] : []),
        ...plan.leftForYou.map((x) => `Type rung ${x.number} from the entry sheet (Load into PLC) ${x.after ? `after rung ${x.after}` : 'before the first rung'}: the app cannot enter ${x.why}.`),
      ];
      return { version: s.version, cpu: p.cpu.id, nicknames: true, entered: plan.entered, rungs: plan.entered + plan.leftForYou.length, toDo } satisfies Sent;
    });
    if (r) setSent(r);
  };

  const verify = async () => {
    setChecked(null);
    stopAsked.current = false;
    const p = collectProject();
    const r = await step('run', async () => {
      await ensureStarted();
      const { path: folder } = await click.call('folder') as { path: string };
      await click.call('run', { steps: exportNicknamesPlan(folder, 'click_nicknames.csv') });
      const nick = await click.call('readFile', { name: 'click_nicknames.csv' }) as { base64: string };
      notStopped();
      await click.call('run', { steps: printLadderPlan(folder, 'click_ladder.pdf') });
      const pdf = await click.call('readFile', { name: 'click_ladder.pdf' }) as { base64: string };
      const nicknames = compareNicknames(clickNicknameCsv(p.ladder, p.io, p.addresses, hmiExtraTags(p)), new TextDecoder().decode(fromBase64(nick.base64)));
      const text = await pdfText(fromBase64(pdf.base64));
      if (!text.trim()) throw new Error('The printed ladder has no text the app can read (the PDF printer wrote pictures only). Use the "Microsoft Print to PDF" printer in CLICK\'s Print dialog.');
      return { nicknames, rungs: compareRungs(p.ladder, text) };
    });
    if (r) setChecked(r);
  };

  /** Three sample rungs in a new, empty project, printed and read back; the report goes to a file for support. */
  const calibrate = async () => {
    setCalibrated(null);
    stopAsked.current = false;
    const p = collectProject();
    let steps: unknown[] = [], printedText = '', result: Calibration | null = null, failed = '', version = '';
    await step('run', async () => {
      try {
        version = (await ensureStarted()).version;
        const { path: folder } = await click.call('folder') as { path: string };
        const plan = calibrationPlan(folder);
        steps = [...newProjectPlan(p.cpu.id), ...plan.rungs, ...plan.print];
        await click.call('run', { steps: [...newProjectPlan(p.cpu.id), ...plan.rungs] });
        notStopped();
        await click.call('run', { steps: plan.print });
        const pdf = await click.call('readFile', { name: CALIBRATION_PDF }) as { base64: string };
        printedText = await pdfText(fromBase64(pdf.base64));
        if (!printedText.trim()) throw new Error('The printout has no text the app can read: use the "Microsoft Print to PDF" printer in CLICK\'s Print dialog.');
        result = calibrationResult(printedText);
      } catch (e) { failed = message(e); throw e; }
      finally {
        const text = calibrationReport({ clickVersion: version, when: new Date().toLocaleString(), result, error: failed || undefined, printedText, steps: steps as never });
        const f = await click.call('writeFile', { name: CALIBRATION_REPORT, text }).catch(() => null) as { path: string } | null;
        setCalibrated({ result, report: f?.path ?? '' });
      }
    });
  };

  /**
   * Write to the machine, after the user said yes in the confirm panel: the project saved as the app's own copy in its
   * machines folder (the user's files untouched; the desktop app sets the folder, the bridge saves nowhere else),
   * CLICK connected to the PLC, the project written into it.
   */
  const writeIt = async () => {
    setConfirmWrite(false); setWritten(null);
    stopAsked.current = false;
    const p = collectProject();
    const r = await step('run', async () => {
      await ensureStarted();
      const folder = await click.machinesFolder!();
      const file = `${folder.replace(/[\\/]+$/, '')}\\${p.fileBase}.ckp`;
      await click.call('run', { steps: writeToPlcPlan({ file, port, runAfter }), write: true });
      return { file };
    });
    if (r) setWritten(r);
  };

  const stop = () => { stopAsked.current = true; void click.call('stop').catch(() => undefined); setProgress('Stopping…'); };
  const record = async () => { const r = await step('record', async () => { await ensureStarted(); return click.call('dump') as Promise<{ file: string }>; }); if (r) setRecorded(r.file); };
  const showLog = click.showLog ? () => void click.showLog!().catch(() => undefined) : null;

  const sub = 'rounded border border-steel-300 px-2.5 py-1 text-xs font-medium text-steel-800 hover:bg-steel-50 disabled:opacity-40';
  return (
    <>
      <button onClick={show} data-testid="send-to-click" title="Put the project into CLICK Programming Software on this PC, in one click"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded border border-brand-300 bg-white text-brand-800 hover:bg-brand-50">
        <PaperAirplaneIcon className="h-4 w-4" /> Send to PLC software
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-6" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setOpen(false); }}>
          <div role="dialog" aria-label="Send to CLICK" className="w-full max-w-2xl rounded bg-white shadow-xl">
            <div className="flex items-start gap-3 border-b border-steel-200 px-5 py-3">
              <div className="flex-1">
                <h2 className="text-base font-semibold text-steel-900">Send to CLICK</h2>
                <p className="text-xs text-steel-500">One click: the app opens CLICK Programming Software and puts the whole project into it while you watch. Keep your hands off the mouse and keyboard while it runs; Stop (or the Pause key) ends it at once. The app saves only when you confirm Write to the machine, and only its own copy.</p>
              </div>
              <button onClick={() => setOpen(false)} disabled={Boolean(busy)} aria-label="Close" className="rounded p-1 text-steel-400 hover:bg-steel-100 hover:text-steel-700 disabled:opacity-40"><XMarkIcon className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 px-5 py-4 text-sm">
              {busy && (
                <div className="flex items-center gap-3">
                  <p className="flex flex-1 items-center gap-2 text-steel-600" role="status"><ArrowPathIcon className="h-4 w-4 animate-spin" /> {progress || 'Working…'}</p>
                  {busy === 'run' && (
                    <button onClick={stop} data-testid="click-stop" className="inline-flex items-center gap-1 rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                      <StopIcon className="h-4 w-4" /> Stop
                    </button>
                  )}
                </div>
              )}

              {found && !found.ready && <p className="text-amber-900" data-testid="click-steps"><ExclamationTriangleIcon className="mr-1 inline h-4 w-4 text-amber-600" />{found.steps.join(' ')}</p>}
              {found && !found.ready && <button onClick={() => void check()} disabled={Boolean(busy)} className={sub}>Check again</button>}

              {found?.ready && (
                <section className="space-y-2" data-testid="click-send">
                  <p className="text-steel-700" data-testid="click-found"><CheckCircleIcon className="mr-1 inline h-4 w-4 text-green-600" />{found.installs[0].name} ({found.installs[0].version}){found.running ? ', open now' : ''}.{started ? ` CLICK ${started.version} ${started.attached ? 'is open' : 'started'}.` : ''}</p>
                  <p className="text-xs text-steel-500">Save or close the project open in CLICK first: the app makes a new project with the CPU, imports the nicknames and enters every rung.</p>
                  <button onClick={() => void sendAll()} disabled={Boolean(busy)} data-testid="click-send-all" className="rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40">Put the project into CLICK</button>
                </section>
              )}

              {error && <BridgeFailed error={error} logPath={logPath} logName="click-bridge.log" showLog={click.showLog} testId="click" />}

              {sent && (
                <div className="space-y-1 rounded border border-green-200 bg-green-50 p-3 text-green-950" data-testid="click-done">
                  <p><CheckCircleIcon className="mr-1 inline h-4 w-4 text-green-600" />Done in CLICK {sent.version}: a new project with the CPU {sent.cpu}, the nicknames imported, {sent.entered} of {sent.rungs} rungs entered.</p>
                  {sent.toDo.length > 0 && (<><p className="font-medium">Still to do in CLICK:</p><ul className="ml-5 list-disc" data-testid="click-todo">{sent.toDo.map((t) => <li key={t}>{t}</li>)}</ul></>)}
                  {click.machinesFolder
                    ? <p>Check it in CLICK, then write it into the machine:</p>
                    : <p>Check it in CLICK, then save the project there (Ctrl+S).</p>}
                  {click.machinesFolder && !confirmWrite && (
                    <button onClick={() => setConfirmWrite(true)} disabled={Boolean(busy)} data-testid="click-write" className="rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40">Write to the machine…</button>
                  )}
                </div>
              )}

              {confirmWrite && (
                <div className="space-y-2 rounded border border-amber-300 bg-amber-50 p-3 text-amber-950" data-testid="click-write-confirm">
                  <p className="font-medium"><ExclamationTriangleIcon className="mr-1 inline h-4 w-4 text-amber-600" />Write this project into the machine?</p>
                  <ul className="ml-5 list-disc text-xs">
                    <li>The app saves the project as its own copy in Documents\ISA Auto Programmer\machines (your files are not touched), connects CLICK to the PLC and writes the project into it.</li>
                    <li>The program in the PLC is replaced. The PLC may stop while it is written: make sure the machine is safe to stop.</li>
                  </ul>
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <span>The PC reaches the PLC by:</span>
                    {(['USB', 'Ethernet'] as const).map((x) => (
                      <label key={x} className="inline-flex items-center gap-1"><input type="radio" name="click-port" checked={port === x} onChange={() => setPort(x)} data-testid={`click-port-${x}`} />{x}</label>
                    ))}
                    <label className="inline-flex items-center gap-1"><input type="checkbox" checked={runAfter} onChange={(e) => setRunAfter(e.target.checked)} data-testid="click-run-after" />Put the PLC back in RUN after writing</label>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => void writeIt()} disabled={Boolean(busy)} data-testid="click-write-yes" className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40">Yes, write it into the machine</button>
                    <button onClick={() => setConfirmWrite(false)} disabled={Boolean(busy)} className={sub}>Cancel</button>
                  </div>
                </div>
              )}

              {written && (
                <div className="space-y-1 rounded border border-green-200 bg-green-50 p-3 text-green-950" data-testid="click-written">
                  <p><CheckCircleIcon className="mr-1 inline h-4 w-4 text-green-600" />Written into the machine. The app's copy of the project: {written.file}</p>
                </div>
              )}

              {checked && (
                <div className="space-y-1 text-steel-700" data-testid="click-checked">
                  <p>{checked.rungs.ok === checked.rungs.rungs && !checked.rungs.extra.length
                    ? <><CheckCircleIcon className="mr-1 inline h-4 w-4 text-green-600" />All {checked.rungs.rungs} rungs match the project.</>
                    : <><ExclamationTriangleIcon className="mr-1 inline h-4 w-4 text-amber-600" />{checked.rungs.ok} of {checked.rungs.rungs} rungs match the project.</>}</p>
                  {checked.rungs.differences.length > 0 && <ul className="ml-5 list-disc text-amber-900">{checked.rungs.differences.slice(0, 30).map((d) => <li key={d.rung}>Rung {d.rung}: {d.missing.join(', ')} not where it should be</li>)}{checked.rungs.differences.length > 30 && <li>… and {checked.rungs.differences.length - 30} more rungs</li>}</ul>}
                  {checked.rungs.extra.length > 0 && <p className="text-amber-900">In CLICK but not in the project: {checked.rungs.extra.slice(0, 20).join(', ')}{checked.rungs.extra.length > 20 ? ' …' : ''}</p>}
                  <p>{!checked.nicknames.missing.length && !checked.nicknames.different.length
                    ? <><CheckCircleIcon className="mr-1 inline h-4 w-4 text-green-600" />All {checked.nicknames.checked} nicknames are in CLICK.</>
                    : <><ExclamationTriangleIcon className="mr-1 inline h-4 w-4 text-amber-600" />Nicknames: {checked.nicknames.missing.length} missing{checked.nicknames.missing.length ? ` (${checked.nicknames.missing.slice(0, 10).join(', ')})` : ''}, {checked.nicknames.different.length} different{checked.nicknames.different.length ? ` (${checked.nicknames.different.slice(0, 5).map((d) => `${d.address}: "${d.click}" in CLICK, "${d.ours}" here`).join('; ')})` : ''}.</>}</p>
                </div>
              )}

              {calibrated && (
                <div className="space-y-1 text-steel-700" data-testid="click-calibrated">
                  {calibrated.result?.fits
                    ? <p><CheckCircleIcon className="mr-1 inline h-4 w-4 text-green-600" />All 3 sample rungs are in CLICK as they should be: the rung entry fits your CLICK {started?.version}.</p>
                    : <p><ExclamationTriangleIcon className="mr-1 inline h-4 w-4 text-amber-600" />{calibrated.result ? `${calibrated.result.check.ok} of 3 sample rungs as they should be` : 'The calibration did not finish'}: the rung entry does not fit your CLICK yet. Send us the report and the log.</p>}
                  {calibrated.result && calibrated.result.check.differences.length > 0 && <ul className="ml-5 list-disc text-amber-900">{calibrated.result.check.differences.map((d) => <li key={d.rung}>Sample rung {d.rung}: {d.missing.join(', ')} not where it should be</li>)}</ul>}
                  {calibrated.report && <p className="text-xs text-steel-500">Report for support: <span className="select-all font-mono">{calibrated.report}</span></p>}
                </div>
              )}

              {found?.ready && (
                <details className="rounded border border-steel-200 px-3 py-2 text-xs text-steel-600" data-testid="click-support">
                  <summary className="cursor-pointer font-medium text-steel-700">Support</summary>
                  <div className="mt-2 space-y-3">
                    <div className="space-y-1">
                      <p><span className="font-medium text-steel-800">Check what CLICK has:</span> CLICK exports its nicknames and prints its ladder to a PDF (the app fills in the file names, you press Save in those two dialogs); each rung's addresses are compared with the project's, in order. It checks addresses and their order, not the exact wiring: a contact moved to a parallel branch, or another instruction on the same address, is not found.</p>
                      <button onClick={() => void verify()} disabled={Boolean(busy)} data-testid="click-verify-button" className={sub}>Check what CLICK has</button>
                    </div>
                    <div className="space-y-1">
                      <p><span className="font-medium text-steel-800">Try three sample rungs:</span> a new, empty project with three sample rungs, printed to a PDF (you press Save) and read back; a report for us. Don't save that project.</p>
                      <button onClick={() => void calibrate()} disabled={Boolean(busy)} data-testid="click-calibrate-button" className={sub}>Try three sample rungs</button>
                    </div>
                    <div className="space-y-1">
                      <p><span className="font-medium text-steel-800">Record CLICK's windows:</span> open the CLICK window you want recorded (a dialog too), then press Record: every window of CLICK goes into a file for us.</p>
                      <button onClick={() => void record()} disabled={Boolean(busy)} data-testid="click-record" className={sub}>Record</button>
                      {recorded && <p>Recorded in <span className="select-all font-mono">{recorded}</span>: send it to us with the log.</p>}
                    </div>
                    {logPath && <p>Log: <span className="select-all font-mono">{logPath}</span>{showLog && <button onClick={showLog} className="ml-2 rounded border border-steel-300 px-2 py-0.5 font-medium hover:bg-steel-50">Open log folder</button>}</p>}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
