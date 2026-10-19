import { useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { loadPdfjs } from '../../lib/pdfjs';
import { nativeModel, type DrawingContext } from '../derive';
import { useElectricalStore } from '../../store/useElectricalStore';
import { useProjectsStore } from '../../store/useProjectsStore';
import { TO_M, unitsPerMeter, type Pt } from './geometry';
import { cableTotals, suggest, type Suggestion } from './suggest';
import { useLayoutStore } from './useLayoutStore';
import { AIR, CABINET, EMPTY_LAYOUT, type LayoutItemKind, type LayoutRoute, type LengthUnit, type MachineLayout, type RouteKind } from './types';
import { useDraft } from '../../store/useDraftStore';
import { useUi } from '../../store/useUiStore';

const th = 'text-left font-medium text-steel-500 px-2 py-1 border-b border-steel-200 bg-steel-50 whitespace-nowrap';
const td = 'px-2 py-1 border-b border-steel-100 whitespace-nowrap';
const btn = 'px-2.5 py-1 text-xs border border-steel-300 rounded hover:bg-steel-50 disabled:opacity-50';
const inp = 'border border-steel-300 rounded px-1.5 py-0.5 text-xs w-16';

/** Largest side of a stored background picture (px): keeps the saved project small. */
const MAX_PX = 1600;

type Tool = 'select' | 'scale' | 'route';
type Target = { type: 'item'; id: string } | { type: 'manifold'; tag: string } | { type: 'rio'; tag: string };

const KIND_STYLE: Record<LayoutItemKind, { fill: string; label: string }> = {
  cabinet: { fill: '#1d2327', label: 'Cabinet' },
  jb: { fill: '#8a6d00', label: 'Junction box' },
  device: { fill: '#2563eb', label: 'Device' },
  motor: { fill: '#b45309', label: 'Motor' },
  air: { fill: '#0e7490', label: 'Air supply' },
  manifold: { fill: '#7c3aed', label: 'Manifold' },
  remoteio: { fill: '#15803d', label: 'Remote I/O' },
};
const ROUTE_STYLE: Record<RouteKind, { stroke: string; dash?: string; label: string }> = {
  tray: { stroke: '#64748b', label: 'Cable tray' },
  conduit: { stroke: '#0f766e', dash: '10 6', label: 'Conduit' },
  chain: { stroke: '#c2410c', dash: '3 4', label: 'Drag chain' },
};

const keyOf = (t: Target) => (t.type === 'item' ? `i:${t.id}` : `${t.type}:${t.tag}`);
const uid = () => Math.random().toString(36).slice(2, 9);

/** Picture or first page of a PDF, downscaled to MAX_PX, as a JPEG data URL. */
async function readBackground(file: File, page: number): Promise<{ dataUrl: string; w: number; h: number }> {
  const canvas = document.createElement('canvas');
  if (/pdf$/i.test(file.type) || /\.pdf$/i.test(file.name)) {
    const pdfjs = await loadPdfjs();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pg = await doc.getPage(Math.min(Math.max(1, page), doc.numPages));
    const v1 = pg.getViewport({ scale: 1 });
    const vp = pg.getViewport({ scale: MAX_PX / Math.max(v1.width, v1.height) });
    canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
    const g = canvas.getContext('2d')!;
    g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
    await pg.render({ canvas, canvasContext: g, viewport: vp }).promise;
  } else {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('Not a picture')); i.src = url; });
      const k = Math.min(1, MAX_PX / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.round(img.naturalWidth * k); canvas.height = Math.round(img.naturalHeight * k);
      const g = canvas.getContext('2d')!;
      g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
      g.drawImage(img, 0, 0, canvas.width, canvas.height);
    } finally { URL.revokeObjectURL(url); }
  }
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.8), w: canvas.width, h: canvas.height };
}

/**
 * Machine layout: plan view with the cabinet, junction boxes and field devices placed on it and the
 * cable routes drawn. Cable lengths in the cable schedule come from here; suggestions (manifolds,
 * junction boxes, remote I/O, tray size, cabinet location) can be accepted or ignored.
 */
export default function MachineLayoutPanel({ ctx }: { ctx: DrawingContext | null }) {
  const projectId = useProjectsStore((s) => s.activeId);
  const stored = useLayoutStore((s) => (projectId ? s.byProject[projectId] : undefined));
  const L = stored ?? EMPTY_LAYOUT;
  const update = (fn: (l: MachineLayout) => MachineLayout) => {
    let id = useProjectsStore.getState().activeId;
    if (!id) { useProjectsStore.getState().ensureActive(); id = useProjectsStore.getState().activeId; }
    if (id) useLayoutStore.getState().update(id, fn);
  };
  const el = useElectricalStore();

  const [tool, setTool] = useUi<Tool>('layout.tool', 'select');
  const [routeKind, setRouteKind] = useUi<RouteKind>('layout.routeKind', 'tray');
  const [draft, setDraft] = useDraft<Pt[]>('layout.routeDraft', []);
  const [scalePts, setScalePts] = useDraft<Pt[]>('layout.scalePts', []);
  const [scaleValue, setScaleValue] = useDraft('layout.scaleValue', '');
  const [scaleUnit, setScaleUnit] = useDraft<LengthUnit>('layout.scaleUnit', 'in');
  const [placing, setPlacing] = useState<string | null>(null);
  const [selected, setSelected] = useState<Target | { type: 'route'; id: string } | null>(null);
  const [grid, setGrid] = useUi('layout.grid', true);
  const [pdfPage, setPdfPage] = useUi('layout.pdfPage', 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDecided, setShowDecided] = useUi('layout.showDecided', false);
  const [hover, setHover] = useState<Pt | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Target | null>(null);
  // position while dragging; saved to the layout when the pointer is released
  const [dragAt, setDragAt] = useState<{ key: string; p: Pt } | null>(null);

  const model = useMemo(() => (ctx ? nativeModel(ctx) : null), [ctx]);
  const k = L.scale?.unitsPerMeter ?? 0; // canvas units per metre
  const toM = (u: number) => (k ? u / k : 0);
  const fmtLen = (m: number) => (L.display === 'ft' ? `${(m / 0.3048).toFixed(1)} ft` : `${m.toFixed(1)} m`);

  // what can be placed: cabinet, air supply, junction boxes, field devices and motors of the design
  const palette = useMemo(() => {
    const out: { tag: string; kind: LayoutItemKind; label: string }[] = [
      { tag: CABINET, kind: 'cabinet', label: 'Electrical cabinet' },
      { tag: AIR, kind: 'air', label: 'Air supply / FRL' },
    ];
    if (model) {
      for (const j of model.machine.jbs) out.push({ tag: j.tag, kind: 'jb', label: `Junction box · ${j.zone}` });
      for (const d of model.machine.devices) out.push({ tag: d.tag, kind: d.kind === 'motor' ? 'motor' : 'device', label: d.description });
    }
    return out;
  }, [model]);
  const placed = new Set(L.items.map((i) => i.tag));

  const point = (e: { clientX: number; clientY: number }): Pt => {
    const svg = svgRef.current!;
    const m = svg.getScreenCTM();
    if (!m) return [0, 0];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10];
  };

  const place = (tag: string, at: Pt) => {
    const p = palette.find((x) => x.tag === tag);
    if (!p) return;
    update((l) => ({ ...l, items: [...l.items.filter((i) => i.tag !== tag), { id: uid(), tag, kind: p.kind, x: at[0], y: at[1] }] }));
  };

  const onCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const p = point(e);
    if (tool === 'scale') {
      const pts = scalePts.length >= 2 ? [p] : [...scalePts, p];
      setScalePts(pts);
      return;
    }
    if (tool === 'route') { setDraft((d) => [...d, p]); return; }
    if (placing) {
      place(placing, p);
      // next unplaced device of the palette, for quick placing
      const next = palette.find((x) => x.tag !== placing && !placed.has(x.tag));
      setPlacing(next && e.shiftKey ? next.tag : null);
      return;
    }
    setSelected(null);
  };

  const finishRoute = () => {
    if (draft.length >= 2) {
      const r: LayoutRoute = { id: uid(), kind: routeKind, points: draft };
      update((l) => ({ ...l, routes: [...l.routes, r] }));
    }
    setDraft([]);
  };

  const applyScale = () => {
    const v = parseFloat(scaleValue);
    if (scalePts.length !== 2 || !(v > 0)) return;
    const upm = unitsPerMeter(scalePts[0], scalePts[1], v, scaleUnit);
    if (!(upm > 0)) return;
    update((l) => ({ ...l, scale: { unitsPerMeter: upm, a: scalePts[0], b: scalePts[1], value: v, unit: scaleUnit } }));
    setScalePts([]);
    setTool('select');
  };

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const bg = await readBackground(file, pdfPage);
      const ratio = L.background ? bg.w / L.background.w : L.canvas.w ? bg.w / L.canvas.w : 1;
      // keep placed items where they were on the old picture (same proportions assumed)
      update((l) => ({
        ...l,
        background: { ...bg, name: file.name },
        canvas: { w: bg.w, h: bg.h },
        scale: l.scale ? { ...l.scale, unitsPerMeter: l.scale.unitsPerMeter * ratio, a: [l.scale.a[0] * ratio, l.scale.a[1] * ratio], b: [l.scale.b[0] * ratio, l.scale.b[1] * ratio] } : undefined,
        items: l.items.map((i) => ({ ...i, x: i.x * ratio, y: i.y * ratio })),
        routes: l.routes.map((r) => ({ ...r, points: r.points.map(([x, y]) => [x * ratio, y * ratio] as Pt) })),
        manifolds: l.manifolds.map((m) => ({ ...m, x: m.x * ratio, y: m.y * ratio })),
        remoteIo: l.remoteIo.map((m) => ({ ...m, x: m.x * ratio, y: m.y * ratio })),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  };

  // dragging placed things
  const startDrag = (t: Target) => (e: RPointerEvent) => {
    if (tool !== 'select') return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = t;
    setSelected(t);
  };
  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    const p = point(e);
    if (tool !== 'select' || placing) setHover(p);
    if (drag.current) setDragAt({ key: keyOf(drag.current), p });
  };
  const endDrag = () => {
    const t = drag.current, d = dragAt;
    drag.current = null;
    setDragAt(null);
    if (!t || !d) return;
    const [x, y] = d.p;
    update((l) => t.type === 'item' ? { ...l, items: l.items.map((i) => (i.id === t.id ? { ...i, x, y } : i)) }
      : t.type === 'manifold' ? { ...l, manifolds: l.manifolds.map((m) => (m.tag === t.tag ? { ...m, x, y } : m)) }
      : { ...l, remoteIo: l.remoteIo.map((m) => (m.tag === t.tag ? { ...m, x, y } : m)) });
  };
  /** Position of a placed thing, following the pointer while it is dragged. */
  const at = <T extends { x: number; y: number }>(t: Target, o: T): T => (dragAt && dragAt.key === keyOf(t) ? { ...o, x: dragAt.p[0], y: dragAt.p[1] } : o);

  const removeSelected = () => {
    const s = selected;
    if (!s) return;
    update((l) => s.type === 'item' ? { ...l, items: l.items.filter((i) => i.id !== s.id) }
      : s.type === 'route' ? { ...l, routes: l.routes.filter((r) => r.id !== s.id) }
      : s.type === 'manifold' ? { ...l, manifolds: l.manifolds.filter((m) => m.tag !== s.tag), decisions: Object.fromEntries(Object.entries(l.decisions).filter(([id]) => id !== `manifold:${l.manifolds.find((m) => m.tag === s.tag)?.valves.join('+')}`)) }
      : { ...l, remoteIo: l.remoteIo.filter((m) => m.tag !== s.tag) });
    setSelected(null);
  };

  // --- suggestions
  const suggestions = useMemo(() => (ctx?.machineLayout && model ? suggest(ctx.machineLayout, model.machine.devices, model.machine.cables, { manifoldRadiusM: L.manifoldRadiusM }) : []), [ctx, model, L.manifoldRadiusM]);
  const open = suggestions.filter((s) => !L.decisions[s.id]);
  const decided = suggestions.filter((s) => L.decisions[s.id]);

  const decide = (s: Suggestion, d: 'accepted' | 'ignored') => {
    if (d === 'accepted' && (s.jbSplit || s.jbMerge)) {
      if (!model || !el.design) return;
      const w = model.machine.wiring;
      let machine = w;
      let text = '';
      if (s.jbSplit) {
        const { jb, newJb, devices } = s.jbSplit;
        const zone = w.junctionBoxes.find((j) => j.tag === jb)?.location ?? w.zones[0] ?? 'Machine';
        machine = { ...w, junctionBoxes: [...w.junctionBoxes, { tag: newJb, location: zone }], routing: { ...w.routing, ...Object.fromEntries(devices.map((t) => [t, newJb])) } };
        text = `Add junction box ${newJb} (${zone}) and move ${devices.join(', ')} from ${jb} to ${newJb}.`;
      } else if (s.jbMerge) {
        const { from, into } = s.jbMerge;
        machine = { ...w, junctionBoxes: w.junctionBoxes.filter((j) => j.tag !== from), routing: Object.fromEntries(Object.entries(w.routing).map(([t, j]) => [t, j === from ? into : j])) };
        text = `Remove junction box ${from} and connect its devices to ${into}.`;
      }
      if (!confirm(`Change the electrical design?\n\n${text}\n\nThe cable schedule, terminal plans and drawings are regenerated. Review them before building.`)) return;
      el.setDesign({ ...el.design, machine, notes: [...el.design.notes, `Machine layout: ${text}`] }, el.source ?? 'generated', el.explanation);
      if (s.jbSplit && k) { const sp = s.jbSplit; update((l) => ({ ...l, items: [...l.items, { id: uid(), tag: sp.newJb, kind: 'jb', x: sp.at[0] * k, y: sp.at[1] * k }] })); }
      if (s.jbMerge) { const from = s.jbMerge.from; update((l) => ({ ...l, items: l.items.filter((i) => i.tag !== from) })); }
    }
    update((l) => {
      let n: MachineLayout = { ...l, decisions: { ...l.decisions, [s.id]: d } };
      if (d !== 'accepted' || !k) return n;
      const at = (p: Pt) => ({ x: p[0] * k, y: p[1] * k });
      if (s.manifold) n = { ...n, manifolds: [...n.manifolds, { tag: s.manifold.tag, valves: s.manifold.valves, ...at(s.manifold.at) }] };
      if (s.remoteIo) n = { ...n, remoteIo: [...n.remoteIo, { tag: s.remoteIo.tag, devices: s.remoteIo.devices, ...at(s.remoteIo.at) }] };
      if (s.jbMove) {
        const { jb, to } = s.jbMove;
        n = { ...n, items: n.items.some((i) => i.tag === jb) ? n.items.map((i) => (i.tag === jb ? { ...i, ...at(to) } : i)) : [...n.items, { id: uid(), tag: jb, kind: 'jb', ...at(to) }] };
      }
      if (s.cabinet) { const to = s.cabinet.to; n = { ...n, items: n.items.map((i) => (i.tag === CABINET ? { ...i, ...at(to) } : i)) }; }
      return n;
    });
  };
  const undecide = (id: string) => update((l) => { const d = { ...l.decisions }; delete d[id]; return { ...l, decisions: d }; });

  const cables = useMemo(() => model?.machine.cables ?? [], [model]);
  const totals = useMemo(() => cableTotals(cables), [cables]);

  // grid: 1 m (or 1 ft) when scaled, else 50 units
  const gridStep = k ? (L.display === 'ft' ? 0.3048 : 1) * k : 50;
  const gridLines = useMemo(() => {
    if (!grid || gridStep <= 0) return null;
    const step = gridStep * Math.max(1, Math.ceil(10 / gridStep)); // at least 10 units apart
    const xs: number[] = [], ys: number[] = [];
    for (let x = 0; x <= L.canvas.w; x += step) xs.push(x);
    for (let y = 0; y <= L.canvas.h; y += step) ys.push(y);
    return { xs, ys, step };
  }, [grid, gridStep, L.canvas.w, L.canvas.h]);

  const r = Math.max(6, Math.min(L.canvas.w, L.canvas.h) / 60);
  const fs = r * 1.6;
  const scaleText = L.scale ? `${L.scale.value} ${L.scale.unit} = ${Math.hypot(L.scale.b[0] - L.scale.a[0], L.scale.b[1] - L.scale.a[1]).toFixed(0)} units` : 'not set';
  const sizeText = k ? `${fmtLen(toM(L.canvas.w))} × ${fmtLen(toM(L.canvas.h))}` : '';

  if (!ctx) return <div className="flex-1 flex items-center justify-center text-sm text-steel-500">No design yet. Fill in the Design tab and click Generate.</div>;

  return (
    <div className="flex-1 overflow-y-auto md:overflow-hidden flex flex-col md:flex-row bg-steel-50" data-testid="machine-layout">
      {/* left: placing (on a phone the three columns stack) */}
      <aside className="w-full md:w-60 shrink-0 border-b md:border-b-0 md:border-r border-steel-200 bg-white overflow-auto p-3 text-xs space-y-3">
        <div>
          <div className="font-semibold text-steel-700 mb-1">Layout picture</div>
          <label className={`${btn} inline-block cursor-pointer`}>
            {busy ? 'Reading…' : 'Upload picture / PDF'}
            <input type="file" accept="image/*,application/pdf,.pdf" className="hidden" aria-label="Upload layout" onChange={(e) => { void onUpload(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          <div className="mt-1 flex items-center gap-1 text-steel-500">PDF page <input type="number" min={1} value={pdfPage} onChange={(e) => setPdfPage(Number(e.target.value) || 1)} className={inp} /></div>
          {L.background && <div className="mt-1 text-steel-500 truncate" title={L.background.name}>{L.background.name} <button className="text-red-700 underline" onClick={() => update((l) => ({ ...l, background: undefined }))}>remove</button></div>}
          {!L.background && <div className="mt-1 text-steel-400">Or work on the blank sheet (plan view).</div>}
          {error && <div className="mt-1 text-red-700">{error}</div>}
        </div>
        <div>
          <div className="font-semibold text-steel-700 mb-1">Scale</div>
          <div className="text-steel-500" data-testid="layout-scale">{scaleText}{sizeText && <> · sheet {sizeText}</>}</div>
          <button className={`${btn} mt-1 ${tool === 'scale' ? 'bg-brand-100 border-brand-500' : ''}`} onClick={() => { setTool('scale'); setScalePts([]); setPlacing(null); }}>Set scale</button>
          {tool === 'scale' && (
            <div className="mt-1 space-y-1 bg-brand-50 border border-brand-200 rounded p-2">
              <div>{scalePts.length < 2 ? `Click two points on the layout a known distance apart (${scalePts.length}/2).` : 'Type the real distance between the two points:'}</div>
              <div className="flex items-center gap-1">
                <input aria-label="Scale distance" value={scaleValue} onChange={(e) => setScaleValue(e.target.value)} className={inp} placeholder="e.g. 120" />
                <select aria-label="Scale unit" value={scaleUnit} onChange={(e) => setScaleUnit(e.target.value as LengthUnit)} className="border border-steel-300 rounded text-xs py-0.5">
                  {(['in', 'mm', 'ft', 'm'] as LengthUnit[]).map((u) => <option key={u}>{u}</option>)}
                </select>
                <button className={btn} disabled={scalePts.length !== 2 || !(parseFloat(scaleValue) > 0)} onClick={applyScale}>Apply</button>
              </div>
              {scalePts.length === 2 && parseFloat(scaleValue) > 0 && <div className="text-steel-500">= {(parseFloat(scaleValue) * TO_M[scaleUnit]).toFixed(3)} m</div>}
            </div>
          )}
        </div>
        <div>
          <div className="font-semibold text-steel-700 mb-1">Place on the layout</div>
          <p className="text-steel-400 mb-1">Pick an item, then click the layout (or drag it onto the layout). Drag placed items to move them.</p>
          <ul className="space-y-0.5" data-testid="layout-palette">
            {palette.map((p) => (
              <li key={p.tag}>
                <button draggable onDragStart={(e) => e.dataTransfer.setData('text/x-layout-tag', p.tag)}
                  onClick={() => { setPlacing(placing === p.tag ? null : p.tag); setTool('select'); }}
                  className={`w-full text-left px-1.5 py-0.5 rounded flex items-center gap-1.5 ${placing === p.tag ? 'bg-brand-100 ring-1 ring-brand-500' : 'hover:bg-steel-50'}`} title={p.label}>
                  <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: KIND_STYLE[p.kind].fill, opacity: placed.has(p.tag) ? 1 : 0.35 }} />
                  <span className="font-mono">{p.tag === CABINET ? 'Cabinet' : p.tag === AIR ? 'Air' : p.tag}</span>
                  <span className="text-steel-400 truncate">{placed.has(p.tag) ? '✓' : p.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="font-semibold text-steel-700 mb-1">Cable routes</div>
          <div className="flex items-center gap-1">
            <select aria-label="Route type" value={routeKind} onChange={(e) => setRouteKind(e.target.value as RouteKind)} className="border border-steel-300 rounded text-xs py-0.5">
              {(Object.keys(ROUTE_STYLE) as RouteKind[]).map((x) => <option key={x} value={x}>{ROUTE_STYLE[x].label}</option>)}
            </select>
            <button className={`${btn} ${tool === 'route' ? 'bg-brand-100 border-brand-500' : ''}`} onClick={() => { setTool('route'); setDraft([]); setPlacing(null); }}>Draw route</button>
          </div>
          {tool === 'route' && (
            <div className="mt-1 bg-brand-50 border border-brand-200 rounded p-2 space-y-1">
              <div>Click the corners of the route; double-click or Finish to end it ({draft.length} points).</div>
              <div className="flex gap-1"><button className={btn} disabled={draft.length < 2} onClick={finishRoute}>Finish route</button><button className={btn} onClick={() => { setDraft([]); setTool('select'); }}>Done</button></div>
            </div>
          )}
          <div className="text-steel-500 mt-1">{L.routes.length} route{L.routes.length !== 1 && 's'} drawn. Cables follow the routes; routes that cross or touch are connected.</div>
        </div>
        <div>
          <div className="font-semibold text-steel-700 mb-1">Allowances</div>
          <label className="flex items-center justify-between gap-1">Routing slack % <input aria-label="Slack percent" type="number" min={0} value={L.service.pct} onChange={(e) => update((l) => ({ ...l, service: { ...l.service, pct: Math.max(0, Number(e.target.value) || 0) } }))} className={inp} /></label>
          <label className="flex items-center justify-between gap-1 mt-1">Service loop each end (m) <input aria-label="Service loop" type="number" min={0} step={0.1} value={L.service.endM} onChange={(e) => update((l) => ({ ...l, service: { ...l.service, endM: Math.max(0, Number(e.target.value) || 0) } }))} className={inp} /></label>
          <label className="flex items-center justify-between gap-1 mt-1">Manifold radius (m) <input aria-label="Manifold radius" type="number" min={0.1} step={0.1} value={L.manifoldRadiusM} onChange={(e) => update((l) => ({ ...l, manifoldRadiusM: Math.max(0.1, Number(e.target.value) || 2) }))} className={inp} /></label>
          <label className="flex items-center justify-between gap-1 mt-1">Show lengths in
            <select value={L.display} onChange={(e) => update((l) => ({ ...l, display: e.target.value as 'm' | 'ft' }))} className="border border-steel-300 rounded text-xs py-0.5"><option value="m">m</option><option value="ft">ft</option></select>
          </label>
          <label className="flex items-center gap-1 mt-1"><input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} /> Grid ({k ? (L.display === 'ft' ? '1 ft' : '1 m') : 'not to scale'})</label>
        </div>
        <div className="flex gap-1 flex-wrap">
          <button className={btn} disabled={!selected} onClick={removeSelected}>Delete selected</button>
          <button className={btn} onClick={() => { if (confirm('Clear the machine layout (picture, items and routes)?')) { update(() => EMPTY_LAYOUT); setSelected(null); } }}>Clear layout</button>
        </div>
      </aside>

      {/* canvas */}
      {/* The drawing pans both ways (it is wider than a phone). */}
      <div className="flex-1 overflow-auto p-3 min-h-[60vh] md:min-h-0" data-scroll-x="">
        {!L.scale && <div className="mb-2 text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded px-3 py-1.5">Set the scale first (two points and the real distance) — cable lengths are calculated only on a scaled layout.</div>}
        <svg ref={svgRef} viewBox={`0 0 ${L.canvas.w} ${L.canvas.h}`} className={`w-full bg-white border border-steel-300 select-none ${tool !== 'select' || placing ? 'cursor-crosshair' : ''}`}
          style={{ aspectRatio: `${L.canvas.w} / ${L.canvas.h}`, maxHeight: '78vh' }} data-testid="layout-canvas" role="img" aria-label="Machine layout"
          onClick={onCanvasClick} onDoubleClick={() => { if (tool === 'route') finishRoute(); }}
          onPointerMove={onMove} onPointerUp={endDrag} onPointerLeave={() => { endDrag(); setHover(null); }}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const tag = e.dataTransfer.getData('text/x-layout-tag'); if (tag) place(tag, point(e)); }}>
          {L.background && <image href={L.background.dataUrl} x={0} y={0} width={L.canvas.w} height={L.canvas.h} opacity={0.85} />}
          {gridLines && (
            <g stroke="#94a3b8" strokeWidth={1} opacity={0.45} vectorEffect="non-scaling-stroke">
              {gridLines.xs.map((x) => <line key={`x${x}`} x1={x} y1={0} x2={x} y2={L.canvas.h} vectorEffect="non-scaling-stroke" />)}
              {gridLines.ys.map((y) => <line key={`y${y}`} x1={0} y1={y} x2={L.canvas.w} y2={y} vectorEffect="non-scaling-stroke" />)}
            </g>
          )}
          {/* routes */}
          {L.routes.map((rt, i) => {
            const st = ROUTE_STYLE[rt.kind];
            const on = selected?.type === 'route' && selected.id === rt.id;
            const lenM = rt.points.slice(1).reduce((a, p, j) => a + Math.hypot(p[0] - rt.points[j][0], p[1] - rt.points[j][1]), 0);
            return (
              <g key={rt.id} onClick={(e) => { if (tool === 'select' && !placing) { e.stopPropagation(); setSelected({ type: 'route', id: rt.id }); } }} className="cursor-pointer">
                <polyline points={rt.points.map((p) => p.join(',')).join(' ')} fill="none" stroke="transparent" strokeWidth={r * 2} />
                <polyline points={rt.points.map((p) => p.join(',')).join(' ')} fill="none" stroke={on ? '#b3cc1c' : st.stroke} strokeWidth={r * 0.9} strokeDasharray={st.dash} strokeLinejoin="round" opacity={0.8} />
                <text x={rt.points[0][0]} y={rt.points[0][1] - r} fontSize={fs * 0.8} fill={st.stroke}>R{i + 1} {st.label}{k ? ` ${fmtLen(toM(lenM))}` : ''}</text>
              </g>
            );
          })}
          {draft.length > 0 && <polyline points={[...draft, ...(hover ? [hover] : [])].map((p) => p.join(',')).join(' ')} fill="none" stroke={ROUTE_STYLE[routeKind].stroke} strokeWidth={r * 0.7} strokeDasharray="6 4" />}
          {/* scale reference */}
          {L.scale && tool !== 'scale' && (
            <g stroke="#c0392b" strokeWidth={1.5} opacity={0.7}>
              <line x1={L.scale.a[0]} y1={L.scale.a[1]} x2={L.scale.b[0]} y2={L.scale.b[1]} strokeDasharray="4 3" />
              <text x={(L.scale.a[0] + L.scale.b[0]) / 2} y={(L.scale.a[1] + L.scale.b[1]) / 2 - 4} fontSize={fs * 0.8} fill="#c0392b" stroke="none" textAnchor="middle">{L.scale.value} {L.scale.unit}</text>
            </g>
          )}
          {scalePts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={r * 0.6} fill="#c0392b" />)}
          {scalePts.length === 2 && <line x1={scalePts[0][0]} y1={scalePts[0][1]} x2={scalePts[1][0]} y2={scalePts[1][1]} stroke="#c0392b" strokeWidth={2} />}
          {/* accepted manifolds and remote I/O */}
          {L.manifolds.map((m0) => at({ type: 'manifold', tag: m0.tag }, m0)).map((m) => (
            <g key={m.tag} onPointerDown={startDrag({ type: 'manifold', tag: m.tag })} className="cursor-move" data-tag={m.tag}>
              {m.valves.map((v) => { const i0 = L.items.find((i) => i.tag === v); const it = i0 && at({ type: 'item', id: i0.id }, i0); return it ? <line key={v} x1={m.x} y1={m.y} x2={it.x} y2={it.y} stroke={KIND_STYLE.manifold.fill} strokeWidth={1.5} strokeDasharray="3 3" /> : null; })}
              <rect x={m.x - r * 1.4} y={m.y - r * 0.8} width={r * 2.8} height={r * 1.6} fill={KIND_STYLE.manifold.fill} stroke={selected?.type === 'manifold' && selected.tag === m.tag ? '#b3cc1c' : '#fff'} strokeWidth={2} />
              <text x={m.x} y={m.y + r * 2.4} fontSize={fs} textAnchor="middle" fontWeight={600} fill={KIND_STYLE.manifold.fill}>{m.tag} ({m.valves.length})</text>
            </g>
          ))}
          {L.remoteIo.map((m0) => at({ type: 'rio', tag: m0.tag }, m0)).map((m) => (
            <g key={m.tag} onPointerDown={startDrag({ type: 'rio', tag: m.tag })} className="cursor-move" data-tag={m.tag}>
              <rect x={m.x - r * 1.2} y={m.y - r * 1.2} width={r * 2.4} height={r * 2.4} fill={KIND_STYLE.remoteio.fill} stroke={selected?.type === 'rio' && selected.tag === m.tag ? '#b3cc1c' : '#fff'} strokeWidth={2} />
              <text x={m.x} y={m.y + r * 2.6} fontSize={fs} textAnchor="middle" fontWeight={600} fill={KIND_STYLE.remoteio.fill}>{m.tag}</text>
            </g>
          ))}
          {/* items */}
          {L.items.map((i0) => at({ type: 'item', id: i0.id }, i0)).map((it) => {
            const st = KIND_STYLE[it.kind];
            const on = selected?.type === 'item' && selected.id === it.id;
            const label = it.tag === CABINET ? 'CABINET' : it.tag;
            return (
              <g key={it.id} onPointerDown={startDrag({ type: 'item', id: it.id })} onClick={(e) => { if (tool === 'select' && !placing) e.stopPropagation(); }} className={tool === 'select' && !placing ? 'cursor-move' : ''} data-tag={it.tag}>
                {it.kind === 'cabinet' ? <rect x={it.x - r * 2} y={it.y - r * 1.3} width={r * 4} height={r * 2.6} fill={st.fill} stroke={on ? '#b3cc1c' : '#fff'} strokeWidth={2} />
                  : it.kind === 'jb' ? <rect x={it.x - r} y={it.y - r} width={r * 2} height={r * 2} fill={st.fill} stroke={on ? '#b3cc1c' : '#fff'} strokeWidth={2} />
                  : <circle cx={it.x} cy={it.y} r={it.kind === 'motor' ? r * 1.2 : r * 0.8} fill={st.fill} stroke={on ? '#b3cc1c' : '#fff'} strokeWidth={2} />}
                <text x={it.x} y={it.y - r * (it.kind === 'cabinet' ? 1.7 : 1.4)} fontSize={fs} textAnchor="middle" fontWeight={600} fill="#1d2327" stroke="#fff" strokeWidth={3} paintOrder="stroke">{label}</text>
              </g>
            );
          })}
        </svg>
        <div className="text-[11px] text-steel-500 mt-1 flex gap-3 flex-wrap">
          {(Object.keys(KIND_STYLE) as LayoutItemKind[]).map((x) => <span key={x} className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: KIND_STYLE[x].fill }} />{KIND_STYLE[x].label}</span>)}
          {placing && <span className="text-brand-800 font-medium">Click the layout to place {placing === CABINET ? 'the cabinet' : placing} (Shift+click: then the next one).</span>}
        </div>
      </div>

      {/* right: suggestions and cables */}
      <aside className="w-full md:w-[26rem] shrink-0 border-t md:border-t-0 md:border-l border-steel-200 bg-white overflow-auto p-3 text-xs space-y-4">
        <section data-testid="layout-suggestions">
          <div className="font-semibold text-steel-700 mb-1">Suggestions ({open.length})</div>
          {!ctx.machineLayout && <p className="text-steel-400">Set the scale and place the cabinet and devices to get suggestions.</p>}
          {ctx.machineLayout && !open.length && <p className="text-steel-400">No open suggestions.</p>}
          <ul className="space-y-2">
            {open.map((s) => (
              <li key={s.id} className="border border-steel-200 rounded p-2" data-suggestion={s.kind}>
                <div className="font-medium text-steel-800">{s.title}</div>
                <div className="text-steel-600 mt-0.5">{s.detail}</div>
                {s.manifold && <div className="text-steel-500 mt-0.5">BOM: “Valve manifold {s.manifold.tag} ({s.manifold.valves.length} stations) — part to be selected”.</div>}
                {(s.jbSplit || s.jbMerge) && <div className="text-amber-800 mt-0.5">Accepting proposes a change to the electrical design (you confirm it first).</div>}
                <div className="flex gap-1 mt-1">
                  {!s.info && <button className={`${btn} bg-brand-600 text-white border-brand-600`} onClick={() => decide(s, 'accepted')}>Accept</button>}
                  <button className={btn} onClick={() => decide(s, s.info ? 'accepted' : 'ignored')}>{s.info ? 'Noted' : 'Ignore'}</button>
                </div>
              </li>
            ))}
          </ul>
          {decided.length > 0 && (
            <div className="mt-2">
              <button className="text-steel-500 underline" onClick={() => setShowDecided(!showDecided)}>{showDecided ? 'Hide' : 'Show'} decided ({decided.length})</button>
              {showDecided && <ul className="mt-1 space-y-1">{decided.map((s) => <li key={s.id} className="flex justify-between gap-2"><span className="text-steel-500">{L.decisions[s.id]}: {s.title}</span><button className="text-steel-500 underline" onClick={() => undecide(s.id)}>undo</button></li>)}</ul>}
            </div>
          )}
          {L.manifolds.length > 0 && <div className="mt-2 text-steel-600">Accepted manifolds: {L.manifolds.map((m) => `${m.tag} (${m.valves.join(', ')})`).join('; ')} — listed in the BOM as “part to be selected”. Select a manifold to move or delete it.</div>}
        </section>

        <section>
          <div className="font-semibold text-steel-700 mb-1">Field cables</div>
          <table className="w-full" data-testid="layout-cables">
            <thead><tr><th className={th}>Cable</th><th className={th}>From</th><th className={th}>To</th><th className={th}>Length</th></tr></thead>
            <tbody>{cables.map((c) => <tr key={c.tag}><td className={`${td} font-mono`}>{c.tag}</td><td className={td}>{c.from}</td><td className={td}>{c.to}</td><td className={`${td} ${c.length === 'BY SITE' ? 'text-steel-400' : ''}`}>{c.length}</td></tr>)}</tbody>
          </table>
          <p className="text-steel-400 mt-1">Routed length +{L.service.pct} % slack + {L.service.endM} m service loop at each end. “BY SITE” = an end is not placed. The cable schedule, voltage drop and order list use these lengths.</p>
        </section>

        <section>
          <div className="font-semibold text-steel-700 mb-1">Cable to order (per type)</div>
          <table className="w-full" data-testid="layout-cable-totals">
            <thead><tr><th className={th}>Type</th><th className={th}>Cables</th><th className={th}>Total</th></tr></thead>
            <tbody>{totals.map((t) => <tr key={t.partNumber ?? t.type}><td className="px-2 py-1 border-b border-steel-100">{t.type}{t.partNumber && <span className="font-mono text-steel-500"> {t.partNumber}</span>}</td><td className={td}>{t.count}</td><td className={td}>{t.lengthM ? fmtLen(t.lengthM) : ''}{t.unknown ? `${t.lengthM ? ' + ' : ''}${t.unknown} by site` : ''}</td></tr>)}</tbody>
          </table>
        </section>
      </aside>
    </div>
  );
}
