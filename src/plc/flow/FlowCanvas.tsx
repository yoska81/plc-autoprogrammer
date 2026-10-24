/**
 * The flow map: every function's diagram on one canvas, zoomed with the wheel (or + / −), moved by dragging, a
 * minimap in the corner. Squares are steps and actions, diamonds the IF conditions, arrows the way the program
 * goes (moving when it goes that way now). Only what is on screen is drawn, and zoomed far out each function is
 * one box: a program of thousands of rungs stays quick.
 */
import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import type { FlowDiagram, FlowMap, FlowNode } from './flowModel';
import type { FlowState, NodeState } from './flowState';

export interface FlowCanvasHandle {
  /** Brings a node (or a whole diagram) into the middle of the view. */
  show(diagramId: string, nodeId?: string): void;
  fit(): void;
}

interface View { x: number; y: number; k: number }

const FILL: Record<NodeState | 'none', string> = { active: '#dcfce7', true: '#ecfdf5', false: '#ffffff', waiting: '#fef3c7', broken: '#fee2e2', none: '#ffffff' };
const STROKE: Record<NodeState | 'none', string> = { active: '#16a34a', true: '#34d399', false: '#cbd5e1', waiting: '#d97706', broken: '#dc2626', none: '#cbd5e1' };
/** Zoomed out further than this, each function is one box. */
const DETAIL_K = 0.32;

/** The tag above a box: what it is doing now. */
const TAG: Partial<Record<NodeState | 'none', [string, string]>> = { active: ['● NOW', '#16a34a'], waiting: ['… WAITING', '#d97706'], broken: ['✖ STUCK', '#dc2626'] };

function NodeShape({ n, st, why, selected, hit, onPick }: { n: FlowNode; st: NodeState | undefined; why?: string; selected: boolean; hit: boolean; onPick: () => void }) {
  const s = st ?? 'none';
  const sw = selected ? 3.5 : s === 'active' || s === 'broken' ? 3 : 1.5;
  const stroke = selected ? '#b45309' : STROKE[s];
  const { x, y, w, h } = n;
  const shape = n.kind === 'decision'
    // a diamond stretched to its text: pointed ends left and right
    ? <polygon points={`${x},${y + h / 2} ${x + 34},${y} ${x + w - 34},${y} ${x + w},${y + h / 2} ${x + w - 34},${y + h} ${x + 34},${y + h}`} fill={FILL[s]} stroke={stroke} strokeWidth={sw} />
    : <rect x={x} y={y} width={w} height={h} rx={n.kind === 'step' ? 12 : n.kind === 'any' ? 4 : 6} fill={FILL[s]} stroke={stroke} strokeWidth={sw} strokeDasharray={n.kind === 'any' ? '6 4' : undefined} />;
  const pad = n.kind === 'decision' ? 38 : 12;
  return (
    <g onClick={(e) => { e.stopPropagation(); onPick(); }} style={{ cursor: 'pointer' }} data-node={n.id}>
      {hit && <rect x={x - 6} y={y - 6} width={w + 12} height={h + 12} rx={10} fill="none" stroke="#f59e0b" strokeWidth={3} strokeDasharray="5 4" />}
      {shape}
      <text x={x + pad} y={y + 18} fontSize={12} fontWeight={700} fill={n.kind === 'step' ? '#14532d' : '#1e293b'}>
        {n.title}
      </text>
      {TAG[s] && (() => {
        const [text, color] = s === 'broken' && why?.startsWith('Alarm') ? ['⚠ ALARM', '#dc2626'] : TAG[s]!;
        const tw = text.length * 7 + 14;
        return (
          <g>
            <rect x={x + w - tw - 8} y={y - 11} width={tw} height={18} rx={9} fill={color} />
            <text x={x + w - tw / 2 - 8} y={y + 2} textAnchor="middle" fontSize={10.5} fontWeight={800} fill="#fff">{text}</text>
          </g>
        );
      })()}
      {n.lines.map((l, i) => (
        <text key={i} x={x + pad} y={y + 36 + i * 15} fontSize={11.5} fill={l === '— OR —' ? '#64748b' : '#334155'} fontStyle={l === '— OR —' ? 'italic' : undefined}>{l}</text>
      ))}
    </g>
  );
}

function Diagram({ d, state, selected, hits, onPick, view, vw, vh }: {
  d: FlowDiagram; state: FlowState | null; selected: string | null; hits: Set<string>; onPick: (n: FlowNode) => void; view: View; vw: number; vh: number;
}) {
  // the part of the diagram on screen (in its own coordinates), with a margin
  const left = (-view.x) / view.k - d.x - 200, top = (-view.y) / view.k - d.y - 200;
  const right = left + vw / view.k + 400, bottom = top + vh / view.k + 400;
  const onScreen = (x: number, y: number, w: number, h: number) => x < right && x + w > left && y < bottom && y + h > top;
  const nodes = d.nodes.filter((n) => onScreen(n.x, n.y, n.w, n.h));
  const edges = d.edges.filter((e) => e.points.some(([x, y]) => onScreen(x, y, 1, 1)) || onScreen(Math.min(...e.points.map((p) => p[0])), Math.min(...e.points.map((p) => p[1])), 1, Math.abs(e.points[e.points.length - 1][1] - e.points[0][1])));
  return (
    <g transform={`translate(${d.x},${d.y})`}>
      <rect x={0} y={0} width={d.w} height={d.h} rx={14} fill="#ffffff" fillOpacity={0.6} stroke="#cbd5e1" />
      <text x={16} y={28} fontSize={17} fontWeight={800} fill="#0f172a">{d.name}</text>
      <text x={16} y={48} fontSize={11} fill="#64748b">{d.rungCount} rung{d.rungCount === 1 ? '' : 's'}{d.register ? ` · step sequence (${d.register}${state?.steps.has(d.id) ? ` = ${state.steps.get(d.id)}` : ''})` : ''}{d.description ? ` · ${d.description.slice(0, 60)}` : ''}</text>
      {edges.map((e) => {
        const on = state?.edges.has(e.id);
        const pts = e.points.map((p) => p.join(',')).join(' ');
        const [lx, ly] = e.points[Math.min(1, e.points.length - 1)];
        return (
          <g key={e.id}>
            <polyline points={pts} fill="none" stroke={on ? '#16a34a' : e.back ? '#94a3b8' : '#94a3b8'} strokeWidth={on ? 3.5 : 1.6} strokeDasharray={on ? '9 6' : e.back ? '4 3' : undefined} markerEnd={`url(#${on ? 'arrOn' : 'arr'})`}>
              {on && <animate attributeName="stroke-dashoffset" from="30" to="0" dur="0.8s" repeatCount="indefinite" />}
            </polyline>
            {e.label && e.label !== 'NEXT' && <text x={lx + 4} y={ly - 4} fontSize={10} fontWeight={700} fill={on ? '#15803d' : '#64748b'}>{e.label}</text>}
          </g>
        );
      })}
      {nodes.map((n) => <NodeShape key={n.id} n={n} st={state?.nodes.get(n.id)} why={state?.why.get(n.id)} selected={selected === n.id} hit={hits.has(n.id)} onPick={() => onPick(n)} />)}
    </g>
  );
}

/** Zoomed out: a function as one box, coloured by what is in it now. */
function DiagramBox({ d, state, onPick }: { d: FlowDiagram; state: FlowState | null; onPick: () => void }) {
  const sts = d.nodes.map((n) => state?.nodes.get(n.id));
  const s: NodeState | 'none' = sts.includes('broken') ? 'broken' : sts.includes('waiting') ? 'waiting' : sts.includes('active') ? 'active' : sts.includes('true') ? 'true' : 'none';
  return (
    <g onClick={(e) => { e.stopPropagation(); onPick(); }} style={{ cursor: 'zoom-in' }} data-diagram={d.id}>
      <rect x={d.x} y={d.y} width={d.w} height={d.h} rx={30} fill={FILL[s]} stroke={STROKE[s]} strokeWidth={s === 'broken' ? 14 : 6} />
      <text x={d.x + d.w / 2} y={d.y + 120} textAnchor="middle" fontSize={64} fontWeight={800} fill="#0f172a">{d.name}</text>
      <text x={d.x + d.w / 2} y={d.y + 200} textAnchor="middle" fontSize={44} fill="#475569">{d.rungCount} rungs{d.register && state?.steps.has(d.id) ? ` · step ${state.steps.get(d.id)}` : ''}</text>
      {s === 'broken' && <text x={d.x + d.w / 2} y={d.y + 280} textAnchor="middle" fontSize={52} fontWeight={800} fill="#dc2626">✖ STUCK</text>}
    </g>
  );
}

export default forwardRef<FlowCanvasHandle, {
  map: FlowMap; state: FlowState | null; selected: string | null; hits: Set<string>; onPick: (d: FlowDiagram, n: FlowNode | null) => void;
}>(function FlowCanvas({ map, state, selected, hits, onPick }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 600 });
  const [view, setView] = useState<View>({ x: 20, y: 20, k: 0.6 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  const fitTo = useCallback((w: number, h: number) => {
    const k = Math.min(w / (map.w + 80), h / (map.h + 80), 1);
    setView({ x: (w - map.w * k) / 2, y: 20, k });
  }, [map]);
  const fit = useCallback(() => fitTo(size.w, size.h), [fitTo, size]);
  // the size of the canvas; the whole program fitted in it when it first has a size and when another program comes
  // (its functions differ): an edit of this one keeps the view where it is
  const fitted = useRef<string | null>(null);
  const programKey = map.diagrams.map((d) => d.id).join('|');
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
      setSize({ w, h });
      if (fitted.current !== programKey && w > 0) { fitted.current = programKey; fitTo(w, h); }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [programKey, fitTo]);

  useImperativeHandle(ref, () => ({
    fit,
    show(diagramId, nodeId) {
      const d = map.diagrams.find((x) => x.id === diagramId);
      if (!d) return;
      const n = nodeId ? d.nodes.find((x) => x.id === nodeId) : undefined;
      const k = n ? Math.max(view.k, 0.85) : Math.min(size.w / (d.w + 60), size.h / (Math.min(d.h, 1400) + 60), 1);
      const cx = d.x + (n ? n.x + n.w / 2 : d.w / 2), cy = d.y + (n ? n.y + n.h / 2 : Math.min(d.h, 1400) / 2);
      setView({ k, x: size.w / 2 - cx * k, y: size.h / 2 - cy * k });
    },
  }), [map, size, view.k, fit]);

  const zoomAt = (factor: number, px = size.w / 2, py = size.h / 2) => setView((v) => {
    const k = Math.min(2.5, Math.max(0.02, v.k * factor));
    return { k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k };
  });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => { e.preventDefault(); const r = el.getBoundingClientRect(); zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  });

  const detail = view.k >= DETAIL_K;
  // the minimap: the whole map in 200 px
  const mk = Math.min(150 / Math.max(map.w, 1), 90 / Math.max(map.h, 1));
  return (
    <div ref={box} className="relative h-full w-full select-none overflow-hidden bg-[radial-gradient(#dbe2ea_0.8px,transparent_0.8px)] [background-size:16px_16px]" data-testid="flow-canvas"
      onMouseDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false }; setDragging(true); }}
      onMouseMove={(e) => { const d = drag.current; if (!d) return; if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 3) d.moved = true; setView((v) => ({ ...v, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y })); }}
      onMouseUp={() => { drag.current = null; setDragging(false); }} onMouseLeave={() => { drag.current = null; setDragging(false); }}
      style={{ cursor: dragging ? 'grabbing' : 'grab' }}>
      <svg width={size.w} height={size.h} onClickCapture={(e) => { if (drag.current?.moved) e.stopPropagation(); }}>
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#94a3b8" /></marker>
          <marker id="arrOn" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#16a34a" /></marker>
        </defs>
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          {map.diagrams.map((d) => {
            const vis = d.x * view.k + view.x < size.w && (d.x + d.w) * view.k + view.x > 0 && d.y * view.k + view.y < size.h && (d.y + d.h) * view.k + view.y > 0;
            if (!vis) return null;
            return detail
              ? <Diagram key={d.id} d={d} state={state} selected={selected} hits={hits} onPick={(n) => onPick(d, n)} view={view} vw={size.w} vh={size.h} />
              : <DiagramBox key={d.id} d={d} state={state} onPick={() => onPick(d, null)} />;
          })}
        </g>
      </svg>
      <div className="absolute right-2 top-2 flex flex-col gap-1">
        {[['+', () => zoomAt(1.25)], ['−', () => zoomAt(0.8)], ['⤢', fit]].map(([t, f]) => (
          <button key={t as string} type="button" onMouseDown={(e) => e.stopPropagation()} onClick={f as () => void} title={t === '⤢' ? 'Whole program' : t === '+' ? 'Zoom in' : 'Zoom out'}
            className="h-8 w-8 rounded border border-steel-300 bg-white text-base font-bold text-steel-700 shadow hover:bg-steel-50">{t as string}</button>
        ))}
      </div>
      <svg className="absolute bottom-2 right-2 rounded border border-steel-300 bg-white/90 shadow" width={map.w * mk + 8} height={map.h * mk + 8} data-testid="flow-minimap"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { const r = (e.currentTarget as SVGElement).getBoundingClientRect(); const mx = (e.clientX - r.left - 4) / mk, my = (e.clientY - r.top - 4) / mk; setView((v) => ({ ...v, x: size.w / 2 - mx * v.k, y: size.h / 2 - my * v.k })); }}>
        <g transform={`translate(4,4) scale(${mk})`}>
          {map.diagrams.map((d) => {
            const sts = d.nodes.map((n) => state?.nodes.get(n.id));
            const s: NodeState | 'none' = sts.includes('broken') ? 'broken' : sts.includes('waiting') ? 'waiting' : sts.includes('active') ? 'active' : 'none';
            return <rect key={d.id} x={d.x} y={d.y} width={d.w} height={d.h} fill={s === 'none' ? '#e2e8f0' : FILL[s]} stroke={s === 'none' ? '#94a3b8' : STROKE[s]} strokeWidth={2 / mk} />;
          })}
          <rect x={-view.x / view.k} y={-view.y / view.k} width={size.w / view.k} height={size.h / view.k} fill="none" stroke="#2563eb" strokeWidth={2 / mk} />
        </g>
      </svg>
      <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-white/90 px-2 py-1 text-[11px] text-steel-600 shadow">
        Drag to move · wheel to zoom{detail ? '' : ' · zoomed out: click a function to open it'}
      </div>
    </div>
  );
});
