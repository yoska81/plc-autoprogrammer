/// <reference types="node" />
/**
 * No NaN in any HMI screen's SVG: the rules-built screens of every designable panel (built-in list and parts catalog)
 * in every look, with digital and analog I/O; and a design that arrives without a panel size or with an element
 * missing its geometry (QA: a KTP700 on an S7 drew <rect width="NaN">). Run with:  npx tsx src/hmi/screenNaN.test.ts
 */
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { catalogPanels } from './panels';
import { HMI_MODELS, designable } from './hmiCatalog';
import { buildHmi } from './engine/build';
import { projectHmiContent } from '../lib/ai/hmiContentAI';
import { HMI_LOOKS } from './theme';
import type { HmiDesign } from './types';
import type { IOPoint } from '../types/io';

// tsx compiles JSX with the classic runtime here (no tsconfig "jsx" at the root): give it React first.
(globalThis as { React?: unknown }).React = React;
const { default: HmiScreenView } = await import('./HmiScreenView');

const io = [
  { id: 'a', description: 'Two-hand start left', type: 'input' },
  { id: 'b', description: 'Seal heater on', type: 'output' },
  { id: 'c', description: 'Seal bar temperature', type: 'input', signal: 'analog', analog: { range: '4-20mA', min: 0, max: 300, units: '°C' } },
  { id: 'd', description: 'Unwinder speed reference', type: 'output', signal: 'analog', analog: { range: '0-10V', min: 0, max: 100, units: '%' } },
] as unknown as IOPoint[];
const addresses = new Map([['a', 'X001'], ['b', 'Y001'], ['c', 'DF1'], ['d', 'DF2']]);
const draw = (design: HmiDesign, w: unknown, h: unknown) => design.screens.map((s) => renderToStaticMarkup(React.createElement(HmiScreenView, { screen: s, widthPx: w as number, heightPx: h as number, design })));

const models = [...HMI_MODELS, ...catalogPanels().flatMap((o) => (o.model ? [o.model] : []))].filter(designable);
assert.ok(models.some((m) => m.partNumber === '6AV2123-2GB03-0AX0'), 'the KTP700 is among them');
const bad: string[] = [];
for (const m of models) {
  const content = projectHmiContent({ io, addresses, machineName: 'Sealer', spec: 'Pouch sealing head', panel: { partNumber: m.partNumber, widthPx: m.widthPx, heightPx: m.heightPx } });
  const d = buildHmi(content, { partNumber: m.partNumber, widthPx: m.widthPx, heightPx: m.heightPx, now: 'T' });
  for (const look of HMI_LOOKS) draw({ ...d, look }, m.widthPx, m.heightPx).forEach((svg, i) => { if (svg.includes('NaN')) bad.push(`${m.partNumber} ${look} ${d.screens[i].name}`); });
}
assert.deepEqual(bad.slice(0, 5), [], `${bad.length} screen(s) with NaN`);

// A design that reaches the generator or the renderer without a size, or with broken geometry.
const ktp = models.find((m) => m.partNumber === '6AV2123-2GB03-0AX0')!;
const content = projectHmiContent({ io, addresses, machineName: 'Sealer', spec: '', panel: { partNumber: ktp.partNumber, widthPx: ktp.widthPx, heightPx: ktp.heightPx } });
const noSize = buildHmi(content, { partNumber: ktp.partNumber, widthPx: undefined as unknown as number, heightPx: NaN, now: 'T' });
assert.ok(noSize.screens.every((s) => s.elements.every((e) => [e.x, e.y, e.w, e.h].every(Number.isFinite))), 'built at the catalog size: every element has numbers');
for (const look of HMI_LOOKS) assert.ok(draw({ ...noSize, look }, undefined, undefined).every((svg) => !svg.includes('NaN') && svg.includes('viewBox="0 0 800 480"')), `${look}: drawn at the KTP700's 800 × 480`);
const broken: HmiDesign = { ...noSize, hmiPartNumber: ' NOT-A-PANEL ', screens: noSize.screens.map((s, i) => (i ? s : { ...s, elements: s.elements.map((e, j) => (j % 3 ? e : { ...e, w: undefined as unknown as number, y: NaN })) })) };
assert.ok(draw(broken, undefined, NaN).every((svg) => !svg.includes('NaN')), 'missing geometry and an unknown panel: still no NaN');

// QA repro (rules-siemens): the rules-built design came without a panel part number and was drawn without a size.
// A 1024 × 600 project panel, so the 800 × 480 last resort cannot pass the test by accident.
const { useHmiStore } = await import('../store/useHmiStore');
const { safeScreenSize } = await import('./screenSize');
useHmiStore.getState().setHmiPartNumber('CM5-T10W');
const noPanel = { ...noSize, hmiPartNumber: undefined as unknown as string };
for (const look of HMI_LOOKS) assert.ok(draw({ ...noPanel, look }, undefined, undefined).every((svg) => !svg.includes('NaN') && svg.includes('viewBox="0 0 1024 600"')), `${look}: no part number in the design, drawn at the project panel's 1024 × 600`);
useHmiStore.getState().setDesign(noPanel, null);
assert.equal(useHmiStore.getState().design?.hmiPartNumber, 'CM5-T10W', 'a design saved without a panel gets the project\'s');
// The fallback order, directly.
assert.deepEqual(safeScreenSize(640, 480, null), { w: 640, h: 480 }, 'given');
assert.deepEqual(safeScreenSize(undefined, NaN, { hmiPartNumber: 'CM5-T10W' } as HmiDesign), { w: 1024, h: 600 }, 'the design\'s panel');
assert.deepEqual(safeScreenSize(0, 0, { hmiPartNumber: 'NOPE', layoutBase: { w: 480, h: 272 } } as unknown as HmiDesign), { w: 480, h: 272 }, 'the layout base');
assert.deepEqual(safeScreenSize(undefined, undefined, { hmiPartNumber: '' } as HmiDesign, { id: 's', name: 's', purpose: '', elements: [{ id: 'e', kind: 'text', label: '', x: 900, y: 10, w: 200, h: 700 }] } as unknown as HmiDesign['screens'][number]), { w: 1100, h: 710 }, 'what the elements cover');
console.log(`no NaN in ${models.length} panels × ${HMI_LOOKS.length} looks`);
