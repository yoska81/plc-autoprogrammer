import { useMemo, useState } from 'react';
import type { ProjectSnapshot } from './collect';
import { buildEstimate, hoursText, TASKS } from './buildTime';
import { useShopRatesStore } from './useShopRatesStore';
import { money } from './purchasing';
import { saveBlob } from './files';

const btn = 'px-3 py-1.5 text-sm rounded border border-steel-300 hover:bg-steel-50 disabled:opacity-40';
const csvCell = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

/** Deliverables card: hours to build and test the panel, with the shop's own per-unit rates. */
export default function BuildTimeCard({ p }: { p: ProjectSnapshot }) {
  const { rates, hourlyRate, setRate, setHourlyRate, reset } = useShopRatesStore();
  const [open, setOpen] = useState(false);
  const est = useMemo(() => buildEstimate(p, rates, hourlyRate), [p, rates, hourlyRate]);
  const changed = Object.keys(rates).length > 0 || hourlyRate > 0;

  const csv = () => {
    if (!est) return;
    const rows: (string | number)[][] = [['Task', 'Item', 'Quantity', 'Rate', 'Unit', 'Hours', 'Counted from']];
    for (const l of est.lines) rows.push([l.task, l.item, l.qty, l.rate, l.unit, Math.round(l.hours * 100) / 100, l.basis]);
    rows.push(['Total', '', '', '', '', Math.round(est.totalHours * 100) / 100, '']);
    if (est.cost) rows.push(['Labour', `at $${est.hourlyRate}/h`, '', '', '', '', money(est.cost)]);
    saveBlob(`${p.fileBase}_build_time.csv`, new Blob([rows.map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv' }));
  };

  return (
    <div className="bg-white rounded-sm border border-steel-200 p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-steel-800">Shop build time (estimate)</h3>
        {est && <span className="text-sm font-semibold text-steel-800" data-testid="build-total">{hoursText(est.totalHours)}{est.cost ? ` · ${money(est.cost)}` : ''}</span>}
      </div>
      <p className="text-xs text-steel-500">Hours to build and test this panel: quantities are counted from the design (holes, rail and duct, parts, wire ends by size, labels, cables, I/O), times your shop's rate for each. Change any rate to match your shop; your rates are kept for every project. The total is also in the purchase summary PDF and the order list Excel file.</p>
      {!est ? <p className="text-sm text-steel-500">No electrical design yet.</p> : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {est.byTask.map((t) => (
              <div key={t.task} className="border border-steel-200 rounded-sm px-2 py-1.5">
                <div className="text-[11px] text-steel-500">{t.task}</div>
                <div className="text-sm font-semibold text-steel-800 tabular-nums">{hoursText(t.hours)}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button className={btn} onClick={() => setOpen((v) => !v)} aria-expanded={open}>{open ? 'Hide rates' : 'Show and edit rates'}</button>
            <label className="flex items-center gap-2">Shop labour rate (USD per hour)
              <input type="number" min={0} step={1} value={hourlyRate || ''} placeholder="not set" aria-label="Shop labour rate"
                onChange={(e) => setHourlyRate(Math.max(0, parseFloat(e.target.value) || 0))} className="w-24 border border-steel-300 rounded px-2 py-1 text-sm" />
            </label>
            <button className={btn} onClick={csv}>Build time (CSV)</button>
            {changed && <button className={btn} onClick={reset}>Back to typical rates</button>}
          </div>
          {open && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-steel-500 uppercase"><tr>{['Item', 'Quantity', 'Rate', 'Hours', 'Counted from'].map((h) => <th key={h} className={`py-1 px-2 ${h === 'Item' || h === 'Counted from' ? 'text-left' : 'text-right'}`}>{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-steel-100">
                  {TASKS.map((task) => [
                    <tr key={task} className="bg-steel-50"><td colSpan={5} className="px-2 py-1 font-semibold text-steel-700">{task}</td></tr>,
                    ...est.lines.filter((l) => l.task === task).map((l) => (
                      <tr key={l.key} className={l.qty ? '' : 'text-steel-400'}>
                        <td className="px-2 py-1">{l.item}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{Math.round(l.qty * 100) / 100}</td>
                        <td className="px-2 py-1 text-right whitespace-nowrap">
                          <input type="number" min={0} step={l.inHours ? 0.25 : 0.5} value={l.rate} aria-label={`Rate: ${l.item}`}
                            onChange={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v) && v >= 0) setRate(l.key, v); }}
                            className={`w-16 border rounded px-1 py-0.5 text-right ${l.key in rates && rates[l.key] !== l.value ? 'border-brand-400 bg-brand-50' : 'border-steel-300'}`} /> <span className="text-steel-500">{l.unit}</span>
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums">{hoursText(l.hours)}</td>
                        <td className="px-2 py-1 text-steel-500">{l.basis}</td>
                      </tr>
                    )),
                  ])}
                </tbody>
              </table>
            </div>
          )}
          {est.notes.length > 0 && <p className="text-xs text-amber-700">{est.notes.join(' ')}</p>}
          <p className="text-xs text-steel-500">An estimate for quoting, not a schedule: it leaves out engineering, programming, purchasing, waiting for parts and packing.</p>
        </>
      )}
    </div>
  );
}
