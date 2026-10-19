/// <reference types="node" />
/**
 * Machine-level symptom maps: every cause is sourced, ranked, and points at real device profiles.
 * Run with:  npx tsx src/troubleshoot/machineSymptoms.test.ts
 */
import assert from 'node:assert/strict';
import { DEVICE_FAULT_DATA } from './deviceFaultData';
import { MACHINE_SYMPTOM_DATA } from './machineSymptomData';
import { findSymptom, rankedCauses, symptomMap, type MachineSymptomMap } from './machineSymptoms';

const isUrl = (s: string) => { try { return new URL(s.split(/\s/)[0]).protocol === 'https:'; } catch { return false; } };
const profileIds = new Set(DEVICE_FAULT_DATA.map((d) => d.id));

const bad: string[] = [];
for (const m of MACHINE_SYMPTOM_DATA) {
  if (!m.sources.length || !m.sources.every(isUrl)) bad.push(`${m.machineType}: sources must be https URLs`);
  const ids = new Set<string>();
  for (const s of m.symptoms) {
    if (ids.has(s.id)) bad.push(`${m.machineType}/${s.id}: duplicate id`);
    ids.add(s.id);
    if (!s.causes.length) bad.push(`${m.machineType}/${s.id}: no causes`);
    for (const c of s.causes) {
      const where = `${m.machineType}/${s.id}/${c.cause}`;
      if (!isUrl(c.source)) bad.push(`${where}: source must start with an https URL`);
      if (!(c.rank >= 1) || !c.checks.length || !c.fix.length) bad.push(`${where}: rank, checks and fix are required`);
      if (!(c.devices.profileIds?.length || c.devices.categories?.length)) bad.push(`${where}: names no device`);
      for (const id of c.devices.profileIds ?? []) if (!profileIds.has(id)) bad.push(`${where}: unknown device profile '${id}'`);
    }
  }
}
assert.deepEqual(bad, []);

// Lookups on a synthetic map.
const demo: MachineSymptomMap = {
  machineType: 'demo-shear', title: 'Demo shear', aliases: ['roll former', 'flying shear'], sources: ['https://example.com/a.pdf'],
  symptoms: [{ id: 'cut-length-wrong', symptom: 'Cut length wrong or drifting', aliases: ['parts too long'], causes: [
    { rank: 2, cause: 'b', devices: { categories: ['encoder'] }, checks: ['x'], fix: ['y'], source: 'https://example.com/a.pdf' },
    { rank: 1, cause: 'a', devices: { categories: ['encoder'] }, checks: ['x'], fix: ['y'], source: 'https://example.com/a.pdf' },
  ] }],
};
assert.equal(symptomMap('Roll Former line 3', [demo])?.machineType, 'demo-shear');
assert.equal(findSymptom(demo, 'parts too long')?.id, 'cut-length-wrong');
assert.equal(findSymptom(demo, 'length drifting')?.id, 'cut-length-wrong');
assert.equal(findSymptom(demo, 'the parts are too long')?.id, 'cut-length-wrong', 'filler words ignored');
assert.equal(findSymptom(demo, 'cut length keeps changing on the line')?.id, 'cut-length-wrong', 'best overlap when not every word matches');
assert.equal(findSymptom(demo, 'hydraulic oil leaking'), undefined, 'no match below two shared words');
assert.deepEqual(rankedCauses(demo.symptoms[0]).map((c) => c.cause), ['a', 'b']);
console.log(`machine symptom tests passed (${MACHINE_SYMPTOM_DATA.length} machine types)`);

// Lazy loading: the lookups see nothing until loadFaultKnowledge() resolves, then the real data.
const { loadFaultKnowledge, loadedFaults } = await import('./knowledge');
assert.equal(symptomMap('roll former'), undefined, 'not loaded yet');
await loadFaultKnowledge();
assert.equal(symptomMap('roll former')?.machineType, 'roll-former-flying-shear');
assert.ok(loadedFaults().length > 0);
console.log('knowledge lazy-load test passed');
