/**
 * Electrical drawing set viewer: ANSI B sheets rendered as SVG.
 * Normal mode = sheet tabs + one sheet with zoom; printMode = every sheet on its own page.
 */
import { sheetOnPaper } from '../../standards/regions';
import { useMemo, useState } from 'react';
import type { DrawingContext } from '../derive';
import { SHEET_H, SHEET_W } from './geometry';
import { planDrawings } from './plan';
import SheetView from './SheetView';

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
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState<Zoom>('fit');
  const idx = Math.min(active, shown.length - 1);
  const sheet = shown[idx];

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
  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-100">
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-300 bg-white">
        <div className="flex-1 flex gap-1 overflow-x-auto" role="tablist" aria-label="Drawing sheets">
          {shown.map((s, i) => (
            <button
              key={s.n} role="tab" aria-selected={i === idx} title={`${s.drawingNo} — ${s.title}`}
              onClick={() => setActive(i)}
              className={`shrink-0 px-2 py-1 text-xs rounded border whitespace-nowrap ${i === idx ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            >
              <span className="font-mono font-semibold">{s.n}</span>
              <span className="ml-1 hidden md:inline">{shortTitle(s.title)}</span>
            </button>
          ))}
        </div>
        <div className="flex shrink-0 rounded border border-gray-300 overflow-hidden text-xs">
          {(['fit', 1, 2] as Zoom[]).map((z) => (
            <button key={String(z)} onClick={() => setZoom(z)} className={`px-2 py-1 ${zoom === z ? 'bg-gray-800 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
              {z === 'fit' ? 'Fit' : `${z * 100}%`}
            </button>
          ))}
        </div>
      </div>
      <div className="px-3 py-1 text-xs text-gray-600 bg-gray-50 border-b border-gray-200 truncate">
        Sheet {sheet.n} of {plan.sheets.length} · <span className="font-mono">{sheet.drawingNo}</span> · {sheet.title}
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-3">
        <div className="mx-auto shadow-md bg-white" style={{ width, maxWidth: zoom === 'fit' ? 'calc((100vh - 140px) * 1.5455)' : undefined }}>
          <SheetView plan={plan} sheet={sheet} width={zoom === 'fit' ? '100%' : width} height={height} />
        </div>
      </div>
    </div>
  );
}

function shortTitle(t: string): string {
  const s = t.split(' — ')[0].replace(/^PLC /, '').replace(/ & .*$/, '').replace(/,.*$/, '');
  const io = /—\s*(.*)\((X\d+|Y\d+)/.exec(t);
  return io ? `${s} ${io[2]}` : s;
}
