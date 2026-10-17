import { TrashIcon } from '@heroicons/react/24/outline';
import type { IOPoint, IOCategory } from '../types/io';
import { useIOStore } from '../store/useIOStore';
import AnalogCell from '../plc/ui/io/AnalogCell';
import { useEditsStore } from '../edits/useEditsStore';
import { EditedMark } from '../edits/EditedMark';
import MicButton from '../voice/MicButton';

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
  // A generated description the user rewrote: marked, with a way back (kept by I/O id).
  const key = `io:${point.id}`;
  const edit = useEditsStore((s) => s.texts[key]);
  const setText = useEditsStore((s) => s.setText);
  const resetText = useEditsStore((s) => s.resetText);
  const edited = Boolean(edit && edit.value === point.description);
  const describe = (v: string, before: string) => {
    updateDescription(point.id, v);
    // Points the user added themselves have no generated text to go back to.
    const generated = edit?.generated ?? before;
    if (generated.trim()) setText(key, v, generated);
  };

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
          {isManual && !duplicate && <span className="text-[10px] text-brand-800" title="Manual address">M</span>}
        </div>
      </td>
      <td className={td}>
        <div className="flex items-center gap-1">
        <input
          value={point.description}
          placeholder="Description"
          aria-label={`Description of ${point.id}`}
          // Saved as you type, so leaving the page, Back or Ctrl+S never loses an edit; Escape undoes the edit.
          onFocus={(e) => { e.currentTarget.dataset.before = point.description; }}
          onChange={(e) => describe(e.target.value, e.currentTarget.dataset.before ?? point.description)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { const b = e.currentTarget.dataset.before ?? point.description; describe(b, b); e.currentTarget.blur(); } }}
          className={`${cell} text-steel-900 placeholder:italic placeholder:text-steel-400 ${edited ? 'text-sky-900' : ''}`}
        />
        {edited && edit && <EditedMark generated={edit.generated} onReset={() => { updateDescription(point.id, edit.generated); resetText(key); }} />}
        <span className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 has-[[aria-pressed=true]]:opacity-100 has-[[role=status]]:opacity-100">
          <MicButton value={point.description} onChange={(v) => describe(v, point.description)} label="Speak the description" />
        </span>
        </div>
      </td>
      <td className={td}>
        <select value={point.category} onChange={(e) => updateCategory(point.id, e.target.value as IOCategory)}
          aria-label={`Category of ${point.id}`} className={`${cell} text-steel-700`}>
          {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </td>
      <td className={`${td} text-xs text-steel-500 whitespace-nowrap`}>
        <div className="flex items-center gap-2">{point.signal !== 'analog' && <span>{point.deviceType ?? '—'}</span>}<AnalogCell point={point} address={address} /></div>
      </td>
      <td className={td}>
        <button onClick={() => deletePoint(point.id)} title="Delete" aria-label={`Delete ${point.id}`}
          className="text-steel-300 opacity-0 group-hover:opacity-100 hover:text-red-600">
          <TrashIcon className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}
