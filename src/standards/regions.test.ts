// npx tsx src/standards/regions.test.ts
import { awgNear, awgToMm2, iecColor, iecDesignation, iecMotorCurrent, iecMotorKw, isIec, mcbFor, mm2For, mm2FromAwg, regionSize, regionSpec, REGIONS, SUPPLY_INFO } from './regions';

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

eq('US unchanged', [regionSpec('US').codes.panel, regionSpec('US').supply, regionSpec('US').symbols], ['UL 508A', '480VAC-3PH', 'ansi']);
eq('Canada unchanged', [regionSpec('Canada').codes.short, regionSpec('Canada').supply], ['NFPA 79 / CSA C22.2 No. 14 / CEC', '600VAC-3PH']);
eq('unknown region falls back to US', regionSpec('Mars').value, 'US');
eq('IEC family', REGIONS.filter((r) => isIec(r.value)).map((r) => r.value), ['EU', 'Israel', 'IEC']);
eq('Israel defaults', [regionSpec('Israel').supply, regionSpec('Israel').sheet, regionSpec('Israel').designations], ['400VAC-3PH', 'A3', 'iec81346']);
eq('every region supply is in its list', REGIONS.every((r) => r.supplies.includes(r.supply)), true);
eq('400 V supply', [SUPPLY_INFO['400VAC-3PH'].hz, SUPPLY_INFO['400VAC-3PH'].neutral, SUPPLY_INFO['400VAC-3PH'].text], [50, true, '3/N/PE AC 400/230V 50Hz']);

eq('1 hp → 0.75 kW', iecMotorKw(1), 0.75);
eq('5 hp → 4 kW', iecMotorKw(5), 4);
eq('1 hp at 400 V = 1.9 A', iecMotorCurrent(1, '400VAC-3PH'), 1.9);
eq('10 hp (7.46 kW → 7.5) at 400 V = 15.5 A', iecMotorCurrent(10, '400VAC-3PH'), 15.5);
eq('5 hp at 690 V = 4.9 A', iecMotorCurrent(5, '690VAC-3PH'), 4.9);

eq('14 AWG area', awgToMm2('14 AWG'), 2.08);
eq('1/0 area', awgToMm2('1/0 AWG'), 53.48);
eq('14 AWG → 2.5 mm²', mm2FromAwg('14 AWG'), 2.5);
eq('16 AWG → 1.5 mm²', mm2FromAwg('16 AWG'), 1.5);
eq('18 AWG → 1 mm²', mm2FromAwg('18 AWG'), 1);
eq('12 AWG → 4 mm²', mm2FromAwg('12 AWG'), 4);
eq('2.5 mm² ≈ 14 AWG', awgNear(2.5), '14 AWG');
eq('16 mm² ≈ 6 AWG', awgNear(16), '6 AWG');
eq('B2 sizing 10 A → 1.5', mm2For(10), 1.5);
eq('B2 sizing 16 A → 2.5', mm2For(16), 2.5);
eq('B2 sizing 25 A → 6', mm2For(25), 6);
eq('size text, IEC', regionSize('14 AWG', 'EU'), '2.5 mm²');
eq('size text, US unchanged', regionSize('14 AWG', 'US'), '14 AWG');

eq('colours: PE', iecColor('GN/YE'), 'GN/YE');
eq('colours: power', iecColor('BK', 'M1 motor leads'), 'BK');
eq('colours: neutral', iecColor('WH', 'PS1 primary feed'), 'BU(LT)');
eq('colours: earthed transformer secondary is AC control', iecColor('WH', 'T1 secondary grounded conductor, bonded to PE'), 'RD');
eq('colours: AC control', iecColor('RD'), 'RD');
eq('colours: DC control and 0 V', [iecColor('BU'), iecColor('WH/BU')], ['BU', 'BU']);

eq('designations', ['CB1', 'MCR', 'PS1', 'M1', 'TB1', 'PB2', 'OL1', 'DS1', 'PL3', 'FU2', 'PE1'].map((t) => iecDesignation(t)), ['-Q1', '-K1', '-T1', '-M1', '-X1', '-S2', '-F1', '-Q1', '-P3', '-F2', '-B1']);
eq('MCB 1.9 A motor → 3 A', mcbFor(1.9), 3);
eq('MCB 8 A → 10 A', mcbFor(8), 10);

if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log('all passed');
