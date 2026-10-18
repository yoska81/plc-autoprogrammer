import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { fileToBlock } from '../../../lib/ai/importAI';
import { Spinner } from '../../../components/common';
import LadderView from '../../ui/ladder/LadderView';
import type { LadderProgram } from '../../core/ladder';
import type { ValidationIssue } from '../../core/validate';
import { convertForeign } from '../convert';
import { printoutToForeign, readPrintout, type PrintoutReading, type ReadConfidence } from '../printout';
import type { ImportedProgram } from '../types';

const CONF: Record<ReadConfidence, { label: string; cls: string }> = {
  high: { label: 'clear', cls: 'bg-green-100 text-green-800' },
  medium: { label: 'check', cls: 'bg-amber-100 text-amber-800' },
  low: { label: 'hard to read', cls: 'bg-red-100 text-red-800' },
};

/**
 * A printout (PDF print or photos / screenshots of the ladder) read by the AI, then reviewed: every rung is
 * shown with its page and how sure the reading is; the user confirms before it is used. Rungs that were
 * hard to read become questions on the Machine description page.
 */
export default function PrintoutReader({ onRead }: { onRead: (imp: ImportedProgram) => void }) {
  const settings = useSettingsStore();
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<PrintoutReading | null>(null);
  const abort = useRef<AbortController | null>(null);
  const ready = settings.provider === 'anthropic' && Boolean(settings.anthropicApiKey);

  const read = async () => {
    if (!files.length) return;
    setBusy(true); setError(null); setReading(null);
    abort.current = new AbortController();
    try {
      const blocks = await Promise.all(files.map(fileToBlock));
      const r = await readPrintout({ apiKey: settings.anthropicApiKey, model: settings.anthropicModel, effort: settings.effort, signal: abort.current.signal, blocks, names: files.map((f) => f.name), note });
      setReading(r.reading);
    } catch (e) {
      if (!abort.current.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const count = reading ? reading.routines.reduce((n, r) => n + r.rungs.length, 0) : 0;
  const unsure = reading ? reading.routines.flatMap((r) => r.rungs).filter((g) => g.confidence !== 'high').length : 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3" data-testid="printout-reader">
      <h3 className="text-sm font-semibold text-gray-800">Or a printout of the program</h3>
      <p className="text-xs text-gray-500">When the program can't be exported as a file (CLICK, RSLogix 500, Unitronics…): print it to PDF from the PLC software, or take clear photos / screenshots of the ladder. The AI reads every rung; you check the reading before it is used.</p>
      {!ready && <p className="text-xs bg-yellow-50 border border-yellow-200 rounded p-2 text-yellow-800">Reading printouts uses Claude: add your Anthropic API key in <Link to="/settings" className="underline">Settings</Link>.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 cursor-pointer">
          Choose PDF or images
          <input data-testid="printout-file" type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={(e) => { setFiles([...(e.target.files ?? [])].slice(0, 20)); e.target.value = ''; }} />
        </label>
        {files.map((f) => <span key={f.name} className="text-xs bg-gray-100 rounded px-2 py-1">{f.name}</span>)}
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything that helps, e.g. &quot;CLICK C0-12DD1E, pages 3–4 are the alarms&quot;" className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm" />
      <div className="flex gap-2">
        <button data-testid="printout-read" onClick={() => void read()} disabled={!files.length || busy || !ready} className="px-4 py-1.5 bg-brand-600 text-white text-sm rounded hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2">
          {busy && <Spinner />}{busy ? 'Reading the printout…' : 'Read the printout'}
        </button>
        {busy && <button onClick={() => abort.current?.abort()} className="px-3 py-1.5 text-sm rounded border border-gray-300">Cancel</button>}
      </div>
      {error && <div role="alert" className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">{error}</div>}

      {reading && (
        <div className="space-y-3" data-testid="printout-review">
          <p className="text-sm">
            <b>{count}</b> rungs read{reading.plc.maker || reading.plc.model ? ` from a ${[reading.plc.maker, reading.plc.model].filter(Boolean).join(' ')} printout` : ''}.
            {unsure ? <> <b>{unsure}</b> need a look (marked below); the ones that were hard to read will be asked on the Machine description page.</> : ' All of them were clear.'}
          </p>
          {reading.notes.length > 0 && <ul className="text-xs text-gray-600 list-disc ml-5">{reading.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
          {reading.routines.map((rt) => {
            const program: LadderProgram = { rungs: rt.rungs.map(({ id, comment, branches, outputs }) => ({ id, comment, branches, outputs })), tags: [] };
            const issues: ValidationIssue[] = rt.rungs.filter((g) => g.confidence !== 'high').map((g) => ({ rungId: g.id, severity: g.confidence === 'low' ? 'error' : 'warning', message: `Page ${g.page}: ${g.doubt || 'check against the printout'}` }));
            const byId = new Map(rt.rungs.map((g) => [g.id, g]));
            return (
              <div key={rt.name} className="border border-gray-200 rounded">
                <div className="px-3 py-1.5 bg-gray-50 text-xs font-medium text-gray-700 flex flex-wrap gap-2 items-center">
                  <span className="flex-1">{rt.name || 'Program'}</span>
                  {rt.rungs.map((g) => <span key={g.id} className={`px-1.5 py-0.5 rounded ${CONF[g.confidence].cls}`} title={g.doubt}>{g.number} · p.{g.page} · {CONF[g.confidence].label}</span>)}
                </div>
                <div className="overflow-auto max-h-[28rem]">
                  <LadderView program={program} issues={issues} numberOf={(id) => Number(byId.get(id)?.number) || 0} />
                </div>
              </div>
            );
          })}
          <div className="flex items-center gap-3">
            <button data-testid="printout-confirm" onClick={() => onRead(convertForeign(printoutToForeign(reading), files[0]?.name ?? 'printout.pdf'))} className="px-4 py-1.5 bg-brand-600 text-white text-sm rounded hover:bg-brand-700">The reading is right: use it</button>
            <button onClick={() => setReading(null)} className="text-sm px-3 py-1.5 rounded border border-gray-300">Discard</button>
          </div>
        </div>
      )}
    </div>
  );
}
