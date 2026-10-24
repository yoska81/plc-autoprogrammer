import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { Spinner } from '../../../components/common';
import LadderView from '../../ui/ladder/LadderView';
import type { LadderProgram } from '../../core/ladder';
import type { ValidationIssue } from '../../core/validate';
import { convertForeign } from '../convert';
import { mergeReadings, printoutToForeign, readPrintoutPages, type PrintoutReading, type ReadConfidence } from '../printout';
import { PAGES_PER_REQUEST, printoutPages, type PrintoutPage } from '../printoutPages';
import type { ImportedProgram } from '../types';

const CONF: Record<ReadConfidence, { label: string; cls: string }> = {
  high: { label: 'clear', cls: 'bg-green-100 text-green-800' },
  medium: { label: 'check', cls: 'bg-amber-100 text-amber-800' },
  low: { label: 'hard to read', cls: 'bg-red-100 text-red-800' },
};

type Decision = 'confirmed' | 'left-out';

/**
 * A printout (PDF print or photos / screenshots of the ladder) read by the AI page batch by page batch,
 * then reviewed: every rung with its page (image), the medium ones flagged, each hard-to-read one
 * confirmed or left out by the user before the reading is used. Hard-to-read rungs and unknown operands
 * become questions on the Machine description page.
 */
export default function PrintoutReader({ onRead }: { onRead: (imp: ImportedProgram) => void }) {
  const settings = useSettingsStore();
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<PrintoutReading | null>(null);
  const [pages, setPages] = useState<PrintoutPage[]>([]);
  const [decided, setDecided] = useState<Record<string, Decision>>({});
  const [shownPage, setShownPage] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const ready = settings.provider === 'anthropic' && Boolean(settings.anthropicApiKey);

  const read = async () => {
    if (!files.length) return;
    setError(null); setReading(null); setDecided({});
    abort.current = new AbortController();
    try {
      setBusy('Preparing the pages…');
      const pgs = await printoutPages(files, (n) => setBusy(`Preparing the pages… ${n}`));
      setPages(pgs);
      const parts: PrintoutReading[] = [];
      for (let i = 0; i < pgs.length; i += PAGES_PER_REQUEST) {
        const batch = pgs.slice(i, i + PAGES_PER_REQUEST);
        setBusy(`Reading page${batch.length > 1 ? 's' : ''} ${batch[0].number}${batch.length > 1 ? `–${batch[batch.length - 1].number}` : ''} of ${pgs.length}…`);
        const r = await readPrintoutPages({ apiKey: settings.anthropicApiKey, model: settings.anthropicModel, effort: settings.effort, signal: abort.current.signal, pages: batch, total: pgs.length, note });
        parts.push(r.reading);
      }
      setReading(mergeReadings(parts));
    } catch (e) {
      if (!abort.current.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(null); }
  };

  const allRungs = reading ? reading.routines.flatMap((r) => r.rungs) : [];
  const low = allRungs.filter((g) => g.confidence === 'low');
  const medium = allRungs.filter((g) => g.confidence === 'medium').length;
  const open = low.filter((g) => !decided[g.id]).length;

  const use = () => {
    if (!reading) return;
    try {
      // Rungs the user left out are not used; each is asked about on the Machine description page.
      const leftOut = allRungs.filter((g) => decided[g.id] === 'left-out');
      const kept: PrintoutReading = {
        ...reading,
        routines: reading.routines.map((r) => ({ ...r, rungs: r.rungs.filter((g) => decided[g.id] !== 'left-out') })),
        notes: [...reading.notes, ...leftOut.map((g) => `Hard to read: rung ${g.number} on page ${g.page} was left out of the program (${g.doubt || 'unclear'}). What does it do?`)],
      };
      onRead(convertForeign(printoutToForeign(kept), files[0]?.name ?? 'printout.pdf'));
    } catch (e) {
      setError(`The reading could not be used: ${e instanceof Error ? e.message : String(e)}. Read the printout again, or leave out the rungs that are marked.`);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3" data-testid="printout-reader">
      <h3 className="text-sm font-semibold text-gray-800">Or a printout of the program <span className="ml-1 text-[10px] uppercase tracking-wide bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">beta</span></h3>
      <p className="text-xs text-gray-500">When the program can't be exported as a file (CLICK, RSLogix 500, Unitronics…): print it to PDF from the PLC software, or take clear photos / screenshots of the ladder. The AI reads every rung; you check the reading before it is used. Up to 120 pages at a time.</p>
      {!ready && <p className="text-xs bg-yellow-50 border border-yellow-200 rounded p-2 text-yellow-800">Reading printouts uses Claude: add your Anthropic API key in <Link to="/settings" className="underline">Settings</Link>.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 cursor-pointer">
          Choose PDF or images
          <input data-testid="printout-file" type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={(e) => { setFiles([...(e.target.files ?? [])].slice(0, 20)); e.target.value = ''; }} />
        </label>
        {files.map((f, i) => <span key={`${f.name}${i}`} className="text-xs bg-gray-100 rounded px-2 py-1">{f.name}</span>)}
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything that helps, e.g. &quot;CLICK C0-12DD1E, pages 3–4 are the alarms&quot;" className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm" />
      <div className="flex gap-2 items-center">
        <button data-testid="printout-read" onClick={() => void read()} disabled={!files.length || !!busy || !ready} className="px-4 py-1.5 bg-brand-600 text-white text-sm rounded hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2">
          {busy && <Spinner />}{busy ?? 'Read the printout'}
        </button>
        {busy && <button onClick={() => abort.current?.abort()} className="px-3 py-1.5 text-sm rounded border border-gray-300">Cancel</button>}
      </div>
      {error && <div role="alert" className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">{error}</div>}

      {reading && (
        <div className="space-y-3" data-testid="printout-review">
          <p className="text-sm">
            <b>{allRungs.length}</b> rungs read{reading.plc.maker || reading.plc.model ? ` from a ${[reading.plc.maker, reading.plc.model].filter(Boolean).join(' ')} printout` : ''}.
            {low.length ? <> <b>{low.length}</b> {low.length === 1 ? 'was' : 'were'} hard to read: check each against its page, then confirm it or leave it out.</> : ''}
            {medium ? <> {medium} more {medium === 1 ? 'is' : 'are'} marked "check".</> : ''}
            {!low.length && !medium ? ' All of them were clear.' : ''}
          </p>
          {reading.notes.length > 0 && <ul className="text-xs text-gray-600 list-disc ml-5">{reading.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
          {reading.routines.map((rt, ri) => {
            const program: LadderProgram = { rungs: rt.rungs.map(({ id, comment, branches, outputs }) => ({ id, comment, branches, outputs })), tags: [] };
            const issues: ValidationIssue[] = rt.rungs.filter((g) => g.confidence !== 'high').map((g) => ({ rungId: g.id, severity: g.confidence === 'low' ? 'error' : 'warning', message: `Page ${g.page}: ${g.doubt || 'check against the printout'}` }));
            const byId = new Map(rt.rungs.map((g) => [g.id, g]));
            const lowHere = rt.rungs.filter((g) => g.confidence === 'low');
            return (
              <div key={`${rt.name}${ri}`} className="border border-gray-200 rounded">
                <div className="px-3 py-1.5 bg-gray-50 text-xs font-medium text-gray-700 flex flex-wrap gap-2 items-center">
                  <span className="flex-1">{rt.name || 'Program'}</span>
                  {rt.rungs.map((g) => (
                    <button key={g.id} onClick={() => setShownPage(g.page)} className={`px-1.5 py-0.5 rounded ${CONF[g.confidence].cls}`} title={`${g.doubt ? `${g.doubt} — ` : ''}show page ${g.page}`}>{g.number} · p.{g.page} · {CONF[g.confidence].label}</button>
                  ))}
                </div>
                {lowHere.length > 0 && (
                  <ul className="px-3 py-2 space-y-1 border-b border-gray-100 text-xs" data-testid="printout-low">
                    {lowHere.map((g) => (
                      <li key={g.id} className="flex flex-wrap items-center gap-2">
                        <span className="text-red-800">Rung {g.number}, page {g.page}: {g.doubt || 'hard to read'}</span>
                        <button onClick={() => setShownPage(g.page)} className="underline">see page</button>
                        <button data-testid="printout-low-confirm" onClick={() => setDecided((d) => ({ ...d, [g.id]: 'confirmed' }))} className={`px-2 py-0.5 rounded border ${decided[g.id] === 'confirmed' ? 'bg-green-600 text-white border-green-600' : 'border-gray-300'}`}>It's right</button>
                        <button onClick={() => setDecided((d) => ({ ...d, [g.id]: 'left-out' }))} className={`px-2 py-0.5 rounded border ${decided[g.id] === 'left-out' ? 'bg-gray-700 text-white border-gray-700' : 'border-gray-300'}`}>Leave it out</button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="overflow-auto max-h-[28rem]">
                  <LadderView program={program} issues={issues} numberOf={(id) => Number(byId.get(id)?.number) || 0} />
                </div>
              </div>
            );
          })}
          {shownPage !== null && pages[shownPage - 1] && (
            <div className="border border-gray-200 rounded p-2" data-testid="printout-page">
              <div className="flex items-center text-xs text-gray-600 mb-1"><span className="flex-1">Page {shownPage} · {pages[shownPage - 1].file}</span><button onClick={() => setShownPage(null)} className="underline">close</button></div>
              <img src={`data:image/jpeg;base64,${pages[shownPage - 1].data}`} alt={`Printout page ${shownPage}`} className="max-w-full border border-gray-100" />
            </div>
          )}
          <div className="flex items-center gap-3">
            <button data-testid="printout-confirm" onClick={use} disabled={open > 0} className="px-4 py-1.5 bg-brand-600 text-white text-sm rounded hover:bg-brand-700 disabled:opacity-50">The reading is right: use it</button>
            {open > 0 && <span className="text-xs text-red-800">Confirm or leave out the {open} hard-to-read rung{open === 1 ? '' : 's'} first.</span>}
            <button onClick={() => setReading(null)} className="text-sm px-3 py-1.5 rounded border border-gray-300">Discard</button>
          </div>
        </div>
      )}
    </div>
  );
}
