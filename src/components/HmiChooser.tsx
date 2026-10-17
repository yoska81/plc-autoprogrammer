import { useMemo } from 'react';
import { allPanelRows, type PanelRow } from '../hmi/panelRows';
import { hmiFit, type Need } from '../plc/core/fit';
import { useUi } from '../store/useUiStore';

const th = 'text-left font-medium text-steel-500 px-3 py-1.5 border-b border-steel-200 bg-steel-50 whitespace-nowrap';
const td = 'px-3 py-1.5 border-b border-steel-100 align-top';

/** Size filter buckets (diagonal inches). */
const SIZES: { id: string; label: string; test: (s: number) => boolean }[] = [
  { id: 'all', label: 'All sizes', test: () => true },
  { id: 's', label: 'Up to 5"', test: (s) => s > 0 && s < 5.5 },
  { id: 'm', label: '6–8"', test: (s) => s >= 5.5 && s < 8.5 },
  { id: 'l', label: '9–11"', test: (s) => s >= 8.5 && s < 11.5 },
  { id: 'xl', label: '12–15"', test: (s) => s >= 11.5 && s < 15.8 },
  { id: 'xxl', label: 'Over 15"', test: (s) => s >= 15.8 },
];

/**
 * Operator panel chooser: grouped by maker and series, with a size filter. Panels too small or
 * not able to talk to the chosen PLC are grey with the reason; legacy (discontinued) models are
 * listed grey with their successor; a panel whose resolution is not confirmed cannot be chosen.
 */
export default function HmiChooser({ need, cpuId, selected, suggested, makers, onPick }: {
  need: Need; cpuId?: string; selected: string | null; suggested?: string; makers: string[];
  onPick: (pn: string | null) => void;
}) {
  const [allMakers, setAllMakers] = useUi('equipment.allHmiMakers', false);
  const [size, setSize] = useUi('equipment.hmiSize', 'all');
  const [showLegacy, setShowLegacy] = useUi('equipment.hmiLegacy', false);
  const rows = useMemo(() => allPanelRows(), []);
  const sizeTest = (SIZES.find((s) => s.id === size) ?? SIZES[0]).test;
  const shown = rows.filter((r) => r.pn === selected
    || ((allMakers || makers.includes(r.vendor)) && sizeTest(r.sizeIn) && (showLegacy || !r.legacy)));
  // Maker → series, in first-seen order; panels by size within a series.
  const groups = new Map<string, PanelRow[]>();
  for (const r of shown) groups.set(`${r.maker} — ${r.series}`, [...(groups.get(`${r.maker} — ${r.series}`) ?? []), r]);
  for (const g of groups.values()) g.sort((a, b) => a.sizeIn - b.sizeIn || a.pn.localeCompare(b.pn));
  const legacyCount = rows.filter((r) => r.legacy && (allMakers || makers.includes(r.vendor)) && sizeTest(r.sizeIn)).length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-b border-steel-200 text-xs text-steel-600">
        <label className="flex items-center gap-1.5">Size
          <select aria-label="Panel size" value={size} onChange={(e) => setSize(e.target.value)} className="border border-steel-300 rounded-sm px-1.5 py-0.5 bg-white">
            {SIZES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={allMakers} onChange={(e) => setAllMakers(e.target.checked)} /> Every maker's panels</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={showLegacy} onChange={(e) => setShowLegacy(e.target.checked)} /> Show legacy models{legacyCount ? ` (${legacyCount})` : ''}</label>
        <span className="ml-auto">{shown.length} panel{shown.length === 1 ? '' : 's'}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr>{['', 'Part number', 'Size', 'Resolution', 'List price', 'Fits this machine?'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            <tr onClick={() => onPick(null)} className={`cursor-pointer hover:bg-brand-50 ${!selected ? 'bg-brand-100' : ''}`}>
              <td className={td}><input type="radio" readOnly checked={!selected} aria-label="No HMI" /></td>
              <td className={td} colSpan={5}>No touch panel (pushbuttons and lights only)</td>
            </tr>
            {[...groups.entries()].map(([name, list]) => (
              <GroupRows key={name} name={name} list={list} need={need} cpuId={cpuId} selected={selected} suggested={suggested} onPick={onPick} />
            ))}
            {!shown.length && <tr><td className={`${td} text-steel-500`} colSpan={6}>No panel of the chosen makers in this size.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupRows({ name, list, need, cpuId, selected, suggested, onPick }: {
  name: string; list: PanelRow[]; need: Need; cpuId?: string; selected: string | null; suggested?: string; onPick: (pn: string) => void;
}) {
  return (
    <>
      <tr role="rowgroup" aria-label={name}><td colSpan={6} className="px-3 pt-3 pb-1 text-xs font-semibold text-steel-700 border-b border-steel-200 bg-white">{name} <span className="font-normal text-steel-400">· {list.length}</span></td></tr>
      {list.map((r) => {
        const f = r.legacy ? { ok: false, reason: `Legacy model${r.successor ? `; successor ${r.successor}` : ''}.` }
          : r.builtIn && r.pn !== cpuId ? { ok: false, reason: `Built into the ${r.pn} PLC: choose it as the PLC.` }
          : r.builtIn ? { ok: true, reason: null }
          : r.model ? hmiFit(r.model, need, cpuId) : { ok: false, reason: "Resolution not confirmed on the maker's datasheet yet." };
        const isSel = selected === r.pn;
        return (
          <tr key={r.pn} onClick={() => f.ok && onPick(r.pn)}
            className={`${f.ok ? 'cursor-pointer hover:bg-brand-50' : 'text-steel-400 bg-steel-50/60 cursor-not-allowed'} ${isSel ? 'bg-brand-100' : ''}`}>
            <td className={td}><input type="radio" readOnly checked={isSel} disabled={!f.ok} aria-label={`Choose ${r.pn}`} /></td>
            <td className={`${td} font-mono`}>{r.pn}{r.legacy && <span className="ml-2 text-[10px] border border-steel-300 text-steel-500 px-1 py-0.5 rounded-sm font-sans">LEGACY</span>}{suggested === r.pn && <span className="ml-2 text-[10px] bg-brand-600 text-white px-1.5 py-0.5 rounded-sm font-sans">SUGGESTED</span>}</td>
            <td className={td}>{r.sizeIn ? `${r.sizeIn}"` : '—'}</td>
            <td className={td}>{r.res}</td>
            <td className={`${td} text-xs`}>{r.price ?? '—'}</td>
            <td className={`${td} text-xs`}>{f.ok ? <span className="text-green-700">{r.builtIn ? 'Yes · built into the PLC' : 'Yes'}</span> : f.reason}</td>
          </tr>
        );
      })}
    </>
  );
}
