import { getPart, partsIn } from './catalog';
import { compareStrength, keyRatings, sameKind } from './strength';

const th = 'text-left font-medium text-steel-500 px-3 py-1.5 border-b border-steel-200 bg-steel-50 whitespace-nowrap';
const td = 'px-3 py-1.5 border-b border-steel-100 align-top';

/**
 * Choose a replacement for one component: every catalog part of the same type
 * is listed. Weaker or incompatible ones are grey with the reason; anything
 * equal or stronger can be chosen.
 */
export default function PartPicker({ tag, partNumber, onPick, onClose }: {
  tag: string; partNumber: string; onPick: (partNumber: string) => void; onClose: () => void;
}) {
  const current = getPart(partNumber);
  if (!current) return null;
  const rows = partsIn(current.category).filter((p) => sameKind(current, p)).map((p) => ({ p, s: compareStrength(current, p) }))
    .sort((x, y) => Number(y.s.ok) - Number(x.s.ok));

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white border border-steel-300 shadow-2xl max-w-5xl w-full max-h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="h-8 px-4 flex items-center bg-brand-800 text-white">
          <h3 className="text-[13px] font-semibold">Change {tag}: {current.description}</h3>
          <button onClick={onClose} className="ml-auto text-brand-100 hover:text-white" aria-label="Close">✕</button>
        </div>
        <p className="px-4 py-2 text-steel-600 border-b border-steel-200">
          Parts that are weaker than the one the design needs, or don't fit this circuit, are grey. Anything equal or stronger can be chosen. Drawings, BOM and cabinet picture update automatically.
        </p>
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead><tr>{['', 'Part number', 'Description', 'Key ratings', 'Compared with current'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map(({ p, s }) => {
                const selected = p.partNumber === partNumber;
                return (
                  <tr key={p.partNumber} onClick={() => { if (s.ok && !selected) { onPick(p.partNumber); onClose(); } }}
                    className={`${s.ok ? 'cursor-pointer hover:bg-brand-50' : 'text-steel-400 bg-steel-50/60 cursor-not-allowed'} ${selected ? 'bg-brand-100' : ''}`}>
                    <td className={td}><input type="radio" readOnly checked={selected} disabled={!s.ok} aria-label={`Choose ${p.partNumber}`} /></td>
                    <td className={`${td} font-mono whitespace-nowrap`}>{p.partNumber}</td>
                    <td className={td}>{p.description}</td>
                    <td className={`${td} text-xs whitespace-nowrap`}>{keyRatings(p)}</td>
                    <td className={`${td} text-xs whitespace-nowrap`}>
                      {selected ? <span className="text-brand-700 font-medium">In the design</span> : s.ok ? <span className={s.better ? 'text-green-700' : 'text-steel-600'}>{s.reason}</span> : s.reason}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-steel-200 bg-[#f7f8f9] flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 border border-steel-300 bg-white rounded-sm hover:bg-steel-50">Close</button>
        </div>
      </div>
    </div>
  );
}
