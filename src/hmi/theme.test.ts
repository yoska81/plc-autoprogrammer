// Unit tests of the HMI looks: npx tsx src/hmi/theme.test.ts
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { C, contrast, defaultLookFor, HMI_LOOKS, hmiTheme, lookForMaker, lookOf, onWarning, palette, PALETTES, SHAPES, SIEMENS } from './theme';
import { iconFor } from './iconRules';
import { checkDesign, cutTexts } from './layout';
import { catalogPanels } from './panels';
import { getHmi } from './hmiCatalog';
import type { HmiDesign, HmiLook } from './types';

// tsx compiles JSX with the classic runtime here (no tsconfig "jsx" at the root): give it React first.
(globalThis as { React?: unknown }).React = React;
const { default: HmiScreenView } = await import('./HmiScreenView');
const { HMI } = await import('../preview/sampleProject') as { HMI: HmiDesign };
const { createElement } = React;

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log('  ok ', name); };

test('missing look means the look of the panel maker; a picked look wins', () => {
  assert.equal(lookOf(undefined), 'dark');
  assert.equal(lookOf({}), 'dark');
  assert.equal(lookOf({ look: 'siemens' }), 'siemens');
  assert.equal(lookOf({ look: 'isa101', hmiPartNumber: 'CM5-T7W' }), 'isa101');
  assert.equal(lookOf({ hmiPartNumber: 'CM5-T7W' }), 'cmore', 'a C-more panel gets the C-more look');
  assert.equal(lookOf({ look: 'no-such-look' as HmiLook, hmiPartNumber: 'CM5-T7W' }), 'cmore', 'an unknown saved look falls back to the maker');
  // A panel of each maker from the parts catalog (resolution confirmed) gets that maker's look.
  const byMaker = (re: RegExp) => catalogPanels().find((o) => o.model && re.test(o.part.manufacturer))?.part.partNumber;
  for (const [re, look] of [[/^Weintek$/, 'weintek'], [/^Siemens$/, 'siemens'], [/^Allen-Bradley$/, 'factorytalk'], [/^Pro-face$/, 'proface'], [/^Omron$/, 'omron'], [/^Schneider/, 'schneider'], [/^Yaskawa$/, 'yaskawa']] as [RegExp, HmiLook][]) {
    const pn = byMaker(re);
    if (pn) assert.equal(defaultLookFor(pn), look, `${re} panel ${pn}`);
  }
  assert.equal(lookForMaker('Unitronics'), 'unitronics');
  assert.equal(lookForMaker('Weintek'), 'weintek');
  assert.equal(lookForMaker('Maple Systems'), 'weintek');
  assert.equal(lookForMaker('Rockwell Automation'), 'factorytalk');
  assert.equal(lookForMaker('Schneider Electric'), 'schneider');
  assert.equal(lookForMaker('Red Lion'), 'dark', 'a maker without a look keeps the dark console');
  assert.equal(palette(), C);
  assert.equal(palette('dark'), C);
  for (const look of HMI_LOOKS) {
    assert.deepEqual(Object.keys(PALETTES[look]).sort(), Object.keys(C).sort(), `${look} has every colour`);
    assert.ok(SHAPES[look], `${look} has a shape`);
    for (const [k, v] of Object.entries(PALETTES[look])) assert.match(v, /^#[0-9a-f]{6}$/, `${look}.${k} is #rrggbb`);
  }
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

test('every panel look: text contrast at least 4.5:1 (state fills 3:1)', () => {
  for (const look of HMI_LOOKS.filter((l) => l !== 'dark')) {
    const p = hmiTheme(look);
    const need = (fg: string, bg: string, min: number, what: string) => assert.ok(contrast(fg, bg) >= min, `${look}: ${what} ${fg} on ${bg}: ${contrast(fg, bg).toFixed(2)}`);
    for (const fg of [p.text, p.dim, p.faint, p.okText, p.warningText, p.alarmText]) {
      for (const bg of [p.screen, p.panel, p.surface, p.surfaceUp, p.field]) need(fg, bg, 4.5, 'text');
    }
    for (const fg of [p.headerText, p.headerDim]) { need(fg, p.header, 4.5, 'header text'); need(fg, p.headerBadge, 4.5, 'header badge text'); }
    need(p.onAccent, p.accent, 4.5, 'text on accent');
    need(p.buttonText, p.button, 4.5, 'button label');
    need(p.buttonText, p.pressed, 4.5, 'pressed button label');
    need(p.navText, p.navBand, 4.5, 'screen button label');
    need(p.navActiveText, p.navActive, 4.5, 'current screen button label');
    need(onWarning(p), p.warning, 4.5, 'text on amber');
    if (p.shape.colorKeys) {
      need('#ffffff', p.alarm, 4.5, 'STOP label');
      // START green with white bold text: large-text level (3:1).
      need('#ffffff', p.ok, 3, 'START label');
    }
    need(p.alarm, p.screen, 3, 'alarm colour on the screen');
    need(p.trend, p.field, 3, 'trend line');
  }
  assert.equal(SIEMENS.screen, '#e6e9ed');
});

test('ISA-101 grey: no colour unless abnormal', () => {
  const p = hmiTheme('isa101');
  assert.equal(p.shape.colorKeys, false, 'START / STOP are grey keys');
  const sat = (hex: string) => { const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return Math.max(...v) - Math.min(...v); };
  for (const k of ['screen', 'header', 'panel', 'button', 'text', 'ok', 'okText', 'lampOff', 'navBand'] as const) assert.ok(sat(p[k]) < 12, `${k} is grey`);
  assert.ok(sat(p.alarm) > 100 && sat(p.warning) > 100, 'alarm and warning stay coloured');
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

test('every sample screen renders in every look; texts fit unless the layout check says so; no overlaps', () => {
  const model = getHmi(HMI.hmiPartNumber)!;
  for (const look of HMI_LOOKS) {
    const t = hmiTheme(look);
    for (const screen of HMI.screens) {
      const svg = renderToStaticMarkup(createElement(HmiScreenView, { screen, widthPx: model.widthPx, heightPx: model.heightPx, design: { ...HMI, look }, staticTime: 0 }));
      assert.ok(svg.startsWith('<svg'), `${look} ${screen.id}`);
      assert.ok(!svg.includes('NaN'), `${look} ${screen.id} has NaN`);
      assert.ok(svg.includes(`background:${t.screen}`), `${look} ${screen.id} is drawn on the look's screen colour`);
      assert.ok(svg.includes(t.font.replace(/'/g, '&#x27;')), `${look} ${screen.id} uses the look's font`);
      if (t.shape.family === 'panel') {
        assert.ok(svg.includes(t.header), `${look} ${screen.id} header in the look's colour`);
        assert.ok(!/letter-spacing="[1-9]/.test(svg), `${look}: no letter-spaced caps`);
        if (t.shape.nav === 'tiles') assert.ok(svg.includes(t.navActive), `${look} ${screen.id}: current screen button filled`);
      } else assert.ok(svg.includes(C.screen), `${screen.id} dark`);
      // Every shortened text (…) belongs to an element the layout check reports as cut off.
      const cut = new Set(screen.elements.filter((e) => cutTexts(e).length).map((e) => e.id));
      for (const part of svg.split('data-el="').slice(1)) {
        const id = part.slice(0, part.indexOf('"'));
        const el = screen.elements.find((e) => e.id === id)!;
        if (el.kind === 'header' || el.kind === 'alarm-list' || el.kind === 'alarm-banner') continue; // messages are shortened by design
        assert.ok(!part.includes('…') || cut.has(id), `${look} ${screen.id}: “${el.label}” is shortened but the layout check passes it`);
      }
    }
  }
  // An older saved design without `look` renders in the look of its panel's maker (C-more here).
  const legacy = { ...HMI };
  delete legacy.look;
  const svg = renderToStaticMarkup(createElement(HmiScreenView, { screen: legacy.screens[0], widthPx: model.widthPx, heightPx: model.heightPx, design: legacy, staticTime: 0 }));
  assert.ok(svg.includes(`background:${PALETTES.cmore.screen}`));
  for (const look of HMI_LOOKS) assert.equal(checkDesign({ ...HMI, look }, model.widthPx, model.heightPx).filter((i) => i.severity === 'error').length, 0, look);
});

test('a label too long for its button is shortened in every look and the layout check reports it', () => {
  const model = getHmi(HMI.hmiPartNumber)!;
  const screen = HMI.screens[0];
  const b = screen.elements.find((e) => e.kind === 'button')!;
  const long = { ...screen, elements: screen.elements.map((e) => (e.id === b.id ? { ...e, label: 'Start the whole machine and every conveyor now' } : e)) };
  assert.ok(cutTexts(long.elements.find((e) => e.id === b.id)!).length > 0, 'layout check reports it');
  for (const look of HMI_LOOKS) {
    const svg = renderToStaticMarkup(createElement(HmiScreenView, { screen: long, widthPx: model.widthPx, heightPx: model.heightPx, design: { ...HMI, look }, staticTime: 0 }));
    const part = svg.split(`data-el="${b.id}"`)[1].split('data-el="')[0];
    assert.ok(part.includes('…'), `${look}: shortened, not drawn past the button`);
  }
});

console.log(`\n${passed} passed`);
