/// <reference types="node" />
/**
 * Cabinet STEP export checks. Run with:  npx tsx src/electrical/step/cabinetStep.test.ts
 * (Full B-rep validation with OpenCascade is done outside the repo; this checks determinism,
 * that no detailed shape had to fall back to a plain box, and the summary envelopes.)
 */
import assert from 'node:assert/strict';
import { cabinetStep, cabinetStepSummary } from './cabinetStep';
import { sampleContext } from '../drawings/__fixtures__/sample';
import { realCatalogCanadaContext, realCatalogContext } from '../drawings/__fixtures__/realCatalog';

const cases = [
  ['sample', sampleContext(), {}],
  ['sample reversing + HMI', sampleContext({ reversing: true }), { hmiPartNumber: 'CM5-T7W' }],
  ['real catalog', realCatalogContext(), {}],
  ['real catalog, no door', realCatalogContext(), { includeDoor: false }],
  ['Canada 600 V', realCatalogCanadaContext(), {}],
] as const;

for (const [name, ctx, opts] of cases) {
  const a = cabinetStep(ctx, opts);
  assert.equal(a, cabinetStep(ctx, opts), `${name}: output must be deterministic`);
  assert.ok(a.startsWith('ISO-10303-21;') && a.trimEnd().endsWith('END-ISO-10303-21;'), `${name}: Part 21 framing`);
  assert.ok(a.length < 8e6, `${name}: file size ${a.length}`);
  const s = cabinetStepSummary(ctx, opts);
  assert.deepEqual(s.bodies.filter((b) => b.simplified).map((b) => b.name), [], `${name}: every shape builds`);
  for (const b of s.bodies) {
    assert.ok(/ - /.test(b.name), `${name}: "${b.name}" is named TAG - PARTNUMBER`);
    assert.ok(b.size.every((v) => v > 0), `${name}: ${b.name} has a size`);
    if (b.assembly === 'backPanel' && b.kind !== 'backPanel') {
      // Back-panel bodies stay inside the enclosure.
      assert.ok(b.min[0] >= 0 && b.min[0] + b.size[0] <= s.enclosure.w + 1e-6, `${name}: ${b.name} inside in X`);
      assert.ok(b.min[1] + b.size[1] <= s.enclosure.d, `${name}: ${b.name} inside in Y`);
    }
  }
}
console.log('cabinetStep tests passed');
