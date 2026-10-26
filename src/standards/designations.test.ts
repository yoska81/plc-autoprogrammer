// npx tsx src/standards/designations.test.ts
import { designationMap, renameTags } from './designations';

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};
const map = designationMap(['CB1', 'CB2', 'DS1', 'K1', 'MCR', 'SR1', 'PS1', 'T1', 'PB1', 'PB2', 'ES1', 'PL1', 'M1', 'FU1', 'FU1A', 'PRS1', 'SOL1', 'JB1', 'K1-AUX']);
eq('breakers and disconnect share Q, renumbered', [map.get('CB1'), map.get('CB2'), map.get('DS1')], ['-Q1', '-Q2', '-Q3']);
eq('relays and contactors share K', [map.get('K1'), map.get('MCR'), map.get('SR1')], ['-K1', '-K2', '-K3']);
eq('power supply and transformer share T', [map.get('PS1'), map.get('T1')], ['-T1', '-T2']);
eq('buttons and E-stop share S', [map.get('ES1'), map.get('PB1'), map.get('PB2')], ['-S1', '-S2', '-S3']);
eq('motor, solenoid M; sensor B; lamp P; JB U', [map.get('M1'), map.get('SOL1'), map.get('PRS1'), map.get('PL1'), map.get('JB1')], ['-M1', '-M2', '-B1', '-P1', '-U1']);
eq('suffixes kept', [renameTags('FU1A', map), renameTags('K1-AUX', map), renameTags('CB1:T1', map)], ['-F1A', '-K1-AUX', '-Q1:T1']);
eq('text', renameTags('K1 aux contact for M1, fed from CB2', map), '-K1 aux contact for -M1, fed from -Q2');
eq('wire numbers', renameTags('M1-L1', map), '-M1-L1');
eq('PLC addresses and words untouched', renameTags('X001 Y002 DF1 PE BAR MAIN', map), 'X001 Y002 DF1 PE BAR MAIN');
eq('unknown tags untouched', renameTags('TB1 ENC1', map), 'TB1 ENC1');
if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log('all passed');
