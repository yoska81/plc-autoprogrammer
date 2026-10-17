// npx tsx src/standards/iecModel.test.ts — the electrical model in an IEC region (fixture switched to 400 V 50 Hz).
import { realCatalogContext } from '../electrical/drawings/__fixtures__/realCatalog';
import { buildModel, designWarnings, panelNameplate, wireNumbers } from '../electrical/derive';
import type { DrawingContext } from '../electrical/derive';
import { withDrawingOptions } from './drawingOptions';
import { powerText, enclosureText, sheetOnPaper } from './regions';

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

// IEC 81346 designations: terminal strips -X1…, wire numbers without the prefix sign.
const iec = withDrawingOptions(ctx, { region: 'EU' });
const im = buildModel(iec);
ok('terminal strips are -X1, -X2…', im.strips.length > 0 && im.strips.every((s) => /^-X\d+$/.test(s.tag)), im.strips.map((s) => s.tag).join(','));
const iw = wireNumbers(iec);
ok('no TB strip left in the wire list', iw.every((w) => !/\bTB\d/.test(`${w.from} ${w.to}`)), iw.filter((w) => /\bTB\d/.test(`${w.from} ${w.to}`)).map((w) => w.from).slice(0, 3).join(','));
ok('wire numbers carry no prefix sign', iw.every((w) => !w.wire.startsWith('-')), iw.filter((w) => w.wire.startsWith('-')).map((w) => w.wire).slice(0, 4).join(','));
ok('motor wires numbered M1-L1…', im.motors.every((x) => x.lineWires.every((w) => w === 'N' || /^M\d+-L\d$/.test(w))), im.motors.flatMap((x) => x.lineWires).join(','));
ok('US keeps TB strips', buildModel(base).strips.every((s) => /^TB\d+$/.test(s.tag)));
ok('power in kW for IEC, HP for the US', powerText(1.00576, 'EU') === '0.75 kW' && powerText(1, 'US') === '1 HP');
ok('IP rating for IEC enclosures', enclosureText('NEMA 12', 'EU') === 'IP54' && enclosureText('NEMA 12', 'US') === 'NEMA 12');
const mmOf = (x: string) => parseFloat(x.replace(',', '.'));
const busMm = Math.min(...iw.filter((w) => /^Main power bus/.test(w.function)).map((w) => mmOf(w.size)));
const feedMm = Math.max(...iw.filter((w) => /primary feed/.test(w.function)).map((w) => mmOf(w.size)));
ok('the main bus is not thinner than the power-supply feed it supplies', busMm >= feedMm, `bus ${busMm} mm², feed ${feedMm} mm²`);
const a3 = sheetOnPaper('A3');
ok('A3: the sheet fills the A3 page; content scaled into its drawing area', a3.w === 420 && a3.h === 297 && a3.x === 0 && a3.factor < 1 && a3.factor > 0.96);
ok('ANSI B: unchanged', sheetOnPaper('ANSI B').factor === 1 && sheetOnPaper('ANSI B').tx === 0 && sheetOnPaper('ANSI B').ty === 0);

if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log('all passed');
