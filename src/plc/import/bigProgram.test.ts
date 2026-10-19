/// <reference types="node" />
/**
 * A big program (hundreds of parts, thousands of rungs, counters and I/O) is read and planned in seconds:
 * the steps that once looked every name or rung up again for each one took minutes. Programs made here.
 * Run with:  npx tsx src/plc/import/bigProgram.test.ts
 */
import assert from 'node:assert/strict';
import { importProgramFiles } from './index';
import { planUpgrade } from './upgrade';
import { l5x, plcopen } from './__fixtures__/bigPrograms';

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log('  ok ', name); };
const seconds = (fn: () => void) => { const t = performance.now(); fn(); return (performance.now() - t) / 1000; };

// Before the fixes these sizes took about 45 s (PLCopen) and 30 s (L5X); now 1–3 s each.
for (const [name, text] of [['big.xml', plcopen(800, 1600)], ['big.L5X', l5x(300, 1024)]] as const) {
  test(`${name} (${(text.length / 1e6).toFixed(1)} MB) is read and planned in seconds`, () => {
    let program!: ReturnType<typeof importProgramFiles>['program'];
    const read = seconds(() => { program = importProgramFiles([{ name, text }]).program; });
    let rungs = 0;
    const plan = seconds(() => { rungs = planUpgrade(program, 'logix').program.rungs.length; });
    assert.ok(rungs > 10000, `${rungs} rungs`);
    assert.ok(program.io.length >= 2048, `${program.io.length} I/O`);
    assert.ok(read + plan < 15, `read ${read.toFixed(1)} s + plan ${plan.toFixed(1)} s`);
  });
}

console.log(`bigProgram.test: all passed (${passed})`);
