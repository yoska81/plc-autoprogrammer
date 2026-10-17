/**
 * Electrical drawing set viewer: ANSI B sheets rendered as SVG.
 * Normal mode = one scrolling document of all sheets with a sheet list; printMode = every sheet on its own page.
 */
import { sheetOnPaper } from '../../standards/regions';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DrawingContext } from '../derive';
import { SHEET_H, SHEET_W } from './geometry';
import { planDrawings } from './plan';
import SheetView from './SheetView';
import { useUi } from '../../store/useUiStore';

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

  const width = zoom === 'fit' ? '100%' : `${SHEET_W * zoom}mm`;
  const height = zoom === 'fit' ? undefined : `${SHEET_H * zoom}mm`;
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
            <div className="shadow-md bg-white">
              <SheetView plan={plan} sheet={s} width={zoom === 'fit' ? '100%' : width} height={height} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function shortTitle(t: string): string {
  const s = t.split(' — ')[0].replace(/^PLC /, '').replace(/ & .*$/, '').replace(/,.*$/, '');
  const io = /—\s*(.*)\((X\d+|Y\d+)/.exec(t);
  return io ? `${s} ${io[2]}` : s;
}
