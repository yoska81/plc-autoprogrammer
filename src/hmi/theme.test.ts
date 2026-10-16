// Unit tests of the HMI looks: npx tsx src/hmi/theme.test.ts
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { C, contrast, hmiTheme, lookOf, palette, SIEMENS } from './theme';
import { iconFor } from './iconRules';
import { checkDesign } from './layout';
import { getHmi } from './hmiCatalog';
import type { HmiDesign } from './types';

// tsx compiles JSX with the classic runtime here (no tsconfig "jsx" at the root): give it React first.
(globalThis as { React?: unknown }).React = React;
const { default: HmiScreenView } = await import('./HmiScreenView');
const { HMI } = await import('../preview/sampleProject') as { HMI: HmiDesign };
const { createElement } = React;

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log('  ok ', name); };

test('missing look means Siemens, also for designs saved before looks existed', () => {
  assert.equal(lookOf(undefined), 'siemens');
  assert.equal(lookOf({}), 'siemens');
  assert.equal(lookOf({ look: 'dark' }), 'dark');
  assert.equal(palette(), SIEMENS);
  assert.equal(palette('dark'), C);
  assert.deepEqual(Object.keys(SIEMENS).sort(), Object.keys(C).sort());
});

test('Siemens palette: requested colours', () => {
  assert.equal(SIEMENS.screen, '#e6e9ed');
  assert.equal(SIEMENS.header, '#0b2a5c');
  assert.equal(SIEMENS.accent, '#0d6efd');
  assert.equal(SIEMENS.text, '#1d2327');
  assert.equal(SIEMENS.dim, '#55646c');
  assert.equal(hmiTheme('siemens').caps('Start'), 'Start');
  assert.equal(hmiTheme('siemens').ls(2), 0);
  assert.equal(hmiTheme('dark').caps('Start'), 'START');
});

test('Siemens text contrast is at least 4.5:1', () => {
  const p = SIEMENS;
  for (const fg of [p.text, p.dim, p.faint, p.okText, p.warningText, p.alarmText]) {
    for (const bg of [p.screen, p.panel, p.surfaceUp, p.field]) {
      assert.ok(contrast(fg, bg) >= 4.5, `${fg} on ${bg}: ${contrast(fg, bg).toFixed(2)}`);
    }
  }
  for (const fg of [p.headerText, p.headerDim]) assert.ok(contrast(fg, p.header) >= 4.5, `${fg} on header`);
  assert.ok(contrast(p.onAccent, p.accent) >= 4.5, 'white on the blue nav tile');
  assert.ok(contrast('#ffffff', p.alarm) >= 4.5, 'white on STOP red');
  assert.ok(contrast(p.text, p.warning) >= 4.5, 'dark text on amber');
  // START green with white bold text: WinCC green, large-text level (3:1).
  assert.ok(contrast('#ffffff', p.ok) >= 3, 'white on START green');
});

test('icons from labels', () => {
  assert.equal(iconFor('Start'), 'play');
  assert.equal(iconFor('Cycle Start'), 'play');
  assert.equal(iconFor('Stop'), 'stop');
  assert.equal(iconFor('Fault Reset'), 'reset');
  assert.equal(iconFor('Reset E-Stop'), 'reset');
  assert.equal(iconFor('Main'), 'home');
  assert.equal(iconFor('Manual'), 'hand');
  assert.equal(iconFor('Setup'), 'gear');
  assert.equal(iconFor('Alarms'), 'warning');
  assert.equal(iconFor('Diagnostics'), 'search');
  assert.equal(iconFor('Maintenance'), 'wrench');
  assert.equal(iconFor('Conveyor'), null);
});

test('every sample screen renders in both looks; the layout check still passes', () => {
  const model = getHmi(HMI.hmiPartNumber)!;
  for (const look of ['siemens', 'dark'] as const) {
    for (const screen of HMI.screens) {
      const svg = renderToStaticMarkup(createElement(HmiScreenView, { screen, widthPx: model.widthPx, heightPx: model.heightPx, design: { ...HMI, look }, staticTime: 0 }));
      assert.ok(svg.startsWith('<svg'), `${look} ${screen.id}`);
      assert.ok(!svg.includes('NaN'), `${look} ${screen.id} has NaN`);
      if (look === 'siemens') {
        assert.ok(svg.includes(SIEMENS.header) && !svg.includes(C.screen), `${screen.id} is drawn in the Siemens palette`);
        assert.ok(!/letter-spacing="[1-9]/.test(svg), 'no letter-spaced caps');
      } else assert.ok(svg.includes(C.screen), `${screen.id} dark`);
    }
  }
  // An older saved design without `look` renders Siemens.
  const legacy = { ...HMI };
  delete legacy.look;
  const svg = renderToStaticMarkup(createElement(HmiScreenView, { screen: legacy.screens[0], widthPx: model.widthPx, heightPx: model.heightPx, design: legacy, staticTime: 0 }));
  assert.ok(svg.includes(SIEMENS.screen));
  assert.equal(checkDesign(HMI, model.widthPx, model.heightPx).filter((i) => i.severity === 'error').length, 0);
});

console.log(`\n${passed} passed`);
