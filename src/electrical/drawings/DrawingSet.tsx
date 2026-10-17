/**
 * Electrical drawing set viewer: ANSI B sheets rendered as SVG.
 * Normal mode = one scrolling document of all sheets with a sheet list; printMode = every sheet on its own page.
 */
import { sheetOnPaper } from '../../standards/regions';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DrawingContext } from '../derive';
import { planDrawings } from './plan';
import SheetView from './SheetView';
import { useUi } from '../../store/useUiStore';
import { useProjectsStore } from '../../store/useProjectsStore';
import { useRedlines, useRedlineStore } from '../../redlines/useRedlineStore';
import type { Redline } from '../../redlines/fieldChange';
import { Link } from 'react-router-dom';

interface DrawingSetProps {
  ctx: DrawingContext;
  printMode?: boolean;
  /** Show only the cabinet or machine (field) wiring sheets; the cover sheet is always included. Sheet numbers stay those of the full set. */
  section?: 'all' | 'cabinet' | 'machine';
}

type Zoom = 'fit' | 1 | 2;

// CSS `size` takes either lengths or a keyword + orientation; 17in x 11in is already landscape.
const printCss = (size: string) => `
@page { size: ${size}; margin: 0; }
@media print {
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  .dwg-page { break-after: page; page-break-after: always; box-shadow: none !important; margin: 0 !important; }
  .dwg-page:last-child { break-after: auto; page-break-after: auto; }
}
`;

export default function DrawingSet({ ctx, printMode, section = 'all' }: DrawingSetProps) {
  const plan = useMemo(() => planDrawings(ctx), [ctx]);
  const paper = sheetOnPaper(ctx.sheet);
  const shown = useMemo(() => plan.sheets.filter((s) => section === 'all' || s.section === 'cover' || s.section === section), [plan, section]);
  const [active, setActive] = useUi(`drawings.${section}.sheet`, 0);
  const [zoom, setZoom] = useUi<Zoom>('drawings.zoom', 'fit');
  const idx = Math.min(active, shown.length - 1);

  if (printMode) {
    return (
      <div className="drawing-print bg-white">
        <style>{printCss(paper.paper.css)}</style>
        {shown.map((s) => (
          <div key={s.n} className="dwg-page" style={{ width: `${paper.paper.w}mm`, height: `${paper.paper.h}mm`, overflow: 'hidden', paddingTop: `${paper.y}mm`, paddingLeft: `${paper.x}mm`, boxSizing: 'border-box' }}>
            <SheetView plan={plan} sheet={s} width={`${paper.w}mm`} height={`${paper.h}mm`} />
          </div>
        ))}
      </div>
    );
  }

  const width = zoom === 'fit' ? '100%' : `${paper.paper.w * zoom}mm`;
  const height = zoom === 'fit' ? undefined : `${paper.paper.h * zoom}mm`;
  return <DrawingDocument plan={plan} shown={shown} idx={idx} setActive={setActive} zoom={zoom} setZoom={setZoom} width={width} height={height} />;
}

/**
 * The drawing set as ONE document: every sheet stacked, scrolled like a PDF, with a sheet list on the
 * left to jump to a sheet. The list follows the scroll; the last sheet viewed is remembered.
 */
function DrawingDocument({ plan, shown, idx, setActive, zoom, setZoom, width, height }: {
  plan: ReturnType<typeof planDrawings>; shown: ReturnType<typeof planDrawings>['sheets']; idx: number; setActive: (i: number) => void;
  zoom: Zoom; setZoom: (z: Zoom) => void; width: string; height: string | undefined;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const pages = useRef<(HTMLDivElement | null)[]>([]);
  // Redline mode: click a spot on a sheet and write the change (src/redlines).
  const [redline, setRedline] = useUi('drawings.redline', false);
  const projectId = useProjectsStore((s) => s.activeId);
  const redlines = useRedlines(projectId);
  const [mark, setMark] = useState<{ sheet: number; x: number; y: number } | null>(null);
  const [note, setNote] = useState('');
  const addRedline = useRedlineStore((s) => s.add);
  const saveMark = (sh: { n: number; drawingNo: string; title: string }) => {
    if (!mark || !note.trim()) return;
    addRedline(projectId, { at: { kind: 'sheet', sheet: sh.n, drawingNo: sh.drawingNo, title: sh.title, x: mark.x, y: mark.y }, note: note.trim(), by: '' });
    setMark(null);
    setNote('');
  };
  const [current, setCurrent] = useState(idx);
  const jumping = useRef(false);

  const jump = (i: number, smooth = true) => {
    const el = pages.current[i];
    if (!el || !scroller.current) return;
    jumping.current = true;
    scroller.current.scrollTo({ top: el.offsetTop - 8, behavior: smooth ? 'smooth' : 'auto' });
    setCurrent(i);
    setActive(i);
    window.setTimeout(() => { jumping.current = false; }, smooth ? 600 : 50);
  };

  // Open where the user was last time.
  const opened = useRef<Zoom | null>(null);
  useEffect(() => { if (opened.current !== zoom) { opened.current = zoom; jump(idx, false); } }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // The sheet list follows the scroll position.
  const onScroll = () => {
    if (jumping.current || !scroller.current) return;
    const top = scroller.current.scrollTop + scroller.current.clientHeight * 0.3;
    let i = 0;
    for (let k = 0; k < pages.current.length; k++) if ((pages.current[k]?.offsetTop ?? Infinity) <= top) i = k;
    if (i !== current) { setCurrent(i); setActive(i); }
  };

  return (
    <div className="flex h-full min-h-0 bg-gray-100">
      <nav className="w-52 shrink-0 border-r border-gray-300 bg-white flex flex-col min-h-0" aria-label="Drawing sheets">
        <div className="px-2 py-1.5 border-b border-gray-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700">Sheets ({shown.length})</span>
          <button onClick={() => { setRedline(!redline); setMark(null); }} aria-pressed={redline} aria-description="Mark a change on a sheet: click the spot, write the change"
            className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${redline ? 'border-red-600 bg-red-600 text-white' : 'border-red-300 text-red-700 hover:bg-red-50'}`}>Redline</button>
          <div className="flex rounded border border-gray-300 overflow-hidden text-[11px]">
            {(['fit', 1, 2] as Zoom[]).map((z) => (
              <button key={String(z)} onClick={() => setZoom(z)} className={`px-1.5 py-0.5 ${zoom === z ? 'bg-gray-800 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
                {z === 'fit' ? 'Fit' : `${z * 100}%`}
              </button>
            ))}
          </div>
        </div>
        <ol className="flex-1 overflow-y-auto py-1 text-xs">
          {shown.map((s, i) => (
            <li key={s.n}>
              <button onClick={() => jump(i)} title={`${s.drawingNo} — ${s.title}`} aria-current={i === current ? 'page' : undefined}
                className={`w-full text-left px-2 py-1 flex gap-1.5 ${i === current ? 'bg-brand-600 text-white' : 'text-gray-700 hover:bg-brand-50'}`}>
                <span className="font-mono font-semibold w-5 text-right shrink-0">{s.n}</span>
                <span className="truncate">{shortTitle(s.title)}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <div ref={scroller} onScroll={onScroll} className="relative flex-1 min-h-0 overflow-auto p-3 space-y-4" data-testid="drawing-document">
        {shown.map((s, i) => (
          <div key={s.n} ref={(el) => { pages.current[i] = el; }} data-sheet={s.n} className="mx-auto" style={{ width, maxWidth: zoom === 'fit' ? 1400 : undefined }}>
            <div className="px-1 pb-1 text-xs text-gray-600 truncate">
              Sheet {s.n} of {plan.sheets.length} · <span className="font-mono">{s.drawingNo}</span> · {s.title}
            </div>
            <div className={`relative shadow-md bg-white ${redline ? 'cursor-crosshair' : ''}`} data-redline-sheet={s.n}
              onClick={(e) => {
                if (!redline || (e.target as HTMLElement).closest('[data-redline-form]')) return;
                const b = e.currentTarget.getBoundingClientRect();
                setMark({ sheet: s.n, x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height });
                setNote('');
              }}>
              <SheetView plan={plan} sheet={s} width={zoom === 'fit' ? '100%' : width} height={height} />
              {redlines.filter((r) => r.at.kind === 'sheet' && r.at.sheet === s.n).map((r) => <RedlineMark key={r.id} r={r} n={redlines.indexOf(r) + 1} />)}
              {mark?.sheet === s.n && (
                <form data-redline-form className="absolute z-10 flex w-72 flex-col gap-1 rounded border border-red-400 bg-white p-2 shadow-lg"
                  style={{ left: `min(${mark.x * 100}%, calc(100% - 18rem))`, top: `${mark.y * 100}%` }}
                  onSubmit={(e) => { e.preventDefault(); saveMark(s); }}>
                  <textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} rows={2} aria-label="Redline change"
                    placeholder='The change, e.g. "M1 is 3 HP", "Replace K1 with …"' className="rounded border border-steel-300 px-2 py-1 text-xs" />
                  <div className="flex gap-1">
                    <button type="submit" disabled={!note.trim()} className="rounded bg-red-600 px-2 py-0.5 text-xs font-semibold text-white disabled:opacity-40">Add redline</button>
                    <button type="button" onClick={() => setMark(null)} className="rounded border border-steel-300 px-2 py-0.5 text-xs">Cancel</button>
                    <Link to="/redlines" className="ml-auto self-center text-[11px] underline text-steel-500">All redlines</Link>
                  </div>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A redline cloud on its sheet: red while open, grey once in a revision. */
function RedlineMark({ r, n }: { r: Redline; n: number }) {
  if (r.at.kind !== 'sheet') return null;
  const open = r.status === 'open';
  return (
    <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${r.at.x * 100}%`, top: `${r.at.y * 100}%` }} data-redline={r.id} title={r.note}>
      <div className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-bold ${open ? 'border-red-600 bg-red-50/80 text-red-700' : 'border-steel-400 bg-white/80 text-steel-500'}`}>{n}</div>
      <div className={`mt-0.5 max-w-48 rounded px-1 text-[10px] leading-tight ${open ? 'bg-red-600 text-white' : 'bg-steel-200 text-steel-700'}`}>{r.note}{r.rev ? ` (rev ${r.rev})` : ''}</div>
    </div>
  );
}

function shortTitle(t: string): string {
  const s = t.split(' — ')[0].replace(/^PLC /, '').replace(/ & .*$/, '').replace(/,.*$/, '');
  const io = /—\s*(.*)\((X\d+|Y\d+)/.exec(t);
  return io ? `${s} ${io[2]}` : s;
}
