import { ANALOG_RANGES, type AnalogRange, type AnalogSpec, type IOPoint } from '../../../types/io';
import { useIOStore } from '../../../store/useIOStore';

const DEFAULT: AnalogSpec = { range: '4-20mA', min: 0, max: 100, units: '%' };
const box = 'rounded-sm border border-steel-300 bg-white px-1 py-0.5 text-xs focus:border-brand-500 focus:outline-none';

/** Discrete / analog switch for an I/O point, with range and engineering-unit scaling when analog. */
export default function AnalogCell({ point }: { point: IOPoint }) {
  const setAnalog = useIOStore((s) => s.setAnalog);
  const a = point.signal === 'analog' ? point.analog ?? DEFAULT : null;
  const set = (patch: Partial<AnalogSpec>) => setAnalog(point.id, { ...(a ?? DEFAULT), ...patch });
  const num = (v: string, fallback: number) => (Number.isFinite(Number(v)) && v.trim() !== '' ? Number(v) : fallback);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <button type="button" onClick={() => setAnalog(point.id, a ? null : DEFAULT)} aria-pressed={Boolean(a)}
        title={a ? 'Analog signal (4-20 mA / 0-10 V) on an analog channel — click for discrete' : 'Discrete on/off point — click to make it analog'}
        className={`rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold ${a ? 'border-brand-600 bg-brand-600 text-brand-950' : 'border-steel-300 bg-white text-steel-500 hover:bg-steel-50'}`}>
        {a ? 'Analog' : 'Discrete'}
      </button>
      {a && (
        <>
          <select aria-label={`Signal range of ${point.id}`} value={a.range} onChange={(e) => set({ range: e.target.value as AnalogRange })} className={box}>
            {ANALOG_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <input aria-label={`Scale minimum of ${point.id}`} defaultValue={a.min} key={`min${a.min}`} onBlur={(e) => set({ min: num(e.target.value, a.min) })} className={`${box} w-12 text-right`} />
          <span className="text-xs text-steel-400">–</span>
          <input aria-label={`Scale maximum of ${point.id}`} defaultValue={a.max} key={`max${a.max}`} onBlur={(e) => set({ max: num(e.target.value, a.max) })} className={`${box} w-14 text-right`} />
          <input aria-label={`Units of ${point.id}`} defaultValue={a.units} key={`u${a.units}`} onBlur={(e) => set({ units: e.target.value.trim() })} placeholder="units" className={`${box} w-12`} />
        </>
      )}
    </div>
  );
}
