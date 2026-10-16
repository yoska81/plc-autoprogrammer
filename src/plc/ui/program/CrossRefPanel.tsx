import { useMemo, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/20/solid';
import type { LadderProgram } from '../../core/ladder';
import { GENERAL, crossReference, naturalAddress, rungUses } from './programIndex';

interface Props {
  program: LadderProgram;
  /** Address -> I/O description / nickname. */
  labelOf: (address: string) => string;
  address: string | null;
  onAddress: (address: string | null) => void;
  selectedRungId: string | null;
  onRung: (rungId: string) => void;
  onClose: () => void;
}

/** Cross reference: pick an address and see every rung that reads or writes it. */
export default function CrossRefPanel({ program, labelOf, address, onAddress, selectedRungId, onRung, onClose }: Props) {
  const [filter, setFilter] = useState('');
  const xref = useMemo(() => crossReference(program), [program]);
  const blockName = (id: string) => (id === GENERAL ? 'General' : program.blocks?.find((b) => b.id === id)?.name ?? id);
  const all = useMemo(() => [...xref.keys()].sort(naturalAddress), [xref]);
  const f = filter.trim().toLowerCase();
  const list = f ? all.filter((a) => `${a} ${labelOf(a)}`.toLowerCase().includes(f)) : all;
  const uses = address ? xref.get(address) ?? [] : [];
  const writes = uses.filter((u) => u.kind === 'write');
  const selRung = selectedRungId ? program.rungs.find((r) => r.id === selectedRungId) : undefined;
  const selAddrs = selRung ? [...new Set(rungUses(selRung).map((u) => u.address))].sort(naturalAddress) : [];
  const outCoils = writes.filter((u) => u.how === 'OUT coil').length;

  return (
    <div className="flex h-full flex-col bg-white text-xs">
      <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2">
        <h3 className="flex-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Cross reference</h3>
        <button type="button" onClick={onClose} aria-label="Close cross reference" className="rounded p-0.5 text-gray-400 hover:bg-gray-100"><XMarkIcon className="h-4 w-4" /></button>
      </div>

      {selRung && (
        <div className="border-b border-gray-200 px-3 py-2">
          <div className="mb-1 text-[11px] text-gray-500">Addresses in rung {program.rungs.indexOf(selRung) + 1}</div>
          <div className="flex flex-wrap gap-1">
            {selAddrs.map((a) => (
              <button key={a} type="button" onClick={() => onAddress(a)}
                className={`rounded border px-1.5 py-0.5 font-mono ${address === a ? 'border-brand-600 bg-brand-600 text-brand-950' : 'border-gray-300 hover:bg-brand-50'}`}>{a}</button>
            ))}
          </div>
        </div>
      )}

      {address && (
        <div className="max-h-[55%] overflow-y-auto border-b border-gray-200 px-3 py-2">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-sm font-bold text-gray-900">{address}</span>
            <span className="truncate text-gray-600">{labelOf(address)}</span>
          </div>
          <div className="mt-0.5 text-[11px] text-gray-500">
            Used in {new Set(uses.map((u) => u.rungId)).size} rung(s) · {writes.length ? `written in ${new Set(writes.map((u) => u.rungId)).size}` : 'never written by the program'}
            {outCoils > 1 && <span className="text-amber-700"> · {outCoils} OUT coils (double coil)</span>}
          </div>
          <table className="mt-1.5 w-full">
            <thead className="text-[10.5px] uppercase tracking-wide text-gray-400">
              <tr><th className="py-0.5 pr-2 text-left font-medium">Rung</th><th className="pr-2 text-left font-medium">Use</th><th className="text-left font-medium">Comment</th></tr>
            </thead>
            <tbody>
              {uses.map((u, i) => {
                const r = program.rungs.find((x) => x.id === u.rungId);
                return (
                  <tr key={i} onClick={() => onRung(u.rungId)} title={`Go to rung ${u.number} (${blockName(u.block)})`}
                    className={`cursor-pointer border-t border-gray-100 align-top hover:bg-brand-50 ${selectedRungId === u.rungId ? 'bg-sky-50' : ''}`}>
                    <td className="py-1 pr-2 font-mono font-semibold text-gray-700">{u.number}</td>
                    <td className="py-1 pr-2 whitespace-nowrap">
                      <span className={`mr-1 rounded px-1 text-[10px] font-bold ${u.kind === 'write' ? 'bg-sky-100 text-sky-800' : 'bg-gray-100 text-gray-600'}`}>{u.kind === 'write' ? 'W' : 'R'}</span>
                      {u.how}
                    </td>
                    <td className="py-1 text-gray-600"><span className="text-gray-400">{blockName(u.block)} · </span>{r?.comment}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-3 pt-2">
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find address or name"
          className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500" />
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5">
        {list.map((a) => {
          const u = xref.get(a) ?? [];
          const w = u.filter((x) => x.kind === 'write').length;
          return (
            <li key={a}>
              <button type="button" onClick={() => onAddress(address === a ? null : a)}
                className={`flex w-full items-center gap-2 rounded-sm px-1.5 py-0.5 text-left ${address === a ? 'bg-brand-600 text-brand-950' : 'hover:bg-brand-50'}`}>
                <span className="w-14 shrink-0 font-mono font-semibold">{a}</span>
                <span className={`flex-1 truncate ${address === a ? '' : 'text-gray-600'}`}>{labelOf(a)}</span>
                <span className={`shrink-0 font-mono text-[10.5px] ${address === a ? 'text-brand-800' : 'text-gray-400'}`} title="reads / writes">{u.length - w}R {w}W</span>
              </button>
            </li>
          );
        })}
        {!list.length && <li className="px-1.5 py-1 text-gray-400">No matching address.</li>}
      </ul>
    </div>
  );
}
