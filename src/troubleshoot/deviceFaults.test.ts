/// <reference types="node" />
/**
 * Device fault knowledge: every profile is sourced, selects real parts, and its fault codes are unique.
 * Run with:  npx tsx src/troubleshoot/deviceFaults.test.ts
 */
import assert from 'node:assert/strict';
import { CATALOG } from '../electrical/catalog';
import { FOREIGN_RAW } from '../electrical/catalogs/foreignPartsData';
import { DEVICE_FAULT_DATA } from './deviceFaultData';
import { faultCode, faultProfilesFor, faultsMatching, faultsOfKind, profileMatches, symptomKindOf, type DeviceFaultProfile, type FaultEntry } from './deviceFaults';

const isUrl = (s: string) => { try { return /^https:$/.test(new URL(s.split(/\s/)[0]).protocol); } catch { return false; } };
// Imported parts (Inovance drives …) are matched too: the drawing converter and the troubleshooter see them.
const pool = [...CATALOG, ...FOREIGN_RAW];

const bad: string[] = [];
const ids = new Set<string>();
for (const d of DEVICE_FAULT_DATA) {
  if (ids.has(d.id)) bad.push(`${d.id}: duplicate id`);
  ids.add(d.id);
  if (!d.sources.length || !d.sources.every(isUrl)) bad.push(`${d.id}: sources must be https URLs`);
  if (!pool.some((p) => profileMatches(d.match, p))) bad.push(`${d.id}: match selects no catalog or imported part`);
  if (!d.normal.length && !d.indicators.length && !d.faults.length) bad.push(`${d.id}: empty`);
  const codes = new Set<string>();
  for (const f of d.faults) {
    if (!isUrl(f.source)) bad.push(`${d.id} / ${f.code ?? f.title}: source must start with an https URL`);
    if (!f.title.trim() || !f.symptom.trim() || !f.confirm.length || !f.fix.length) bad.push(`${d.id} / ${f.code ?? f.title}: title, symptom, confirm and fix are required`);
    if (f.code) {
      if (codes.has(f.code.toLowerCase())) bad.push(`${d.id}: code ${f.code} twice`);
      codes.add(f.code.toLowerCase());
    }
  }
  for (const p of d.pairs ?? []) if (!p.a.trim() || !p.b.trim() || !p.when.trim() || p.a === p.b) bad.push(`${d.id}: bad pair ${p.a}-${p.b}`);
  const pin = /^[A-Za-z0-9+\-/.]+$/;
  for (const t of d.normal) for (const [a, b] of t.pins ?? []) if (!pin.test(a) || !pin.test(b) || a === b) bad.push(`${d.id}: pin pair '${a}'-'${b}' (plain pin names, as in the wire list)`);
  for (const p of d.pairs ?? []) if (!pin.test(p.a) || !pin.test(p.b)) bad.push(`${d.id}: pair pins '${p.a}'-'${p.b}' (plain pin names)`);
  for (const t of d.normal) if (!t.terminals.trim() || !t.state.trim() || !t.expected.trim()) bad.push(`${d.id}: incomplete normal reading`);
}
assert.deepEqual(bad, []);

// Lookups on a synthetic profile: specific beats generic, codes are case-insensitive, words all must match.
const part = CATALOG.find((p) => profileMatches({ categories: ['vfd'], family: 'GS20' }, p))!;
const generic: DeviceFaultProfile = { id: 't-vfd', title: 'VFD', match: { categories: ['vfd'] }, normal: [], indicators: [], sources: ['https://example.com/a.pdf'],
  faults: [{ code: 'oc', title: 'generic', symptom: 'trips', causes: ['x'], confirm: ['y'], fix: ['z'], source: 'https://example.com/a.pdf' }] };
const specific: DeviceFaultProfile = { ...generic, id: 't-gs20', match: { categories: ['vfd'], family: 'GS20' },
  faults: [{ code: 'oc', title: 'Overcurrent', symptom: 'trips on acceleration', causes: ['short accel time'], confirm: ['read fault record'], fix: ['raise accel time'], source: 'https://example.com/b.pdf' }] };
assert.deepEqual(faultProfilesFor(part, [generic, specific]).map((d) => d.id), ['t-gs20', 't-vfd']);
assert.equal(faultCode(part, 'OC', [generic, specific])?.fault.title, 'Overcurrent');
assert.equal(faultsMatching(part, 'trips acceleration', [generic, specific]).length, 1);
assert.equal(faultCode(part, 'nope', [generic, specific]), undefined);
// Symptom kinds: set in the data wins; else a code means a displayed code; else from the wording.
const fe = (title: string, symptom: string, extra: Partial<FaultEntry> = {}): FaultEntry => ({ title, symptom, causes: [], confirm: ['x'], fix: ['y'], source: 'https://example.com', ...extra });
assert.equal(symptomKindOf(fe('Input signal on but input LED off', 'Sensor detecting but the X LED stays off')), 'no-input');
assert.equal(symptomKindOf(fe('Output LED on but load not energized', 'Y LED is on but the field device does not operate.')), 'output-no-motion');
assert.equal(symptomKindOf(fe('Welded contacts', 'Motor keeps running after coil de-energized')), 'stuck-on');
assert.equal(symptomKindOf(fe('Short-circuit trip', 'Trips instantly')), 'trips');
assert.equal(symptomKindOf(fe('Overcurrent', 'trips', { code: 'oc' })), 'display-code');
assert.equal(symptomKindOf(fe('Odd', 'anything', { symptomKind: 'stuck-on' })), 'stuck-on');
assert.deepEqual(faultsOfKind(part, 'display-code', [generic, specific]).map((x) => x.profile.id), ['t-gs20', 't-vfd']);
console.log(`device fault tests passed (${DEVICE_FAULT_DATA.length} profiles, ${DEVICE_FAULT_DATA.reduce((n, d) => n + d.faults.length, 0)} faults)`);
