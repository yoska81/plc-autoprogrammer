/// <reference types="node" />
/**
 * Servo axes, encoders and ultrasonic level / distance on the rule-based HMI: content from the I/O
 * list, the Motion screen (enable, home, jog ±, move to a position, speed, fault / reset, position
 * readout), encoder readouts, level bars with their alarm limits; every screen in every look and on
 * every panel size with no layout error and no text cut off.
 * Run with:  npx tsx src/hmi/engine/motion.test.ts
 */
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildHmi, defaultHmiContent } from './index';
import { motionContent } from './content';
import { checkDesign, cutTexts } from '../layout';
import { HMI_LOOKS } from '../theme';
import { getCpu, getProfile } from '../../plc/core/profiles';
import { resolveAddresses } from '../../plc/core/profile';
import { moduleSlots } from '../../plc/core/modules';
import type { IOPoint } from '../../types/io';
import type { HmiDesign } from '../types';

// tsx compiles JSX with the classic runtime here: give it React first.
(globalThis as { React?: unknown }).React = React;
const { default: HmiScreenView } = await import('../HmiScreenView');

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log('  ok ', name); };

type P = Pick<IOPoint, 'description' | 'type'> & Partial<IOPoint>;
const pt = (description: string, type: 'input' | 'output', extra: Partial<IOPoint> = {}): P => ({ description, type, ...extra });
const POINTS: P[] = [
  pt('E-Stop OK (safety relay)', 'input'), pt('Start Button', 'input'), pt('Stop Button', 'input'),
  pt('Axis 1 Servo Ready', 'input', { category: 'Servo/Axis' }), pt('Axis 1 Servo Fault', 'input', { category: 'Servo/Axis' }),
  pt('Axis 1 Home Complete', 'input', { category: 'Servo/Axis' }), pt('Axis 1 In Position', 'input', { category: 'Servo/Axis' }),
  pt('Axis 1 Positive Limit', 'input', { category: 'Servo/Axis' }), pt('Axis 1 Negative Limit', 'input', { category: 'Servo/Axis' }),
  pt('Axis 1 Servo Enable', 'output', { category: 'Servo/Axis' }),
  pt('Turntable servo fault', 'input'), pt('Turntable servo enable', 'output'),
  pt('Conveyor encoder A', 'input'), pt('Conveyor encoder B', 'input'),
  pt('Conveyor motor contactor', 'output'),
  pt('Tank level (ultrasonic)', 'input', { signal: 'analog', category: 'Analog/Process', analog: { range: '4-20mA', min: 0, max: 2000, units: 'mm' } }),
  pt('Distance to roll (ultrasonic)', 'input', { signal: 'analog', category: 'Analog/Process', analog: { range: '0-10V', min: 50, max: 1000, units: 'mm' } }),
];

function project(points: P[]) {
  const io = points.map((p, i) => ({ category: 'Operator/HMI', ...p, id: `p${i}` })) as IOPoint[];
  const profile = getProfile('click');
  const addresses = resolveAddresses(profile, getCpu(profile, 'C0-10DD1E-D'), io, moduleSlots(['C0-08ND3', 'C0-08TD1', 'C0-04AD-1']));
  return { io, addresses };
}

const { io, addresses } = project(POINTS);
const content = defaultHmiContent({ io, addresses, machineName: 'Pick and place' });
const PANELS = [
  { partNumber: 'CM5-T7W', widthPx: 800, heightPx: 480 },
  { partNumber: 'CM5-T10W', widthPx: 1024, heightPx: 600 },
  { partNumber: 'CM5-T4W', widthPx: 480, heightPx: 272 },
];
const designs = PANELS.map((pnl) => buildHmi(content, { ...pnl, now: '2026-10-18T00:00:00Z' }));
const role = (d: HmiDesign, r: string) => d.tags.find((t) => t.role === r);

test('content: two servo axes and one encoder; their points are not alarms, actuators or part sensors', () => {
  assert.deepEqual(content.axes?.map((a) => a.name), ['Axis 1', 'Turntable']);
  const ax = content.axes![0];
  assert.ok(ax.fault && ax.ready && ax.homed && ax.inPos && ax.limitPos && ax.limitNeg && ax.enable, 'every Axis 1 point has its job');
  assert.equal(ax.units, 'mm');
  assert.equal(content.axes![1].units, 'deg', 'a turntable turns in degrees');
  assert.deepEqual(content.encoders?.map((e) => [e.name, e.channels.length]), [['Conveyor encoder', 2]]);
  const axisAddr = new Set([...content.axes!.flatMap((a) => a.points), ...content.encoders!.flatMap((e) => e.channels)].map((x) => x.address));
  assert.ok(!(content.alarmInputs ?? []).some((a) => axisAddr.has(a.point.address)), 'a servo fault is the axis alarm, not a generic input alarm');
  assert.ok(!content.actuators.some((a) => [a.run, a.extend, ...a.feedback].some((x) => x && axisAddr.has(x.address))), 'servo points are no actuator');
  assert.ok(!content.partSensor || !axisAddr.has(content.partSensor.address));
  assert.ok(content.io.some((x) => axisAddr.has(x.address)), 'the points stay on Diagnostics');
});

test('content: a unit given as a ratio wins; a numbered encoder is "Encoder N"', () => {
  const c = motionContent([
    { address: 'X101', description: 'Axis 1 servo ready', type: 'input' }, { address: 'Y101', description: 'Axis 1 servo pulse (200 pulses/mm)', type: 'output' },
    { address: 'X201', description: 'Axis 2 servo ready', type: 'input' }, { address: 'Y201', description: 'Axis 2 servo pulse (10 mm/rev)', type: 'output' },
    { address: 'X301', description: 'Indexer servo ready (1000 pulses/deg)', type: 'input' },
    { address: 'X401', description: 'Encoder 1 A', type: 'input' }, { address: 'X402', description: 'Encoder 1 B', type: 'input' },
  ]);
  assert.deepEqual(c.axes.map((a) => [a.name, a.units]), [['Axis 1', 'mm'], ['Axis 2', 'mm'], ['Indexer', 'deg']]);
  assert.deepEqual(c.encoders.map((e) => [e.name, e.channels.length]), [['Encoder 1', 2]]);
});

test('tags: every axis command, status, setpoint, readout and the fault alarm; encoder readouts', () => {
  const d = designs[0];
  for (const ax of content.axes!) {
    for (const r of ['enable', 'home', 'jogpos', 'jogneg', 'move', 'reset', 'enabled', 'homed', 'inpos', 'moving', 'jogpermit', 'target', 'speed', 'jogspeed', 'pos', 'actspeed']) {
      assert.ok(role(d, `axis:${ax.key}:${r}`), `${ax.name} ${r}`);
    }
    const fault = role(d, `alarm:axis:${ax.key}:fault`)!;
    assert.ok(d.alarms.some((a) => a.address === fault.address && /servo fault/.test(a.message)), `${ax.name} fault alarm`);
  }
  const ax1 = content.axes![0];
  assert.match(role(d, `axis:${ax1.key}:jogpos`)!.description, new RegExp(`stopping at ${ax1.limitPos!.address}`), 'jog + stops at the positive limit');
  assert.match(role(d, `axis:${ax1.key}:enable`)!.description, new RegExp(ax1.enable!.address), 'enable drives the enable output');
  assert.equal(role(d, `axis:${ax1.key}:pos`)!.dataType, 'FLOAT');
  assert.equal(role(d, `axis:${ax1.key}:enable`)!.access, 'read-write');
  const en = content.encoders![0];
  for (const r of ['pos', 'speed', 'zero']) assert.ok(role(d, `enc:${en.key}:${r}`), `encoder ${r}`);
  const addrs = d.tags.map((t) => t.address);
  assert.equal(new Set(addrs).size, addrs.length, 'no address used twice');
});

test('Motion screen: per axis lamps, position / speed readouts, Enable / Home / Reset / Move, Jog ± with the permit, Target / Speed', () => {
  for (const d of designs) {
    const motion = d.screens.filter((s) => s.id.startsWith('motion'));
    assert.ok(motion.length, `${d.hmiPartNumber}: Motion screen`);
    const els = motion.flatMap((s) => s.elements);
    for (const ax of content.axes!) {
      const at = (r: string) => els.find((e) => e.address === role(d, `axis:${ax.key}:${r}`)!.address);
      assert.equal(at('pos')?.kind, 'numeric', `${d.hmiPartNumber} ${ax.name} position readout`);
      assert.equal(at('actspeed')?.kind, 'numeric');
      assert.equal(at('enable')?.action, 'toggle');
      for (const r of ['home', 'reset', 'move']) assert.equal(at(r)?.action, 'momentary', r);
      for (const r of ['jogpos', 'jogneg']) {
        assert.equal(at(r)?.action, 'momentary');
        assert.equal(at(r)?.interlock, role(d, `axis:${ax.key}:jogpermit`)!.address, `${r} shows its permit`);
      }
      for (const r of ['target', 'speed']) assert.equal(at(r)?.kind, 'numeric-entry', r);
      assert.equal(els.find((e) => e.address === role(d, `alarm:axis:${ax.key}:fault`)!.address)?.style, 'alarm', 'fault lamp');
    }
    const en = content.encoders![0];
    assert.ok(els.some((e) => e.address === role(d, `enc:${en.key}:pos`)!.address), 'encoder position');
    assert.ok(els.some((e) => e.address === role(d, `enc:${en.key}:zero`)!.address && e.kind === 'button'), 'encoder zero');
    assert.ok(d.screens.some((s) => s.elements.some((e) => e.kind === 'nav' && e.targetScreenId === 'motion')), 'Motion on the navigation bar');
    // Jog speeds with the setpoints.
    assert.ok(d.screens.some((s) => s.elements.some((e) => e.kind === 'numeric-entry' && e.address === role(d, `axis:${content.axes![0].key}:jogspeed`)!.address)), 'jog speed on Setup');
  }
});

test('ultrasonic level / distance: bars with the high / low alarm limits', () => {
  const d = designs[0];
  for (const an of content.analogs.filter((x) => /ultrasonic/i.test(x.name) || /level|distance/i.test(x.name))) {
    const bar = d.screens.flatMap((s) => s.elements).find((e) => e.kind === 'bar' && e.address === an.address)!;
    assert.ok(bar, `${an.name} bar`);
    assert.equal(bar.limits?.hi, role(d, `sp:high:${an.address}`)!.address);
    assert.equal(bar.limits?.lo, role(d, `sp:low:${an.address}`)!.address);
  }
  // Live: limit marks on the bar, amber beyond the high limit.
  const level = content.analogs.find((x) => /tank level/i.test(x.name))!;
  const screen = d.screens.find((s) => s.elements.some((e) => e.kind === 'bar' && e.address === level.address))!;
  const vals: Record<string, number> = { [level.address]: 1900, [role(d, `sp:high:${level.address}`)!.address]: 1800, [role(d, `sp:low:${level.address}`)!.address]: 200 };
  for (const look of HMI_LOOKS) {
    const svg = renderToStaticMarkup(React.createElement(HmiScreenView, { screen, widthPx: 800, heightPx: 480, design: { ...d, look }, read: (a: string) => vals[a] ?? 0, staticTime: 0 }));
    assert.equal((svg.match(/data-limit=""/g) ?? []).length, 2, `${look}: two limit marks`);
  }
});

test('every screen, every look, every panel size: no layout error, no text cut off, renders', () => {
  for (const d of designs) {
    const pnl = PANELS.find((p) => p.partNumber === d.hmiPartNumber)!;
    const errors = checkDesign(d, pnl.widthPx, pnl.heightPx).filter((i) => i.severity === 'error');
    assert.equal(errors.length, 0, `${d.hmiPartNumber}: ${errors.map((e) => e.message).join(' | ')}`);
    for (const s of d.screens) for (const e of s.elements) assert.equal(cutTexts(e).length, 0, `${d.hmiPartNumber} ${s.id}: “${e.label}” cut off`);
    for (const look of HMI_LOOKS) for (const s of d.screens.filter((x) => /^(motion|process|setup)/.test(x.id))) {
      const svg = renderToStaticMarkup(React.createElement(HmiScreenView, { screen: s, widthPx: pnl.widthPx, heightPx: pnl.heightPx, design: { ...d, look }, staticTime: 0 }));
      assert.ok(svg.startsWith('<svg') && !svg.includes('NaN'), `${d.hmiPartNumber} ${look} ${s.id}`);
      for (const part of svg.split('data-el="').slice(1)) {
        const el = s.elements.find((e) => e.id === part.slice(0, part.indexOf('"')))!;
        if (['header', 'alarm-list', 'alarm-banner', 'machine'].includes(el.kind)) continue;
        assert.ok(!part.split('data-el="')[0].includes('…'), `${d.hmiPartNumber} ${look} ${s.id}: “${el.label}” shortened on screen`);
      }
    }
  }
});

console.log(`\n${passed} passed`);
