import { useProjectStore } from '../store/useProjectStore';
import { useElectricalStore } from '../store/useElectricalStore';
import { regionSpec, type Region } from './regions';

/**
 * Switch the open project to another region: its standards, and — when the current supply is not
 * used there (e.g. 480 V 60 Hz in Europe) — the region's default supply for the panel and motors.
 */
export function applyRegion(region: Region) {
  const r = regionSpec(region);
  useProjectStore.getState().setInfo({ region: r.value, standards: r.standards });
  const el = useElectricalStore.getState();
  const fix = (v: (typeof r.supplies)[number]) => (r.supplies.includes(v) ? v : r.supply);
  if (!r.supplies.includes(el.inputs.supply) || el.inputs.motors.some((m) => !r.supplies.includes(m.voltage))) {
    el.setInputs({ ...el.inputs, supply: fix(el.inputs.supply), motors: el.inputs.motors.map((m) => ({ ...m, voltage: fix(m.voltage) })) });
  }
}

/** "Europe (CE / UKCA) — IEC 60204-1 / IEC 61439" style label for selects. */
export const regionOption = (r: Region) => `${regionSpec(r).label} — ${regionSpec(r).codes.short}`;
