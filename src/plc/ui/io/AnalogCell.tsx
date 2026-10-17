import { useState } from 'react';
import { ANALOG_RANGES, type AnalogRange, type AnalogSpec, type IOPoint } from '../../../types/io';
import { useIOStore } from '../../../store/useIOStore';
import { useProjectStore } from '../../../store/useProjectStore';

const DEFAULT: AnalogSpec = { range: '4-20mA', min: 0, max: 100, units: '%' };
const box = 'rounded-sm border border-steel-300 bg-white px-1 py-0.5 text-xs focus:border-brand-500 focus:outline-none';

/** Analog modules to suggest when the PLC has no free analog channel, per PLC family. */
const ANALOG_MODULES: Record<string, { input: string; output: string }> = {
  click: { input: 'C0-04AD-1', output: 'C0-04DA-1' },
  logix: { input: '5069-IF8', output: '5069-OF8' },
};

/**
 * Discrete / analog switch for an I/O point, with range and engineering-unit scaling when analog.
 * `address` = the resolved PLC address: empty for an analog point means no free analog channel.
 */
export default function AnalogCell({ point, address }: { point: IOPoint; address?: string }) {
  const plcId = useProjectStore((s) => s.plcId);
  const setAnalog = useIOStore((s) => s.setAnalog);
  const a = point.signal === 'analog' ? point.analog ?? DEFAULT : null;
  const set = (patch: Partial<AnalogSpec>) => setAnalog(point.id, { ...(a ?? DEFAULT), ...patch });
  const num = (v: string, fallback: number) => (Number.isFinite(Number(v)) && v.trim() !== '' ? Number(v) : fallback);
  // The scale must rise: a minimum at or above the maximum is refused (the field goes back) with a note.
  const [scaleError, setScaleError] = useState<string | null>(null);
  const setScale = (el: HTMLInputElement, which: 'min' | 'max') => {
    if (!a) return;
    const v = num(el.value, a[which]);
    const lo = which === 'min' ? v : a.min, hi = which === 'max' ? v : a.max;
    if (lo >= hi) { el.value = String(a[which]); setScaleError(`The scale minimum must be below the maximum (${a.min} – ${a.max} kept).`); return; }
    setScaleError(null);
    set({ [which]: v });
  };
  return (
    <div className="flex flex-wrap items-center gap-1">
      <button type="button" onClick={() => setAnalog(point.id, a ? null : DEFAULT)} aria-pressed={Boolean(a)}
        title={a ? 'Analog signal (4-20 mA / 0-10 V) on an analog channel — click for discrete' : 'Discrete on/off point — click to make it analog'}
        className={`rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold ${a ? 'border-brand-600 bg-brand-600 text-white' : 'border-steel-300 bg-white text-steel-500 hover:bg-steel-50'}`}>
        {a ? 'Analog' : 'Discrete'}
      </button>
      {a && (
        <>
          <select aria-label={`Signal range of ${point.id}`} value={a.range} onChange={(e) => set({ range: e.target.value as AnalogRange })} className={box}>
            {ANALOG_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <input aria-label={`Scale minimum of ${point.id}`} defaultValue={a.min} key={`min${a.min}`} onBlur={(e) => setScale(e.target, 'min')} className={`${box} w-12 text-right`} />
          <span className="text-xs text-steel-400">–</span>
          <input aria-label={`Scale maximum of ${point.id}`} defaultValue={a.max} key={`max${a.max}`} onBlur={(e) => setScale(e.target, 'max')} className={`${box} w-14 text-right`} />
          <input aria-label={`Units of ${point.id}`} defaultValue={a.units} key={`u${a.units}`} onBlur={(e) => set({ units: e.target.value.trim() })} placeholder="units" className={`${box} w-12`} />
          {scaleError && <span role="alert" className="basis-full text-[11px] text-red-700">{scaleError}</span>}
          {address === '' && (
            <span role="note" className="basis-full text-[11px] text-amber-800">
              No analog channel for this point: add an analog {point.type} module
              {ANALOG_MODULES[plcId] ? ` (${point.type === 'input' ? ANALOG_MODULES[plcId].input : ANALOG_MODULES[plcId].output})` : ''} on the Equipment page.
            </span>
          )}
        </>
      )}
    </div>
  );
}
