/** Panel SCCR (UL 508A SB4): conditional catalog ratings count only when the design meets their condition. */
import assert from 'node:assert/strict';
import { DESIGN } from '../preview/sampleProject';
import { getPart } from './catalog';
import type { CatalogPart } from './types';
import type { DrawingContext, ResolvedComponent } from './derive';
import { conditionMet, panelSccr, shortCondition } from './sccr';

let passed = 0;
const failures: string[] = [];
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { failures.push(name); console.log(`  FAIL ${name}\n       ${(e as Error).message.split('\n').join('\n       ')}`); }
}

const rc = (tag: string, category: string, ratings: Record<string, unknown>, description = '', fuse?: Record<string, unknown>): ResolvedComponent =>
  ({ tag, partNumber: tag, category, part: { ratings, description } as unknown as CatalogPart, fuse: fuse ? ({ ratings: fuse, description: '' } as unknown as CatalogPart) : undefined } as unknown as ResolvedComponent);

test('fuse class and amp limit', () => {
  const ccHolder = rc('FU1', 'fuse', { fuseClass: 'CC' }, 'Class CC fuse holder', { fuseClass: 'CC', amps: 10 });
  assert.equal(conditionMet('with Class CC fuses, 30 A max.', ccHolder).met, true);
  assert.equal(conditionMet('with Class J fuses', ccHolder).met, false, 'J required, CC fitted');
  assert.equal(conditionMet('with Class CC fuses, 6 A max.', ccHolder).met, false, '10 A fitted, 6 A allowed');
});

test('class lists and the short form of catalog prose', () => {
  const yaskawa = '100 kA at 480 V max with Bussmann FWH-80BC semiconductor fuse or Class CC/J/T time-delay fuse max 30 A, drive in a protected enclosure';
  assert.equal(conditionMet(yaskawa, rc('FU2', 'fuse', { fuseClass: 'J' }, '', { fuseClass: 'J', amps: 20 })).met, true, 'J is one of CC/J/T');
  assert.equal(conditionMet(yaskawa, rc('FU2', 'fuse', { fuseClass: 'RK5' }, '', { fuseClass: 'RK5', amps: 20 })).met, false);
  assert.equal(conditionMet(yaskawa, rc('FU2', 'fuse', { fuseClass: 'CC' }, '', { fuseClass: 'CC', amps: 35 })).met, false, '35 A > 30 A max.');
  assert.equal(shortCondition(yaskawa), 'Class CC/J/T fuses, 30 A max.');
  assert.equal(shortCondition('UL installations must use the Appendix A fuses: Class T 10 A (TJS10) for this 460 V model'), 'Class T fuses');
  const gs20 = 'UL installations must use the Appendix A fuses: Class T 10 A (TJS10) for this 460 V model. Chart also lists high-speed Class J JHL10 (non-UL only) and a 15 A circuit breaker';
  assert.equal(shortCondition(gs20), 'Class T fuses', 'non-UL Class J left out');
  assert.equal(conditionMet(gs20, rc('FU3', 'fuse', { fuseClass: 'J' }, '', { fuseClass: 'J', amps: 10 })).met, false, 'Class J is non-UL only');
});

test('breaker, Type E and unknown wording', () => {
  const cb = rc('CB1', 'breaker', { branchRated: 'yes', amps: 15 });
  const supp = rc('CB2', 'breaker', { branchRated: 'no (UL 1077)' });
  assert.equal(conditionMet('with an inverse-time circuit breaker 20 A max.', cb).met, true);
  assert.equal(conditionMet('with a circuit breaker', supp).met, false, 'supplementary protector');
  assert.equal(conditionMet('with Type E self-protected starter', cb).met, false);
  assert.equal(conditionMet('when fed from a listed transformer', cb).met, false, 'not checkable -> not met');
  assert.equal(conditionMet('with Class J fuses', undefined).met, false, 'no protection');
});

test('example panel: the disconnect condition is a requirement on the upstream protection', () => {
  const ctx: DrawingContext = {
    projectName: 'test', design: DESIGN, getPart, region: 'US',
    plc: { vendor: 'AutomationDirect', name: 'CLICK', cpuPartNumber: 'C0-10DD1E-D', cpuLabel: '' },
    io: DESIGN.ioWiring.map((w) => ({ address: w.address, description: w.description, type: w.address.startsWith('X') ? 'input' : 'output' })),
  };
  const sc = panelSccr(ctx);
  const ds = sc.rows.find((r) => r.tag === 'DS1')!;
  assert.ok(ds && ds.condition && ds.met, JSON.stringify(ds));
  assert.ok(sc.conditions.some((c) => c.tag === 'DS1' && /upstream/.test(c.condition)));
  assert.ok(!sc.unmet.length, JSON.stringify(sc.unmet));
  // power supplies publish no SCCR: listed for the SB4 exemption check, never blocking the panel value
  assert.ok(sc.exemptCheck.includes('PS1') && !sc.unknown.includes('PS1'), JSON.stringify({ e: sc.exemptCheck, u: sc.unknown }));
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
