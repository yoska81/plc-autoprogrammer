// npx tsx src/standards/iecModel.test.ts — the electrical model in an IEC region (fixture switched to 400 V 50 Hz).
import { realCatalogContext } from '../electrical/drawings/__fixtures__/realCatalog';
import { buildModel, designWarnings, panelNameplate, wireNumbers } from '../electrical/derive';
import type { DrawingContext } from '../electrical/derive';

let failed = 0;
const ok = (name: string, cond: boolean, info = '') => { if (!cond) failed++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${cond ? '' : ` ${info}`}`); };

const base = realCatalogContext();
const to400 = (c: DrawingContext): DrawingContext => ({
  ...c, region: 'EU',
  design: { ...c.design, inputs: { ...c.design.inputs, supply: '400VAC-3PH', motors: c.design.inputs.motors.map((m) => ({ ...m, voltage: '400VAC-3PH' })) } },
});
const ctx = to400(base);
const wires = wireNumbers(ctx);
ok('no AWG sizes left', wires.every((w) => !/AWG/.test(w.size)), wires.filter((w) => /AWG/.test(w.size)).map((w) => w.size).join(','));
ok('sizes in mm²', wires.every((w) => /mm²$/.test(w.size)));
ok('no NFPA white or white/blue', wires.every((w) => !['WH', 'WH/BU'].includes(w.color)), [...new Set(wires.map((w) => w.color))].join(','));
ok('PE is green-yellow', wires.filter((w) => w.wire === 'PE').every((w) => w.color === 'GN/YE'));
ok('24 V DC panel wiring is blue (sensor cable cores keep their colours)', wires.filter((w) => (w.wire === '24+' || w.wire === '0V') && !/CABLE/.test(w.color)).every((w) => w.color === 'BU'));
const m = buildModel(ctx);
ok('motor current from IEC 60947-4-1 Annex G', m.motors.every((x) => x.fla > 0 && x.fla < 100), m.motors.map((x) => x.fla).join(','));
ok('nameplate 50 Hz', panelNameplate(ctx).hz === 50);
ok('no region mismatch warning', !designWarnings(ctx).some((w) => w.startsWith('The design is for')));
ok('mismatch warned when the US design is used in Europe', designWarnings({ ...base, region: 'EU' }).some((w) => w.startsWith('The design is for')));
ok('US unchanged: AWG sizes', wireNumbers(base).some((w) => /AWG/.test(w.size)));

if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log('all passed');
