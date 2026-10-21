import { useEffect, useRef, useState } from 'react';
import { ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon, PaperAirplaneIcon, StopIcon, XMarkIcon } from '@heroicons/react/20/solid';
import { desktopBridge, type ClickDetect } from '../../desktop/bridge';
import { collectProject } from '../../deliverables/collect';
import { hmiExtraTags } from '../../deliverables/exportContext';
import { clickNicknameCsv } from '../core/clickExport';
import { setupPlan } from '../click/clickPlan';
import { DEFAULT_KEYMAP, rungsPlan } from '../click/clickRungs';
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

/**
 * "Send to CLICK": the Windows desktop app drives CLICK Programming Software while the user watches (AutomationDirect
 * publishes no API: the CLICK bridge works its windows, tools/click-bridge). Shown for a CLICK project in the desktop
 * app only. 1. Check this PC. 2. Open CLICK (the open one, else started). 3. Set up the project: a new project with
 * the CPU, the modules (the user adds them in System Configuration), the nicknames. 4. Enter the rungs, in order (a
 * rung the app cannot enter is the user's turn: the run waits for Continue). Stop (or the Pause key) ends a run at
 * once; the app never saves. 5. Check what CLICK has: its nickname export and its printed ladder (to PDF; the
 * user presses Save in those dialogs) against the project, mismatches by rung number. "Record CLICK's windows"
 * writes their controls to the log for support.
 */
export default function SendToClick({ profileId }: { profileId: string }) {
  const click = desktopBridge()?.click;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [found, setFound] = useState<ClickDetect | null>(null);
  const [started, setStarted] = useState<Started | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logPath, setLogPath] = useState('');
  const [recorded, setRecorded] = useState<string | null>(null);
  // Stop pressed before the run itself began (while the nickname file is written): the run does not start
  const stopAsked = useRef(false);
  const [setUpDone, setSetUpDone] = useState(false);
  const [checked, setChecked] = useState<{ nicknames: NicknameCheck; rungs: RungCheck } | null>(null);

  useEffect(() => (open && click ? click.onProgress((p) => setProgress(p.text)) : undefined), [open, click]);

  if (!click || profileId !== 'click') return null;

  const step = async <T,>(name: string, run: () => Promise<T>): Promise<T | null> => {
    setBusy(name); setError(null); setProgress('');
    try { return await run(); }
    catch (err) { setError(message(err)); return null; }
    finally { setBusy(null); setProgress(''); click.logPath().then(setLogPath, () => undefined); }
  };

  const check = async () => {
    setFound(null); setStarted(null); setDone(null);
    setFound(await step('check', () => click.call('detect')));
  };
  const show = () => { setOpen(true); void check(); };
  const start = async () => { setDone(null); setStarted(await step('start', () => click.call('start') as Promise<Started>)); };

  const setUp = async () => {
    setDone(null);
    const p = collectProject();
    stopAsked.current = false;
    const r = await step('run', async () => {
      const file = await click.call('writeFile', { name: `${p.fileBase}_nicknames.csv`, text: clickNicknameCsv(p.ladder, p.io, p.addresses, hmiExtraTags(p)) }) as { path: string };
      if (stopAsked.current) throw new Error('Stopped before CLICK was touched, as you asked. Nothing was changed.');
      return click.call('run', { steps: setupPlan({ cpuId: p.cpu.id, modules: p.modules, nicknameCsvPath: file.path }) }) as Promise<{ steps: number }>;
    });
    if (r) setSetUpDone(true);
    if (r) setDone(`The project is set up in CLICK: CPU ${p.cpu.id}${p.modules.length ? `, ${p.modules.length} module(s)` : ''}, nicknames imported (${r.steps} steps). Check it in CLICK and save it there (File › Save Project) when you are happy with it.`);
  };

  const enterRungs = async () => {
    setDone(null);
    stopAsked.current = false;
    const p = collectProject();
    const plan = rungsPlan(p.ladder, p.labels);
    const r = await step('run', () => click.call('run', { steps: plan.steps }) as Promise<{ steps: number }>);
    if (r) setDone(`${plan.entered} rung${plan.entered === 1 ? '' : 's'} entered${plan.leftForYou.length ? `, ${plan.leftForYou.length} typed by you (${plan.leftForYou.map((x) => x.number).join(', ')})` : ''}. Check them in CLICK and save it there (File › Save Project) when you are happy with them.`);
  };
  const verify = async () => {
    setDone(null); setChecked(null);
    stopAsked.current = false;
    const p = collectProject();
    const r = await step('run', async () => {
      const { path: folder } = await click.call('folder') as { path: string };
      await click.call('run', { steps: exportNicknamesPlan(folder, 'click_nicknames.csv') });
      const nick = await click.call('readFile', { name: 'click_nicknames.csv' }) as { base64: string };
      if (stopAsked.current) throw new Error('Stopped, as you asked.');
      await click.call('run', { steps: printLadderPlan(folder, 'click_ladder.pdf') });
      const pdf = await click.call('readFile', { name: 'click_ladder.pdf' }) as { base64: string };
      const nicknames = compareNicknames(clickNicknameCsv(p.ladder, p.io, p.addresses, hmiExtraTags(p)), new TextDecoder().decode(fromBase64(nick.base64)));
      const text = await pdfText(fromBase64(pdf.base64));
      if (!text.trim()) throw new Error('The printed ladder has no text the app can read (the PDF printer wrote pictures only). Use the "Microsoft Print to PDF" printer in CLICK\'s Print dialog.');
      return { nicknames, rungs: compareRungs(p.ladder, text) };
    });
    if (r) setChecked(r);
  };

  const yourTurn = busy === 'run' && /^Your turn/.test(progress);
  const goOn = () => { void click.call('resume').catch(() => undefined); setProgress('Going on…'); };

  const stop = () => { stopAsked.current = true; void click.call('stop').catch(() => undefined); setProgress('Stopping…'); };
  const record = async () => { const r = await step('record', () => click.call('dump') as Promise<{ file: string }>); if (r) setRecorded(r.file); };

  return (
    <>
      <button onClick={show} data-testid="send-to-click" title="Open CLICK Programming Software on this PC and set up the project in it while you watch"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded border border-brand-300 bg-white text-brand-800 hover:bg-brand-50">
        <PaperAirplaneIcon className="h-4 w-4" /> Send to CLICK
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-6" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setOpen(false); }}>
          <div role="dialog" aria-label="Send to CLICK" className="w-full max-w-2xl rounded bg-white shadow-xl">
            <div className="flex items-start gap-3 border-b border-steel-200 px-5 py-3">
              <div className="flex-1">
                <h2 className="text-base font-semibold text-steel-900">Send to CLICK</h2>
                <p className="text-xs text-steel-500">The app works CLICK Programming Software for you while you watch: keep your hands off the mouse and keyboard while it runs. Clicking another window pauses it; Stop (or the Pause key) ends it at once. The app never saves: you save in CLICK when you are happy with the result.</p>
              </div>
              <button onClick={() => setOpen(false)} disabled={Boolean(busy)} aria-label="Close" className="rounded p-1 text-steel-400 hover:bg-steel-100 hover:text-steel-700 disabled:opacity-40"><XMarkIcon className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 px-5 py-4 text-sm">
              {busy && (
                <div className="flex items-center gap-3">
                  <p className="flex flex-1 items-center gap-2 text-steel-600" role="status"><ArrowPathIcon className="h-4 w-4 animate-spin" /> {progress || 'Working…'}</p>
                  {yourTurn && (
                    <button onClick={goOn} data-testid="click-continue" className="rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Continue</button>
                  )}
                  {busy === 'run' && (
                    <button onClick={stop} data-testid="click-stop" className="inline-flex items-center gap-1 rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                      <StopIcon className="h-4 w-4" /> Stop
                    </button>
                  )}
                </div>
              )}
              {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-red-800">{error}</p>}

              <section className="space-y-2" data-testid="click-check">
                <h3 className="font-semibold text-steel-900">1. Check this PC</h3>
                {found && (found.ready
                  ? <p className="text-steel-700"><CheckCircleIcon className="mr-1 inline h-4 w-4 text-green-600" />{found.installs[0].name} ({found.installs[0].version}){found.running ? ', open now' : ''}.</p>
                  : <p className="text-amber-900" data-testid="click-steps"><ExclamationTriangleIcon className="mr-1 inline h-4 w-4 text-amber-600" />{found.steps.join(' ')}</p>)}
                <button onClick={() => void check()} disabled={Boolean(busy)} className="rounded border border-steel-300 px-2.5 py-1 text-xs font-medium text-steel-800 hover:bg-steel-50 disabled:opacity-40">Check again</button>
              </section>

              {found?.ready && (
                <section className="space-y-2" data-testid="click-open">
                  <h3 className="font-semibold text-steel-900">2. Open CLICK</h3>
                  <p className="text-xs text-steel-500">Save or close the project open in CLICK first: the app starts a new project there.</p>
                  <button onClick={() => void start()} disabled={Boolean(busy)} data-testid="click-start" className="rounded bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-40">{found.running ? 'Use the open CLICK' : 'Start CLICK'}</button>
                  {started && <p className="text-steel-700" data-testid="click-started"><CheckCircleIcon className="mr-1 inline h-4 w-4 text-green-600" />CLICK {started.version} {started.attached ? 'is open' : 'started'}.</p>}
                </section>
              )}

              {started && (
                <section className="space-y-2" data-testid="click-setup">
                  <h3 className="font-semibold text-steel-900">3. Set up the project</h3>
                  <p className="text-xs text-steel-500">A new project with the CPU, then System Configuration for you to add the modules (the app waits until you close it), then the nicknames into the Address Picker. The rungs follow in the next update of the app.</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => void setUp()} disabled={Boolean(busy)} data-testid="click-setup-button" className="rounded bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-40">Set up the project in CLICK</button>
                    <button onClick={() => void record()} disabled={Boolean(busy)} data-testid="click-record" title="Writes the names of CLICK's windows and controls to a file, so we can fit the steps to your CLICK version"
                      className="rounded border border-steel-300 px-2.5 py-1 text-xs font-medium text-steel-800 hover:bg-steel-50 disabled:opacity-40">Record CLICK's windows for us</button>
                  </div>
                </section>
              )}

              {started && setUpDone && (
                <section className="space-y-2" data-testid="click-rungs">
                  <h3 className="font-semibold text-steel-900">4. Enter the rungs</h3>
                  <p className="text-xs text-steel-500">The rungs go in one by one, in order. A rung the app cannot enter is your turn: type it in CLICK from the entry sheet (Load into PLC), then press Continue.{DEFAULT_KEYMAP.checkedOn ? '' : ' This is the first version of the rung entry and not yet checked on your CLICK: watch the first rungs closely and press Stop if anything goes wrong.'}</p>
                  <button onClick={() => void enterRungs()} disabled={Boolean(busy)} data-testid="click-rungs-button" className="rounded bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-40">Enter the rungs in CLICK</button>
                </section>
              )}

              {started && setUpDone && (
                <section className="space-y-2" data-testid="click-verify">
                  <h3 className="font-semibold text-steel-900">5. Check what CLICK has</h3>
                  <p className="text-xs text-steel-500">CLICK exports its nicknames and prints its ladder to a PDF; the app fills in the file names, you press Save in those two dialogs. Then each rung's addresses are compared with the project's, in order. This checks addresses and their order, not the exact wiring: a contact moved to a parallel branch, or one instruction swapped for another on the same address, is not found here.</p>
                  <button onClick={() => void verify()} disabled={Boolean(busy)} data-testid="click-verify-button" className="rounded bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-40">Check what CLICK has</button>
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
                </section>
              )}

              {done && <p className="rounded border border-green-200 bg-green-50 p-2 text-green-900" data-testid="click-done">{done}</p>}
              {recorded && <p className="text-xs text-steel-600">CLICK's windows recorded in <span className="select-all font-mono">{recorded}</span>: send it to us with the log.</p>}
              {logPath && <p className="text-xs text-steel-500">Log for support: <span className="select-all font-mono">{logPath}</span></p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
