import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProjectsStore } from '../store/useProjectsStore';
import { useProjectStore } from '../store/useProjectStore';
import { useElectricalStore } from '../store/useElectricalStore';
import { useIOStore } from '../store/useIOStore';
import { useDraft } from '../store/useDraftStore';
import { notify } from '../store/useNoticeStore';
import { applyRedlines, previewEdits } from './apply';
import { describeEdit, nextRev, type Redline } from './fieldChange';
import { useRedlines, useRedlineStore } from './useRedlineStore';

const where = (r: Redline) => (r.at.kind === 'sheet' ? `Sheet ${r.at.sheet} · ${r.at.drawingNo}` : 'Field change');

/** Redlines marked on the drawings and field changes: turned into design edits, then issued as a revision. */
export default function RedlinesPage() {
  const projectId = useProjectsStore((s) => s.activeId);
  const list = useRedlines(projectId);
  const { add, remove } = useRedlineStore();
  const info = useProjectStore((s) => s.info);
  const design = useElectricalStore((s) => s.design);
  const inputs = useElectricalStore((s) => s.inputs);
  const io = useIOStore((s) => s.projectIO);
  const [target, setTarget] = useDraft('redline.target', '');
  const [note, setNote] = useDraft('redline.note', '');
  const [by, setBy] = useDraft('redline.by', info.preparedBy);
  const [desc, setDesc] = useState('');
  const open = list.filter((r) => r.status === 'open');
  const done = list.filter((r) => r.status !== 'open');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- previewEdits reads these stores
  const preview = useMemo(() => previewEdits(list), [list, design, inputs, io]);
  const rev = nextRev(info.revisions);
  const tags = useMemo(() => [...new Set([...inputs.motors.map((m) => m.tag), ...(design?.ioWiring.map((w) => w.deviceTag) ?? []), ...(design?.components.map((c) => c.tag) ?? [])])].sort(), [design, inputs]);

  const addChange = () => {
    const text = note.trim();
    if (!text) return;
    add(projectId, { at: { kind: 'form' }, note: target && !new RegExp(`\\b${target}\\b`, 'i').test(text) ? `${target}: ${text}` : text, by: by.trim() });
    setNote('');
  };
  const apply = () => {
    if (!by.trim()) { notify('Enter your initials: they go into the revision history.'); return; }
    const r = applyRedlines({ by: by.trim(), description: desc });
    if (r) notify(`Revision ${r.rev} issued: ${r.applied} change${r.applied === 1 ? '' : 's'} made in the design${r.manual ? `, ${r.manual} to edit by hand` : ''}. The change list is in Project data → Revision history.`);
    setDesc('');
  };

  return (
    <>
      <header className="border-b border-steel-200 bg-white px-4 py-2.5">
        <h2 className="text-base font-semibold text-steel-800">Redlines and field changes</h2>
        <p className="mt-0.5 text-xs text-steel-500">Changes found on site or in the shop: mark them on a drawing sheet (Electrical → drawings → "Redline") or enter them here. The app makes the design edits it can (motor power or starter, I/O descriptions, device locations, part numbers), bumps the revision and writes the change list into the revision history.</p>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <section aria-label="New field change" className="space-y-2 rounded border border-steel-200 bg-white p-3">
          <h3 className="text-sm font-semibold text-steel-800">New field change</h3>
          <div className="flex flex-wrap gap-2">
            <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Device or motor" className="rounded border border-steel-300 px-2 py-1 text-sm">
              <option value="">Device / motor (optional)</option>
              {tags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addChange(); }} aria-label="Change"
              placeholder='e.g. "M1 is 3 HP", "Replace K1 with …", "Move PE1 to the infeed", "X003 description: Guard door closed"'
              className="min-w-64 flex-1 rounded border border-steel-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            <button type="button" onClick={addChange} disabled={!note.trim()} className="rounded bg-brand-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-40">Add</button>
          </div>
          <p className="text-xs text-steel-500">Or <Link to="/electrical?tab=cabinet" className="underline">mark it on a drawing sheet</Link>: turn on "Redline", click the spot and write the change.</p>
        </section>

        <section aria-label="Open changes" className="space-y-2 rounded border border-steel-200 bg-white p-3">
          <h3 className="text-sm font-semibold text-steel-800">Open changes ({open.length})</h3>
          {!open.length && <p className="text-sm text-steel-500">No open redlines or field changes.</p>}
          <ol className="space-y-1.5">
            {open.map((r) => {
              const edits = preview.get(r.id) ?? [];
              return (
                <li key={r.id} className="rounded-sm border border-red-200 bg-red-50/40 px-3 py-2" data-redline={r.id}>
                  <div className="flex items-start gap-2">
                    <p className="flex-1 text-sm text-steel-900"><span className="mr-2 text-xs font-semibold text-red-700">{where(r)}</span>{r.note}</p>
                    <button type="button" onClick={() => remove(projectId, r.id)} aria-label={`Delete ${r.note}`} className="text-steel-400 hover:text-red-600">✕</button>
                  </div>
                  <p className={`text-xs ${edits.length ? 'text-green-800' : 'text-amber-800'}`}>{edits.length ? `Will change: ${edits.map(describeEdit).join('; ')}` : 'Recorded in the change list — edit the design by hand.'}</p>
                  <p className="text-[11px] text-steel-400">{r.by || '—'} · {r.date}</p>
                </li>
              );
            })}
          </ol>
          {open.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-steel-100 pt-2">
              <input value={by} onChange={(e) => setBy(e.target.value)} placeholder="Initials" aria-label="Revised by" className="w-24 rounded border border-steel-300 px-2 py-1 text-sm" />
              <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={`Field changes (${open.length} redline${open.length === 1 ? '' : 's'})`} aria-label="Revision description" className="min-w-48 flex-1 rounded border border-steel-300 px-2 py-1 text-sm" />
              <button type="button" onClick={apply} className="rounded bg-brand-600 px-3 py-1 text-sm font-medium text-white hover:bg-brand-700">Apply and issue revision {rev}</button>
            </div>
          )}
        </section>

        {done.length > 0 && (
          <section aria-label="Applied changes" className="space-y-1.5 rounded border border-steel-200 bg-white p-3">
            <h3 className="text-sm font-semibold text-steel-800">In a revision ({done.length})</h3>
            <ol className="space-y-1 text-sm">
              {done.map((r) => (
                <li key={r.id} className="text-steel-700">
                  <span className="mr-2 font-mono text-xs font-semibold">Rev {r.rev}</span><span className="mr-2 text-xs text-steel-500">{where(r)}</span>{r.note}
                  <span className={`ml-2 text-xs ${r.status === 'applied' ? 'text-green-800' : 'text-amber-800'}`}>{r.status === 'applied' ? `→ ${r.done?.join('; ')}` : '→ to be edited by hand'}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </>
  );
}
