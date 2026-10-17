import { useMemo, useState } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { backPanelDrilling, doorDrilling, dualDim, dualSize, type DrawingContext, type DrillingPlan } from './derive';
import { drillingDxf, type DxfOptions } from './dxf';
import ResizablePane from '../components/ResizablePane';
import { buildMachiningPdf, saveBlob } from '../deliverables/files';
import { useUi } from '../store/useUiStore';

const th = 'text-left font-medium text-steel-500 px-2 py-1 border-b border-steel-200 bg-steel-50 whitespace-nowrap';
const td = 'px-2 py-1 border-b border-steel-100 whitespace-nowrap';

const save = (name: string, text: string) => saveBlob(name, new Blob([text], { type: 'application/dxf' }));

/** True-proportion preview of a machining plan: outline, holes, cutouts (datum lower-left). */
function PlanView({ plan, selected, onSelect }: { plan: DrillingPlan; selected: string | null; onSelect: (id: string) => void }) {
  const m = 30;
  return (
    <svg viewBox={`${-m} ${-m} ${plan.w + 2 * m} ${plan.h + 2 * m}`} className="w-full h-full" role="img" aria-label={plan.title}>
      {/* SVG y grows down: flip so the datum is lower-left like the DXF */}
      <g transform={`translate(0 ${plan.h}) scale(1 -1)`}>
        <rect x={0} y={0} width={plan.w} height={plan.h} fill="#f7f8f6" stroke="#1d2327" strokeWidth={1.2} />
        {plan.cutouts.map((c) => {
          const on = selected === c.id;
          const stroke = on ? '#b3cc1c' : c.code === 'G' ? '#8a9aa2' : '#1d2327';
          return (
            <g key={c.id} onClick={() => onSelect(c.id)} className="cursor-pointer">
              {c.kind === 'round'
                ? <circle cx={c.x} cy={c.y} r={c.w / 2} fill={on ? '#bcd3fd' : '#fff'} stroke={stroke} strokeWidth={on ? 2 : 1} strokeDasharray={c.code === 'G' ? '4 3' : undefined} />
                : <rect x={c.x - c.w / 2} y={c.y - c.h / 2} width={c.w} height={c.h} fill={on ? '#bcd3fd' : '#fff'} stroke={stroke} strokeWidth={on ? 2 : 1} />}
            </g>
          );
        })}
        {plan.holes.map((h) => (
          <circle key={h.id} cx={h.x} cy={h.y} r={Math.max(h.dia / 2, 2)} onClick={() => onSelect(h.id)}
            className="cursor-pointer" fill={selected === h.id ? '#bcd3fd' : '#1d2327'} stroke={selected === h.id ? '#0a52c0' : 'none'} />
        ))}
        {/* datum */}
        <path d="M -14 0 H 14 M 0 -14 V 14" stroke="#c0392b" strokeWidth={1} />
      </g>
      <text x={2} y={plan.h + 18} fontSize={10} fill="#c0392b">0,0</text>
      <text x={plan.w} y={plan.h + 18} fontSize={10} fill="#55646c" textAnchor="end">{dualSize(plan.w, plan.h)} in [mm]</text>
    </svg>
  );
}

/**
 * Machining: back-panel drilling and door cutouts for the machine shop, with
 * 1:1 DXF downloads (inch by default, or mm), plus the hole tables in dual dimensions inch [mm].
 */
export default function MachiningPanel({ ctx, fileBase }: { ctx: DrawingContext | null; fileBase: string }) {
  const [which, setWhich] = useUi<'backpanel' | 'door'>('machining.which', 'backpanel');
  const [units, setUnits] = useUi<'mm' | 'in'>('machining.units', 'in');
  const [cutOnly, setCutOnly] = useUi('machining.cutOnly', false);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<'backpanel' | 'door' | null>(null);

  const plans = useMemo(() => (ctx ? { backpanel: backPanelDrilling(ctx), door: doorDrilling(ctx) } : null), [ctx]);
  if (!ctx || !plans) {
    return <div className="flex-1 flex items-center justify-center text-sm text-steel-500">No design yet. Fill in the Design tab and click Generate.</div>;
  }
  const plan = plans[which];
  const opts: DxfOptions = { units, cutOnly };
  const name = (kind: 'backpanel' | 'door') => `${fileBase}_${kind === 'backpanel' ? 'back_panel_drilling' : 'door_cutouts'}_1to1_${units}${cutOnly ? '_cut' : ''}.dxf`;
  const download = (kind: 'backpanel' | 'door') => save(name(kind), drillingDxf(plans[kind], ctx.projectName, opts));
  const downloadPdf = async (kind: 'backpanel' | 'door') => {
    setBusy(kind);
    try {
      const pdf = await buildMachiningPdf(ctx, kind);
      if (pdf) saveBlob(`${fileBase}_${kind === 'backpanel' ? 'back_panel_drilling' : 'door_cutouts'}.pdf`, pdf);
    } finally { setBusy(null); }
  };
  const rows = [...plan.cutouts.map((c) => ({ id: c.id, tag: c.tag, code: c.code, x: c.x, y: c.y, size: c.kind === 'round' ? `Ø${dualDim(c.w)}` : dualSize(c.w, c.h), verified: c.verified })),
    ...plan.holes.map((h) => ({ id: h.id, tag: h.tag, code: h.code, x: h.x, y: h.y, size: `Ø${dualDim(h.dia)}`, verified: h.verified }))];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-4 py-1.5 bg-[#f7f8f9] border-b border-steel-200">
        <div className="flex" role="group" aria-label="Part">
          {(['backpanel', 'door'] as const).map((k) => (
            <button key={k} onClick={() => { setWhich(k); setSelected(null); }}
              className={`px-3 h-7 border text-[13px] ${which === k ? 'bg-brand-600 border-brand-500 text-white font-medium' : 'bg-white border-steel-300 hover:bg-steel-50'}`}>
              {k === 'backpanel' ? `Back panel (${plans.backpanel.holes.length} holes)` : `Front door (${plans.door.cutouts.length} cutouts)`}
            </button>
          ))}
        </div>
        <span className="w-px h-5 bg-steel-300 mx-1" />
        <label className="flex items-center gap-1.5">Units
          <select value={units} onChange={(e) => setUnits(e.target.value as 'mm' | 'in')} className="h-7 border border-steel-300 rounded-sm bg-white px-1.5" aria-label="DXF units">
            <option value="in">Inches</option>
            <option value="mm">Millimetres</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5" title="Leave out text, centre marks and optional notches so the laser / CNC only sees cutting geometry">
          <input type="checkbox" checked={cutOnly} onChange={(e) => setCutOnly(e.target.checked)} /> Cutting geometry only
        </label>
        <div className="ml-auto flex gap-2">
          <button onClick={() => download('backpanel')} className="h-7 px-3 flex items-center gap-1.5 bg-brand-600 text-white font-medium rounded-sm hover:bg-brand-700">
            <ArrowDownTrayIcon className="w-4 h-4" /> Back panel DXF
          </button>
          <button onClick={() => download('door')} className="h-7 px-3 flex items-center gap-1.5 bg-brand-600 text-white font-medium rounded-sm hover:bg-brand-700">
            <ArrowDownTrayIcon className="w-4 h-4" /> Front door DXF
          </button>
          {(['backpanel', 'door'] as const).map((k) => (
            <button key={k} onClick={() => void downloadPdf(k)} disabled={busy !== null} title="Dimensioned drawing to print: hole table, title block, sheet scale"
              className="h-7 px-3 flex items-center gap-1.5 bg-white border border-steel-300 font-medium rounded-sm hover:bg-steel-50 disabled:opacity-60">
              <ArrowDownTrayIcon className="w-4 h-4" /> {busy === k ? 'Building PDF…' : k === 'backpanel' ? 'Back panel PDF' : 'Front door PDF'}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 py-1.5 text-xs text-steel-600 bg-white border-b border-steel-200">
        Scale <b>1:1</b> — every coordinate is the real size in {units === 'in' ? 'inches' : 'millimetres'}; the file header declares the unit so CAM software imports it at full size. Tables and DXF labels show inch [mm].
        Datum 0,0 is the lower-left corner{which === 'door' ? ', seen from outside the door' : ''}. Layers: OUTLINE, HOLES, CUTOUTS{cutOnly ? '' : ', NOTCH_OPTIONAL, TEMPLATE (do not cut), TEXT, DIMS'}.
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 min-w-0 p-4 bg-steel-100 overflow-hidden">
          <div className="h-full bg-white border border-steel-200 p-2"><PlanView plan={plan} selected={selected} onSelect={setSelected} /></div>
        </div>
        <ResizablePane id="machining.table" defaultSize={460} min={300} max={900} handle="left" className="border-l border-steel-200 bg-white flex flex-col overflow-hidden">
          <div className="h-8 px-3 flex items-center bg-[#e9edef] border-b border-steel-200 text-xs font-semibold text-steel-700">{plan.title} — {plan.part}</div>
          <div className="px-3 py-2 border-b border-steel-200 space-y-0.5">
            {plan.codes.map((c) => (
              <div key={c.code} className="text-xs"><b className="font-mono">{c.code}</b> ({c.count}×) {c.spec}{!c.verified && <span className="text-amber-700"> · verify with datasheet</span>}</div>
            ))}
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0"><tr>{['ID', 'Feature', 'X in [mm]', 'Y in [mm]', 'Size in [mm]'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => setSelected(r.id)} className={`cursor-pointer ${selected === r.id ? 'bg-brand-100' : 'hover:bg-brand-50'}`}>
                    <td className={`${td} font-mono`}>{r.id}</td>
                    <td className={td}>{r.tag}</td>
                    <td className={`${td} font-mono text-right`}>{dualDim(r.x)}</td>
                    <td className={`${td} font-mono text-right`}>{dualDim(r.y)}</td>
                    <td className={`${td} font-mono`}>{r.size}{!r.verified && <span className="text-amber-700"> *</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {plan.notes.length > 0 && <ul className="px-3 py-2 border-t border-steel-200 text-[11px] text-steel-500 list-disc pl-6 max-h-28 overflow-auto">{plan.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
        </ResizablePane>
      </div>
    </div>
  );
}
