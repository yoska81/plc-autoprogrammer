import { useIOStore } from '../store/useIOStore';
import { IORow, ioTh } from './IORow';
import { usePlc } from '../plc/core/usePlc';
import type { IOPoint } from '../types/io';
import type { IOFilter } from './IOToolbar';

function Group({ title, color, points, addresses, dupes }: {
  title: string; color: string; points: IOPoint[]; addresses: Map<string, string>; dupes: Set<string>;
}) {
  if (!points.length) return null;
  return (
    <>
      <tr>
        <td colSpan={6} className="px-3 py-1 bg-[#e9edef] border-y border-steel-200 text-xs font-semibold text-steel-700">
          <span className={`inline-block w-2 h-2 rounded-sm mr-2 ${color}`} />{title} ({points.length})
        </td>
      </tr>
      {points.map((p) => <IORow key={p.id} point={p} address={addresses.get(p.id) ?? ''} duplicate={dupes.has(addresses.get(p.id) ?? '')} />)}
    </>
  );
}

export function IOTable({ filter }: { filter: IOFilter }) {
  const { projectIO } = useIOStore();
  const { profile, addresses } = usePlc();
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const a of addresses.values()) {
    if (a && seen.has(a)) dupes.add(a);
    seen.add(a);
  }

  if (projectIO.length === 0) {
    return (
      <div className="bg-white border border-steel-200 py-16 text-center text-steel-500">
        <p className="font-medium text-steel-600">No I/O points yet</p>
        <p className="text-xs mt-1">Generate them from the machine description, or add them by hand.</p>
      </div>
    );
  }

  const q = filter.text.trim().toLowerCase();
  const shown = projectIO.filter((p) =>
    (filter.type === 'all' || p.type === filter.type) &&
    (!q || [p.id, p.description, p.category, addresses.get(p.id) ?? ''].some((s) => s.toLowerCase().includes(q))));

  return (
    <section className="bg-white border border-steel-200">
      <div className="h-8 px-3 flex items-center justify-between bg-[#e9edef] border-b border-steel-200">
        <h4 className="text-xs font-semibold text-steel-700">I/O list — {profile.name}</h4>
        {shown.length !== projectIO.length && <span className="text-xs text-steel-500">Showing {shown.length} of {projectIO.length}</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${ioTh} w-20`}>Tag</th>
              <th className={`${ioTh} w-28`} title="Address on the selected PLC. Type to override.">Address</th>
              <th className={ioTh}>Description</th>
              <th className={`${ioTh} w-40`}>Category</th>
              <th className={`${ioTh} w-32`}>Device</th>
              <th className={`${ioTh} w-8`} />
            </tr>
          </thead>
          <tbody>
            <Group title="Inputs" color="bg-brand-600" points={shown.filter((p) => p.type === 'input')} addresses={addresses} dupes={dupes} />
            <Group title="Outputs" color="bg-amber-500" points={shown.filter((p) => p.type === 'output')} addresses={addresses} dupes={dupes} />
          </tbody>
        </table>
        {!shown.length && <p className="px-3 py-3 text-steel-500">Nothing matches the filter.</p>}
      </div>
    </section>
  );
}
