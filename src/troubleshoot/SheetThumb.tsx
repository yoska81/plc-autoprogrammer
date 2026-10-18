import { useLayoutEffect, useRef, useState } from 'react';
import SheetView from '../electrical/drawings/SheetView';
import type { DrawingPlan } from '../electrical/drawings/plan';

const HL = 'data-ts-mark';

/**
 * One drawing sheet with the wire / terminal of the current step marked (yellow box, red outline), zoomed to
 * the marks; tap to see the whole sheet. Marks are matched on the texts drawn on the sheet (wire numbers,
 * terminal numbers, device tags), so they work on every sheet kind.
 */
export default function SheetThumb({ plan, sheetNo, marks, className = '' }: { plan: DrawingPlan; sheetNo: string; marks: string[]; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [whole, setWhole] = useState(false);
  const [found, setFound] = useState(0);
  const sheet = plan.sheets.find((s) => s.drawingNo === sheetNo);
  const key = marks.join('|');

  useLayoutEffect(() => {
    const svg = ref.current?.querySelector('svg');
    if (!svg) return;
    // Marks in order of importance (wire, terminal, tag): the zoom centres on the first mark found and keeps
    // only the hits near it, so a terminal number printed all over the sheet does not zoom out to all of it.
    const want = marks.map((m) => m.trim().toUpperCase()).filter(Boolean);
    const [, , vw0] = (svg.getAttribute('viewBox') ?? '0 0 432 279').split(/\s+/).map(Number);
    const found: { b: DOMRect; t: SVGGraphicsElement; rank: number }[] = [];
    for (const t of svg.querySelectorAll('text')) {
      const rank = want.indexOf((t.textContent ?? '').trim().toUpperCase());
      if (rank < 0) continue;
      let b: DOMRect;
      try { b = t.getBBox(); } catch { continue; }
      if (b.width) found.push({ b, t, rank });
    }
    const anchor = [...found].sort((x, y) => x.rank - y.rank)[0];
    const near = (b: DOMRect) => !anchor || Math.hypot(b.x - anchor.b.x, b.y - anchor.b.y) < vw0 / 4;
    const added: Element[] = [];
    let box: { x1: number; y1: number; x2: number; y2: number } | null = null;
    for (const { b, t } of found) {
      if (!near(b)) continue;
      const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const pad = Math.max(0.6, b.height * 0.2);
      r.setAttribute('x', String(b.x - pad)); r.setAttribute('y', String(b.y - pad));
      r.setAttribute('width', String(b.width + 2 * pad)); r.setAttribute('height', String(b.height + 2 * pad));
      r.setAttribute('fill', '#fde047'); r.setAttribute('fill-opacity', '0.55'); r.setAttribute('stroke', '#dc2626'); r.setAttribute('stroke-width', '0.5');
      r.setAttribute(HL, '');
      t.parentNode?.insertBefore(r, t);
      added.push(r);
      box = box ? { x1: Math.min(box.x1, b.x), y1: Math.min(box.y1, b.y), x2: Math.max(box.x2, b.x + b.width), y2: Math.max(box.y2, b.y + b.height) } : { x1: b.x, y1: b.y, x2: b.x + b.width, y2: b.y + b.height };
    }
    setFound(added.length);
    const original = svg.getAttribute('viewBox');
    if (box && !whole) {
      // Zoom to the marks with some room around them (at least a fifth of the sheet).
      const [, , vw, vh] = (original ?? '0 0 432 279').split(/\s+/).map(Number);
      const w = Math.max(box.x2 - box.x1 + 40, vw / 5), h = Math.max(box.y2 - box.y1 + 30, vh / 5);
      const cx = (box.x1 + box.x2) / 2, cy = (box.y1 + box.y2) / 2;
      svg.setAttribute('viewBox', `${cx - w / 2} ${cy - h / 2} ${w} ${h}`);
    }
    return () => {
      for (const a of added) a.remove();
      if (original) svg.setAttribute('viewBox', original);
    };
    // marks are compared by value (key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, whole, sheetNo]);

  if (!sheet) return null;
  return (
    <figure className={`rounded border border-steel-300 bg-white ${className}`}>
      <button type="button" onClick={() => setWhole((v) => !v)} className="block w-full" aria-label={whole ? 'Zoom to the marked wire' : 'Show the whole sheet'}>
        <div ref={ref} className="pointer-events-none select-none [&_svg]:h-auto [&_svg]:w-full">
          <SheetView plan={plan} sheet={sheet} width="100%" />
        </div>
      </button>
      <figcaption className="px-2 py-1 text-[11px] text-steel-500">
        {sheet.drawingNo} · {sheet.title}{found ? '' : ' (the wire is not printed on this sheet)'} · {whole ? 'tap to zoom in' : 'tap for the whole sheet'}
      </figcaption>
    </figure>
  );
}
