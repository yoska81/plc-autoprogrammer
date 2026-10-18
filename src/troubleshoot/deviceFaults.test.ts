/// <reference types="node" />
/**
 * Device fault knowledge: every profile is sourced, selects real parts, and its fault codes are unique.
 * Run with:  npx tsx src/troubleshoot/deviceFaults.test.ts
 */
import assert from 'node:assert/strict';
import { CATALOG } from '../electrical/catalog';
import { FOREIGN_RAW } from '../electrical/catalogs/foreignPartsData';
import { DEVICE_FAULT_DATA } from './deviceFaultData';
import { LIVE_WORK_CAUTION, faultCode, faultProfilesFor, faultsMatching, faultsOfKind, fixesFor, needsLiveWorkCaution, profileMatches, readingsFor, symptomKindOf, type DeviceFaultProfile, type FaultEntry, type TerminalCheck } from './deviceFaults';

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
      if (codes.has(f.code.toLowerCase().replace(/[\s.]+/g, ''))) bad.push(`${d.id}: code ${f.code} twice`);
      codes.add(f.code.toLowerCase().replace(/[\s.]+/g, ''));
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
assert.equal(faultCode(part, ' o.C ', [generic, specific])?.fault.title, 'Overcurrent', 'spaces and dots ignored');
// Symptom kinds: set in the data wins; else a code means a displayed code; else from the wording.
const fe = (title: string, symptom: string, extra: Partial<FaultEntry> = {}): FaultEntry => ({ title, symptom, causes: [], confirm: ['x'], fix: ['y'], source: 'https://example.com', ...extra });
assert.equal(symptomKindOf(fe('Input signal on but input LED off', 'Sensor detecting but the X LED stays off')), 'no-input');
assert.equal(symptomKindOf(fe('Output LED on but load not energized', 'Y LED is on but the field device does not operate.')), 'output-no-motion');
assert.equal(symptomKindOf(fe('Welded contacts', 'Motor keeps running after coil de-energized')), 'stuck-on');
assert.equal(symptomKindOf(fe('Short-circuit trip', 'Trips instantly')), 'trips');
assert.equal(symptomKindOf(fe('Overcurrent', 'trips', { code: 'oc' })), 'display-code');
assert.equal(symptomKindOf(fe('Odd', 'anything', { symptomKind: 'stuck-on' })), 'stuck-on');
assert.deepEqual(faultsOfKind(part, 'display-code', [generic, specific]).map((x) => x.profile.id), ['t-gs20', 't-vfd']);
// Safety gates every consumer goes through: STO-jumper fixes only when the project has NO STO wiring (unknown = wired).
const stoFault = fe('STO open', 'drive will not run', { fix: ['Check the safety circuit.'], fixIfNoStoWiring: ['Refit the factory STO jumper. Only if the drawings show no STO wiring. Never jumper a wired STO circuit.'] });
assert.deepEqual(fixesFor(stoFault, { stoWired: true }), ['Check the safety circuit.']);
assert.deepEqual(fixesFor(stoFault, {}), ['Check the safety circuit.'], 'unknown STO wiring counts as wired');
assert.equal(fixesFor(stoFault, { stoWired: false }).length, 2);
// Live work is decided by what the terminals connect to, not by the reading: a breaker line-load drop of 0.1 V is still live.
const r = (terminals: string, expected: string, extra: Partial<TerminalCheck> = {}): TerminalCheck => ({ terminals, state: 's', meter: 'VDC', expected, ...extra });
assert.ok(needsLiveWorkCaution(r('line to load terminal of one closed pole', 'about 0.13 V')));
assert.ok(needsLiveWorkCaution(r('L1 to T1', '<= 1.45 Vrms', { meter: 'VAC', pins: [['L1', 'T1']] })));
assert.ok(needsLiveWorkCaution(r('A1 to A2', '24-240 VAC/DC')));
assert.ok(!needsLiveWorkCaution(r('X001 to C1', '20-28 VDC', { pins: [['X001', 'C1']] })));
const prof: DeviceFaultProfile = { ...generic, normal: [r('R/L1 to S/L2', '400 VAC', { meter: 'VAC' }), r('+24V to DCM', '24 VDC')] };
assert.deepEqual(readingsFor(prof).map((x) => x.caution), [LIVE_WORK_CAUTION, undefined]);
// Every STO-jumper text in the data sits behind the gate, not in the plain fixes: in any STO / safe-torque fault, no plain
// fix or check may mention a jumper, a short-circuit line / plug / device / block or a bridge (unless it says "Never").
const STO_FAULT = /\bSTO\b|\bSrL\d|safe(ty)? torque|safe disable|safety input|\bS1, S2\b|H1-HC/i;
const BYPASS = /jumpers?|short[- ]?circuit (line|plug|device|block)|bridge/i;
const ungated = DEVICE_FAULT_DATA.flatMap((d) => d.faults
  .filter((f) => STO_FAULT.test(`${f.code ?? ''} ${f.title} ${f.symptom} ${f.causes.join(' ')}`))
  .flatMap((f) => [...f.fix, ...f.confirm].filter((s) => BYPASS.test(s) && !/\bnever\b/i.test(s)).map((s) => `${d.id} ${f.code ?? f.title}: ${s.slice(0, 70)}`)));
assert.deepEqual(ungated, [], 'STO jumper / bypass fixes must be in fixIfNoStoWiring');
const gatedWithoutWarning = DEVICE_FAULT_DATA.flatMap((d) => d.faults.flatMap((f) => (f.fixIfNoStoWiring ?? []).filter((s) => !/never jumper (a )?wired STO/i.test(s))));
assert.deepEqual(gatedWithoutWarning, [], 'every gated STO fix carries the never-jumper warning');
// Steps that move machinery by hand (forced outputs, valve manual overrides) carry the keep-clear warning.
const unwarned = DEVICE_FAULT_DATA.flatMap((d) => d.faults.flatMap((f) => [...f.confirm, ...f.fix].filter((s) => /\b(override feature|operate the manual override|freeing the spool with the manual override|push-button manual override|untwist\) the manual override)/i.test(s) && !/keep everyone clear/i.test(s)).map((s) => `${d.id}: ${s.slice(0, 60)}`)));
assert.deepEqual(unwarned, [], 'force / manual-override steps need the keep-clear warning');
console.log(`device fault tests passed (${DEVICE_FAULT_DATA.length} profiles, ${DEVICE_FAULT_DATA.reduce((n, d) => n + d.faults.length, 0)} faults)`);
