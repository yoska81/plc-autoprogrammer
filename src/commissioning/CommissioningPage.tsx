import { useEffect, useMemo, useRef, useState } from 'react';
import { collectProject } from '../deliverables/collect';
import { saveBlob } from '../deliverables/files';
import { useProjectsStore } from '../store/useProjectsStore';
import { useProgramStore } from '../store/useProgramStore';
import { useIOStore } from '../store/useIOStore';
import { useElectricalStore } from '../store/useElectricalStore';
import { useHmiStore } from '../store/useHmiStore';
import { useUi } from '../store/useUiStore';
import { useDraft } from '../store/useDraftStore';
import { notify } from '../store/useNoticeStore';
import { commissioningItems, progress, SECTION_TITLE, type CommItem, type CommResult, type CommSection } from './checklist';
import { nowStamp, useCommissioningStore } from './useCommissioningStore';
import { commissioningPdf, commissioningXlsx } from './export';

const SECTIONS = Object.keys(SECTION_TITLE) as CommSection[];
const EMPTY = { results: {} as Record<string, CommResult>, signoff: null };
const RESULT_STYLE: Record<NonNullable<CommResult['status']>, string> = {
  pass: 'border-green-600 bg-green-600 text-white', fail: 'border-red-600 bg-red-600 text-white', na: 'border-steel-500 bg-steel-500 text-white',
};

/** The checklist items of the open project (rebuilt when the I/O, program, electrical or HMI change). */
function useItems(): CommItem[] {
  const io = useIOStore((s) => s.projectIO);
  const ladder = useProgramStore((s) => s.ladder);
  const design = useElectricalStore((s) => s.design);
  const hmi = useHmiStore((s) => s.design);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- collectProject reads these stores
  return useMemo(() => commissioningItems(collectProject()), [io, ladder, design, hmi]);
}

function Item({ it, r, onSet }: { it: CommItem; r: CommResult | undefined; onSet: (patch: Partial<CommResult>) => void }) {
  const [note, setNote] = useDraft(`comm.note.${it.id}`, r?.note ?? '');
  return (
    <li className={`rounded-sm border bg-white px-3 py-2 ${r?.status === 'fail' ? 'border-red-300' : 'border-steel-200'}`} data-comm-item={it.id}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-steel-900">{it.title}{it.device && <span className="ml-2 text-xs font-normal text-steel-500">{it.device}</span>}</p>
          <p className="text-xs text-steel-600"><span className="font-semibold">Do: </span>{it.procedure}</p>
          <p className="text-xs text-steel-700"><span className="font-semibold">Expect: </span>{it.expected}</p>
        </div>
        <div className="flex shrink-0 gap-1" role="group" aria-label={`Result of ${it.title}`}>
          {(['pass', 'fail', 'na'] as const).map((st) => (
            <button key={st} type="button" aria-pressed={r?.status === st} onClick={() => onSet({ status: r?.status === st ? undefined : st })}
              className={`rounded border px-2 py-0.5 text-xs font-semibold ${r?.status === st ? RESULT_STYLE[st] : 'border-steel-300 bg-white text-steel-700 hover:bg-steel-50'}`}>
              {st === 'pass' ? 'Pass' : st === 'fail' ? 'Fail' : 'N/A'}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <input value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => { if (note !== (r?.note ?? '')) onSet({ note }); }}
          placeholder="Note (measured value, punch-list item…)" aria-label={`Note for ${it.title}`}
          className="flex-1 rounded border border-steel-300 px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500" />
        {r?.status && <span className="text-[11px] text-steel-500">{r.by || '—'} · {r.date}</span>}
      </div>
    </li>
  );
}

/** Signature pad: draw with the mouse, a pen or a finger. */
function SignaturePad({ value, onChange }: { value?: string; onChange: (png: string | undefined) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    if (value) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = value; }
  }, [value]);
  const at = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - b.left) * e.currentTarget.width) / b.width, ((e.clientY - b.top) * e.currentTarget.height) / b.height] as const;
  };
  return (
    <div className="space-y-1">
      <canvas ref={ref} width={600} height={200} aria-label="Signature pad" className="h-24 w-full max-w-md touch-none rounded border border-steel-300 bg-white"
        onPointerDown={(e) => { drawing.current = true; e.currentTarget.setPointerCapture(e.pointerId); const ctx = e.currentTarget.getContext('2d')!; const [x, y] = at(e); ctx.beginPath(); ctx.moveTo(x, y); }}
        onPointerMove={(e) => { if (!drawing.current) return; const ctx = e.currentTarget.getContext('2d')!; const [x, y] = at(e); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#0b2a5c'; ctx.lineTo(x, y); ctx.stroke(); }}
        onPointerUp={(e) => { drawing.current = false; onChange(e.currentTarget.toDataURL('image/png')); }} />
      <button type="button" onClick={() => onChange(undefined)} className="text-xs text-steel-500 underline">Clear signature</button>
    </div>
  );
}

export default function CommissioningPage() {
  const projectId = useProjectsStore((s) => s.activeId);
  const rec = useCommissioningStore((s) => s.byProject[projectId ?? 'default'] ?? EMPTY);
  const { tech, setTech, setResult, sign } = useCommissioningStore();
  const items = useItems();
  const [section, setSection] = useUi<CommSection | 'all'>('comm.section', 'all');
  const [todo, setTodo] = useUi('comm.todo', false);
  const [name, setName] = useState(rec.signoff?.name ?? tech);
  const [company, setCompany] = useState(rec.signoff?.company ?? '');
  const [signature, setSignature] = useState(rec.signoff?.signature ?? '');
  const [drawn, setDrawn] = useState<string | undefined>(rec.signoff?.drawn);
  const [busy, setBusy] = useState<'pdf' | 'xlsx' | null>(null);
  const s = progress(items, rec.results);
  const base = useProgramStore((st) => st.projectName).trim().replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'project';
  const shown = items.filter((it) => (section === 'all' || it.section === section) && (!todo || !rec.results[it.id]?.status));

  const exportAs = async (kind: 'pdf' | 'xlsx') => {
    setBusy(kind);
    try {
      const fresh = useCommissioningStore.getState().byProject[projectId ?? 'default'] ?? EMPTY;
      const blob = kind === 'pdf' ? await commissioningPdf(collectProject(), items, fresh) : await commissioningXlsx(useProgramStore.getState().projectName, items, fresh);
      saveBlob(`${base}_commissioning_checklist.${kind}`, blob);
    } catch (e) {
      notify(`The checklist could not be exported: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setBusy(null); }
  };

  return (
    <>
      <header className="flex flex-wrap items-center gap-3 border-b border-steel-200 bg-white px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-steel-800">Commissioning checklist</h2>
          <p className="mt-0.5 text-xs text-steel-500">Made from the I/O list, the field wiring and the PLC program: every input and output with the result the program expects, every safety function test and every alarm test. Tick each item on site; it is saved in the project.</p>
        </div>
        <button type="button" onClick={() => void exportAs('pdf')} disabled={busy !== null || !items.length} className="rounded border border-steel-300 bg-white px-3 py-1.5 text-sm hover:bg-steel-50 disabled:opacity-50">{busy === 'pdf' ? 'Preparing…' : 'PDF'}</button>
        <button type="button" onClick={() => void exportAs('xlsx')} disabled={busy !== null || !items.length} className="rounded border border-steel-300 bg-white px-3 py-1.5 text-sm hover:bg-steel-50 disabled:opacity-50">{busy === 'xlsx' ? 'Preparing…' : 'Excel'}</button>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {!items.length && <div className="rounded border border-steel-200 bg-white p-4 text-sm text-steel-600">No I/O yet: make the I/O list and the PLC program first; the checklist is made from them.</div>}
        {items.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded border border-steel-200 bg-white px-3 py-2 text-sm">
              <span className="font-semibold" data-testid="comm-progress">{s.done} of {s.total} done</span>
              <span className="text-green-700">{s.pass} pass</span>
              <span className={s.fail ? 'font-semibold text-red-700' : 'text-steel-500'}>{s.fail} fail</span>
              <div className="h-2 min-w-24 flex-1 overflow-hidden rounded bg-steel-100" aria-hidden><div className="h-full bg-brand-600" style={{ width: `${s.total ? (100 * s.done) / s.total : 0}%` }} /></div>
              <label className="flex items-center gap-1 text-xs text-steel-600">Technician
                <input value={tech} onChange={(e) => setTech(e.target.value)} placeholder="Your name" className="w-32 rounded border border-steel-300 px-2 py-0.5 text-xs" />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(['all', ...SECTIONS] as const).map((k) => (
                <button key={k} type="button" aria-pressed={section === k} onClick={() => setSection(k)}
                  className={`rounded border px-2 py-0.5 text-xs font-semibold ${section === k ? 'border-brand-600 bg-brand-600 text-white' : 'border-steel-300 bg-white text-steel-600'}`}>
                  {k === 'all' ? 'All' : SECTION_TITLE[k]} ({k === 'all' ? items.length : items.filter((i) => i.section === k).length})
                </button>
              ))}
              <label className="ml-2 flex items-center gap-1 text-xs text-steel-600"><input type="checkbox" checked={todo} onChange={(e) => setTodo(e.target.checked)} /> Only not done</label>
            </div>
            {SECTIONS.filter((k) => shown.some((i) => i.section === k)).map((k) => (
              <section key={k} aria-label={SECTION_TITLE[k]} className="space-y-1.5">
                <h3 className="text-sm font-semibold text-steel-800">{SECTION_TITLE[k]}</h3>
                <ol className="space-y-1.5">
                  {shown.filter((i) => i.section === k).map((it) => <Item key={it.id} it={it} r={rec.results[it.id]} onSet={(patch) => setResult(projectId, it.id, patch)} />)}
                </ol>
              </section>
            ))}
            <section aria-label="Sign-off" className="space-y-2 rounded border border-steel-200 bg-white p-3">
              <h3 className="text-sm font-semibold text-steel-800">Sign-off</h3>
              {rec.signoff && <p className="text-xs text-green-800" data-testid="comm-signed">Signed by {rec.signoff.name}{rec.signoff.company ? ` (${rec.signoff.company})` : ''} on {rec.signoff.date}.</p>}
              <div className="grid gap-2 sm:grid-cols-3">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Sign-off name" className="rounded border border-steel-300 px-2 py-1 text-sm" />
                <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" aria-label="Sign-off company" className="rounded border border-steel-300 px-2 py-1 text-sm" />
                <input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Type your name to sign" aria-label="Typed signature" className="rounded border border-steel-300 px-2 py-1 text-sm italic" />
              </div>
              <SignaturePad value={drawn} onChange={setDrawn} />
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" disabled={!name.trim() || !(signature.trim() || drawn)}
                  onClick={() => sign(projectId, { name: name.trim(), company: company.trim(), signature: signature.trim(), drawn, date: nowStamp() })}
                  className="rounded bg-brand-600 px-3 py-1 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40">{rec.signoff ? 'Sign again' : 'Sign'}</button>
                {rec.signoff && <button type="button" onClick={() => sign(projectId, null)} className="text-sm text-steel-500 underline">Remove signature</button>}
                {s.done < s.total && <span className="text-xs text-amber-800">{s.total - s.done} item{s.total - s.done === 1 ? '' : 's'} not done yet.</span>}
                {s.fail > 0 && <span className="text-xs font-semibold text-red-700">{s.fail} failed item{s.fail === 1 ? '' : 's'} — list them on the punch list.</span>}
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}
