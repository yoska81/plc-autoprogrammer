// npx tsx src/hmi/retarget.test.ts
import assert from 'node:assert/strict';
import { retargetDesign } from './retarget';
import { createElement } from './editor';
import type { HmiDesign } from './types';

const B = { w: 800, h: 480 };
const btn = { ...createElement('button', 'b', 0, 0, B), x: 400, y: 240, w: 120, h: 56 };
const nav = { ...createElement('nav', 'n', 0, 0, B), x: 8, y: 424, w: 120, h: 48 };
const mach = { ...createElement('machine', 'm', 0, 0, B), x: 16, y: 64, w: 400, h: 200, symbols: [{ kind: 'motor' as const, label: 'M1', address: 'Y001', x: 20, y: 30, w: 40, h: 40 }] };
const d: HmiDesign = { hmiPartNumber: 'CM5-T7W', screens: [{ id: 'main', name: 'Main', purpose: '', elements: [btn, nav, mach] }], alarms: [], tags: [], notes: [], generatedAt: '' };

const same = retargetDesign(d, B, B, '2713P-T7WD1');
assert.equal(same.hmiPartNumber, '2713P-T7WD1');
assert.deepEqual(same.screens[0].elements, d.screens[0].elements, 'same resolution: positions unchanged');

const big = retargetDesign(d, B, { w: 1280, h: 800 }, 'X');
const [b, n, m] = big.screens[0].elements;
assert.deepEqual([b.x, b.y, b.w, b.h], [640, 400, 192, 93], 'scaled 1.6 x 1.667');
assert.ok(n.y + n.h <= 800 && m.symbols![0].w === 64, 'nav stays on screen, symbols scale');

const small = retargetDesign(d, B, { w: 480, h: 272 }, 'Y');
const [sb, sn] = small.screens[0].elements;
assert.ok(sb.w >= 60 && sb.h >= 48 && sn.w >= 60 && sn.h >= 48, 'touch targets keep the minimum size');
assert.ok(small.screens[0].elements.every((e) => e.x >= 0 && e.y >= 0 && e.x + e.w <= 480 && e.y + e.h <= 272), 'everything stays on the smaller screen');
console.log('retarget tests passed');
