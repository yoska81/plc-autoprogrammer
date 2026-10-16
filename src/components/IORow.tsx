import { TrashIcon } from '@heroicons/react/24/outline';
import type { IOPoint, IOCategory } from '../types/io';
import { useIOStore } from '../store/useIOStore';

const ALL_CATEGORIES: IOCategory[] = [
  'Safety', 'Operator/HMI', 'External Machine', 'Product Detection',
  'Conveyor', 'Pneumatic', 'Vacuum', 'Servo/Axis', 'Station 1',
  'Station 2', 'Analog/Process', 'Spare',
];

export const ioTh = 'text-left font-medium text-steel-500 px-3 py-1.5 border-b border-steel-200 bg-steel-50 whitespace-nowrap';
const td = 'px-3 py-1 border-b border-steel-100';
const cell = 'w-full bg-transparent border border-transparent rounded-sm px-1.5 py-0.5 hover:border-steel-300 focus:bg-white focus:border-brand-500 focus:outline-none';

interface IORowProps {
  point: IOPoint;
  /** Effective PLC address (manual override or automatic). */
  address: string;
  /** Another point resolves to the same address. */
  duplicate: boolean;
}

export function IORow({ point, address, duplicate }: IORowProps) {
  const { updateDescription, updateCategory, deletePoint, setPlcAddress } = useIOStore();
  const isManual = Boolean(point.plcAddress);

  return (
    <tr className="hover:bg-brand-50/60 group">
      <td className={`${td} font-mono text-steel-700 whitespace-nowrap`}>{point.id}</td>
      <td className={`${td} whitespace-nowrap`}>
        <div className="flex items-center gap-1">
          <input
            key={address}
            defaultValue={isManual ? address : ''}
            placeholder={address || '—'}
            aria-label={`PLC address for ${point.id}`}
            title={isManual ? 'Manual address. Clear it to assign automatically.' : 'Assigned automatically. Type to override.'}
            onBlur={(e) => { if (e.target.value.trim().toUpperCase() !== (point.plcAddress ?? '')) setPlcAddress(point.id, e.target.value); }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            className={`${cell} w-20 font-mono ${duplicate ? 'border-red-400 text-red-700' : isManual ? 'text-brand-800 font-semibold' : 'placeholder:text-steel-700'}`}
          />
          {duplicate && <span className="text-[10px] text-white bg-red-600 px-1 rounded-sm" title="Two I/O points use this address">DUP</span>}
          {isManual && !duplicate && <span className="text-[10px] text-brand-700" title="Manual address">M</span>}
        </div>
      </td>
      <td className={td}>
        <input
          key={point.description}
          defaultValue={point.description}
          placeholder="Description"
          aria-label={`Description of ${point.id}`}
          onBlur={(e) => { if (e.target.value !== point.description) updateDescription(point.id, e.target.value); }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { e.currentTarget.value = point.description; e.currentTarget.blur(); } }}
          className={`${cell} text-steel-900 placeholder:italic placeholder:text-steel-400`}
        />
      </td>
      <td className={td}>
        <select value={point.category} onChange={(e) => updateCategory(point.id, e.target.value as IOCategory)}
          aria-label={`Category of ${point.id}`} className={`${cell} text-steel-700`}>
          {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </td>
      <td className={`${td} text-xs text-steel-500 whitespace-nowrap`}>{point.deviceType ?? '—'}</td>
      <td className={td}>
        <button onClick={() => deletePoint(point.id)} title="Delete" aria-label={`Delete ${point.id}`}
          className="text-steel-300 opacity-0 group-hover:opacity-100 hover:text-red-600">
          <TrashIcon className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}
