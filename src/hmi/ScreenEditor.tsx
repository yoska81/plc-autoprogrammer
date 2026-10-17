import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import HmiScreenView from './HmiScreenView';
import { elementsInRect, GRID, moveElements, resizeElement, type Bounds, type Handle } from './editor';
import type { HmiDesign, HmiElement, HmiScreen } from './types';
import { lookOf } from './theme';

const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const CURSOR: Record<Handle, string> = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' };

type Drag =
  | { kind: 'move'; x: number; y: number; ids: string[] }
  | { kind: 'resize'; x: number; y: number; id: string; handle: Handle; start: HmiElement }
  | { kind: 'marquee'; x: number; y: number; x2: number; y2: number; add: boolean };

export interface ScreenEditorProps {
  screen: HmiScreen;
  design: HmiDesign;
  widthPx: number;
  heightPx: number;
  selected: string[];
  onSelect: (ids: string[]) => void;
  /** A finished change (one undo step). */
  onChange: (screen: HmiScreen) => void;
  snapToGrid: boolean;
  /** Keyboard actions the editor doesn't handle itself. */
  onKey?: (action: 'delete' | 'duplicate' | 'undo' | 'redo') => void;
  /** Proposed elements (AI recreate), drawn dashed on top until accepted. */
  proposal?: HmiElement[] | null;
}

/**
 * The HMI screen with an editing layer on top: click to select (Shift adds),
 * drag to move, handles to resize, drag on empty space to select an area,
 * arrows nudge (Shift = one grid step). Positions snap to the 8 px grid.
 */
export default function ScreenEditor({ screen, design, widthPx, heightPx, selected, onSelect, onChange, snapToGrid, onKey, proposal }: ScreenEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [draft, setDraft] = useState<HmiScreen | null>(null);
  const bounds: Bounds = { w: widthPx, h: heightPx };
  const grid = snapToGrid ? GRID : 1;
  const shown = draft ?? screen;
  // Faint outlines of every element: dark on the light Siemens screen, white on the dark console.
  const light = lookOf(design) === 'siemens';

  const toPanel = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * widthPx, y: ((e.clientY - r.top) / r.height) * heightPx };
  };

  const startMove = (e: PointerEvent, el: HmiElement) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    let ids = selected;
    if (e.shiftKey) {
      ids = selected.includes(el.id) ? selected.filter((i) => i !== el.id) : [...selected, el.id];
      onSelect(ids);
      if (!ids.includes(el.id)) return;
    } else if (!selected.includes(el.id)) {
      ids = [el.id];
      onSelect(ids);
    }
    const p = toPanel(e);
    setDrag({ kind: 'move', x: p.x, y: p.y, ids });
  };
  const startResize = (e: PointerEvent, el: HmiElement, handle: Handle) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const p = toPanel(e);
    setDrag({ kind: 'resize', x: p.x, y: p.y, id: el.id, handle, start: el });
  };
  const startMarquee = (e: PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const p = toPanel(e);
    if (!e.shiftKey) onSelect([]);
    setDrag({ kind: 'marquee', x: p.x, y: p.y, x2: p.x, y2: p.y, add: e.shiftKey });
  };
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    const p = toPanel(e);
    if (drag.kind === 'move') setDraft(moveElements(screen, drag.ids, p.x - drag.x, p.y - drag.y, bounds, grid));
    else if (drag.kind === 'resize') {
      const next = resizeElement(drag.start, drag.handle, p.x - drag.x, p.y - drag.y, bounds, grid, e.shiftKey);
      setDraft({ ...screen, elements: screen.elements.map((x) => (x.id === drag.id ? next : x)) });
    } else setDrag({ ...drag, x2: p.x, y2: p.y });
  };
  const onUp = () => {
    if (drag?.kind === 'marquee') {
      const ids = elementsInRect(screen, drag.x, drag.y, drag.x2, drag.y2);
      if (Math.abs(drag.x2 - drag.x) > 3 || Math.abs(drag.y2 - drag.y) > 3) onSelect(drag.add ? [...new Set([...selected, ...ids])] : ids);
    } else if (draft) onChange(draft);
    setDrag(null);
    setDraft(null);
  };

  // Undo / redo work while the editor is open, wherever the focus is, except in a text field
  // (which keeps its own typing undo).
  const onKeyRef = useRef(onKey);
  useEffect(() => { onKeyRef.current = onKey; });
  useEffect(() => {
    const onWindowKey = (e: globalThis.KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const k = e.key.toLowerCase();
      const action = k === 'z' && !e.shiftKey ? 'undo' : k === 'y' || (k === 'z' && e.shiftKey) ? 'redo' : null;
      if (!action) return;
      e.preventDefault();
      onKeyRef.current?.(action);
    };
    window.addEventListener('keydown', onWindowKey);
    return () => window.removeEventListener('keydown', onWindowKey);
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey;
    const step = e.shiftKey ? GRID : 1;
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (arrows[e.key] && selected.length) {
      e.preventDefault();
      onChange(moveElements(screen, selected, arrows[e.key][0], arrows[e.key][1], bounds, 1));
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected.length) { e.preventDefault(); onKey?.('delete'); }
    else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); onKey?.('duplicate'); }
    else if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); onSelect(screen.elements.map((x) => x.id)); }
    else if (e.key === 'Escape') onSelect([]);
  };

  const sel = shown.elements.filter((el) => selected.includes(el.id));
  const hs = Math.max(6, Math.round(widthPx / 110)); // handle size in panel px
  return (
    <div className="relative outline-none focus-visible:ring-2 focus-visible:ring-brand-500" tabIndex={0} onKeyDown={onKeyDown} data-testid="hmi-editor"
      aria-label="Screen editor: drag to move, handles to resize, arrows to nudge, Delete to remove">
      <HmiScreenView screen={shown} widthPx={widthPx} heightPx={heightPx} design={design} />
      <svg ref={svgRef} viewBox={`0 0 ${widthPx} ${heightPx}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full touch-none"
        onPointerDown={startMarquee} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} data-testid="hmi-editor-layer">
        {snapToGrid && (
          <>
            <defs>
              <pattern id="hmi-grid" width={GRID * 4} height={GRID * 4} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID * 4} 0 L 0 0 0 ${GRID * 4}`} fill="none" stroke="#3b8bff" strokeOpacity={0.12} strokeWidth={1} />
              </pattern>
            </defs>
            <rect width={widthPx} height={heightPx} fill="url(#hmi-grid)" style={{ pointerEvents: 'none' }} />
          </>
        )}
        {shown.elements.map((el) => (
          <rect key={el.id} x={el.x} y={el.y} width={el.w} height={el.h} fill="transparent" data-element={el.id}
            stroke={selected.includes(el.id) ? 'none' : light ? '#1d2327' : '#ffffff'} strokeOpacity={light ? 0.22 : 0.12} strokeDasharray="4 4"
            style={{ cursor: 'move' }} onPointerDown={(e) => startMove(e, el)}>
            <title>{el.label || el.kind}{el.address ? ` · ${el.address}` : ''}</title>
          </rect>
        ))}
        {/* Selected elements get their grab area on top, so a picture (or anything) under other elements can still be dragged. */}
        {sel.map((el) => (
          <rect key={`g-${el.id}`} x={el.x} y={el.y} width={el.w} height={el.h} fill="transparent" data-selected-element={el.id}
            style={{ cursor: 'move' }} onPointerDown={(e) => startMove(e, el)} />
        ))}
        {sel.map((el) => (
          <rect key={`s-${el.id}`} x={el.x - 2} y={el.y - 2} width={el.w + 4} height={el.h + 4} fill="none" stroke="#3b8bff" strokeWidth={2} style={{ pointerEvents: 'none' }} />
        ))}
        {sel.length === 1 && HANDLES.map((h) => {
          const el = sel[0];
          const cx = h.includes('w') ? el.x : h.includes('e') ? el.x + el.w : el.x + el.w / 2;
          const cy = h.includes('n') ? el.y : h.includes('s') ? el.y + el.h : el.y + el.h / 2;
          return (
            <rect key={h} x={cx - hs / 2} y={cy - hs / 2} width={hs} height={hs} fill="#3b8bff" stroke="#15170a" strokeWidth={1}
              style={{ cursor: CURSOR[h] }} data-handle={h} onPointerDown={(e) => startResize(e, el, h)} />
          );
        })}
        {sel.length === 1 && (
          <text x={sel[0].x} y={Math.max(12, sel[0].y - 6)} fill="#3b8bff" fontSize={11} fontFamily="ui-monospace, monospace" style={{ pointerEvents: 'none' }}>
            {sel[0].x},{sel[0].y} · {sel[0].w}×{sel[0].h}
          </text>
        )}
        {(proposal ?? []).map((el) => (
          <g key={`p-${el.id}`} style={{ pointerEvents: 'none' }}>
            <rect x={el.x} y={el.y} width={el.w} height={el.h} fill="#3b8bff" fillOpacity={0.12} stroke="#3b8bff" strokeWidth={2} strokeDasharray="6 4" />
            <text x={el.x + 4} y={el.y + 13} fill="#3b8bff" fontSize={11} fontFamily="ui-sans-serif, sans-serif">{el.label || el.kind}</text>
          </g>
        ))}
        {drag?.kind === 'marquee' && (
          <rect x={Math.min(drag.x, drag.x2)} y={Math.min(drag.y, drag.y2)} width={Math.abs(drag.x2 - drag.x)} height={Math.abs(drag.y2 - drag.y)}
            fill="#3b8bff" fillOpacity={0.08} stroke="#3b8bff" strokeDasharray="4 3" style={{ pointerEvents: 'none' }} />
        )}
      </svg>
    </div>
  );
}
