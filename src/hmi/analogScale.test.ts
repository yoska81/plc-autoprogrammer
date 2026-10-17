// npx tsx src/hmi/analogScale.test.ts
import { withAnalogScale } from './analogScale';
import { createElement } from './editor';
import type { IOPoint } from '../types/io';

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};
const io = [
  { id: 'I002', description: 'Line pressure', type: 'input', category: 'Process', signal: 'analog', analog: { range: '4-20mA', min: 0, max: 150, units: 'psi' } },
  { id: 'I001', description: 'Start', type: 'input', category: 'Operator/HMI' },
] as unknown as IOPoint[];
const addresses = new Map([['I002', 'DF1'], ['I001', 'X001']]);
const B = { w: 800, h: 480 };
const bar = createElement('bar', 'b1', 200, 200, B);
const scale = (e: { min: number | null; max: number | null; units: string | null }) => [e.min, e.max, e.units];

eq('bar bound to an analog point takes its scale', scale(withAnalogScale(bar, { ...bar, address: 'DF1' }, io, addresses)), [0, 150, 'psi']);
eq('lower-case address works', scale(withAnalogScale(bar, { ...bar, address: 'df1' }, io, addresses)), [0, 150, 'psi']);
eq('a hand-set scale is kept', scale(withAnalogScale(bar, { ...bar, max: 80, address: 'DF1' }, io, addresses)), [0, 80, null]);
eq('units set by hand are kept', scale(withAnalogScale(bar, { ...bar, units: 'bar', address: 'DF1' }, io, addresses)), [0, 100, 'bar']);
eq('a discrete address changes nothing', scale(withAnalogScale(bar, { ...bar, address: 'X001' }, io, addresses)), [0, 100, null]);
const bound = withAnalogScale(bar, { ...bar, address: 'DF1' }, io, addresses);
eq('other edits on a bound element keep its scale', scale(withAnalogScale(bound, { ...bound, label: 'Pressure', max: 120 }, io, addresses)), [0, 120, 'psi']);
const lamp = createElement('indicator', 'l1', 100, 100, B);
eq('lamps are not scaled', withAnalogScale(lamp, { ...lamp, address: 'DF1' }, io, addresses).units ?? null, null);
if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log('all passed');
