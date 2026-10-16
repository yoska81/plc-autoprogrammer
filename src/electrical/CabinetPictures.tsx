import { useState } from 'react';
import type { DrawingContext } from './derive';
import CabinetRender from './render/CabinetRender';
import { useHmiStore } from '../store/useHmiStore';

type View = 'both' | 'inside' | 'door';

/** Realistic pictures of the designed cabinet: open (inside) and closed (door). */
export default function CabinetPictures({ ctx }: { ctx: DrawingContext | null }) {
  const hmiPart = useHmiStore((s) => s.design?.hmiPartNumber || s.hmiPartNumber || null);
  const [view, setView] = useState<View>('both');
  const [labels, setLabels] = useState(true);

  if (!ctx) {
    return <div className="flex-1 flex items-center justify-center text-sm text-steel-500">No design yet. Fill in the Design tab and click Generate.</div>;
  }
  const btn = (v: View, label: string) => (
    <button onClick={() => setView(v)} className={`px-3 py-1 text-xs border ${view === v ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-steel-300 hover:bg-steel-50'}`}>{label}</button>
  );
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-steel-200">
        <div className="flex">{btn('both', 'Both')}{btn('inside', 'Inside (door open)')}{btn('door', 'Door closed')}</div>
        <label className="flex items-center gap-1.5 text-xs text-steel-600"><input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} /> Device tags</label>
        <span className="ml-auto text-xs text-steel-500">Drawn to scale from the panel layout; hover a device for its part number.</span>
      </div>
      <div className={`flex-1 overflow-auto p-4 grid gap-4 ${view === 'both' ? 'grid-cols-1 2xl:grid-cols-2' : 'grid-cols-1'}`}>
        {(view === 'both' || view === 'inside') && (
          <figure className="bg-white border border-steel-200 p-2 min-h-[520px] flex flex-col">
            <div className="flex-1 min-h-[480px]"><CabinetRender ctx={ctx} view="inside" hmiPartNumber={hmiPart} showLabels={labels} /></div>
            <figcaption className="text-xs text-steel-500 pt-1">Inside view — back panel, DIN rails, wire duct and every component in the design.</figcaption>
          </figure>
        )}
        {(view === 'both' || view === 'door') && (
          <figure className="bg-white border border-steel-200 p-2 min-h-[520px] flex flex-col">
            <div className="flex-1 min-h-[480px]"><CabinetRender ctx={ctx} view="door" hmiPartNumber={hmiPart} showLabels={labels} /></div>
            <figcaption className="text-xs text-steel-500 pt-1">Door view — operator devices, touch panel, disconnect handle and nameplate.</figcaption>
          </figure>
        )}
      </div>
    </div>
  );
}
