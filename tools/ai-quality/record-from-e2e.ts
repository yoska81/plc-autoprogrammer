/// <reference types="node" />
/**
 * Builds the m0-example-conveyor "recording" from the E2E mock answers (e2e/fixtures.json),
 * so the harness's replay path and scoring can be tested without an API key.
 * These are fixtures, not real AI output.   npx tsx tools/ai-quality/record-from-e2e.ts
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const F = JSON.parse(fs.readFileSync(path.join(ROOT, 'e2e/fixtures.json'), 'utf8'));
const IO_POINTS = [
  ['E-Stop OK (safety relay)', 'input', 'Safety', 'safety-relay-output'],
  ['Start Button', 'input', 'Operator/HMI', 'pushbutton-no'],
  ['Stop Button', 'input', 'Operator/HMI', 'pushbutton-nc'],
  ['Part at end photo-eye', 'input', 'Product Detection', 'sensor-pnp'],
  ['Pusher extended', 'input', 'Pneumatic', 'sensor-pnp'],
  ['Conveyor motor contactor', 'output', 'Conveyor', 'contactor-coil'],
  ['Pusher solenoid', 'output', 'Pneumatic', 'solenoid'],
].map(([description, type, category, deviceType]) => ({ description, type, category, deviceType, reason: 'spec' }));
const m = F.DESIGN.machine;
const replies: [string, unknown][] = [
  ['spec', { sections: F.SPEC, questions: ['How many parts per minute at most?'], summary: 'Organized the description into sections.' }],
  ['equipment', F.RECOMMENDATION],
  ['io', { explanation: '5 inputs, 2 outputs.', points: IO_POINTS, questions: [] }],
  // Electrical stage = the machine model the rule-based engine designs from (src/lib/ai/machineModelAI.ts).
  ['electrical', {
    motors: F.DESIGN.inputs.motors.map((x: { tag: string; description: string; hp: number }) => ({ tag: x.tag, description: x.description, power: x.hp, unit: 'hp', powerGiven: true, start: 'dol', vertical: false, zone: m.motorLocations[x.tag] ?? '' })),
    estops: 1, guardDoors: [], lightCurtains: [], zones: m.zones, interfaces: [], questions: ['Confirm the conveyor motor nameplate current.'],
  }],
  // HMI stage = the names / machine states on top of the rule-based screens (src/lib/ai/hmiContentAI.ts).
  ['hmi', {
    machineName: 'Conveyor Cell', actuators: [{ index: 0, name: 'Conveyor', manual: true }, { index: 1, name: 'Pusher', manual: true }],
    states: [{ value: 0, text: 'Stopped', style: 'normal' }, { value: 1, text: 'Running', style: 'ok' }, { value: 2, text: 'Pushing Part', style: 'ok' }, { value: 3, text: 'Faulted', style: 'alarm' }, { value: 4, text: 'Manual', style: 'warning' }, { value: 5, text: 'Safety Stop', style: 'alarm' }],
    questions: ['Which operator password levels are needed?'],
  }],
  ['program', { explanation: 'Program written from the spec.', program: F.LADDER }],
];
const dir = path.join(ROOT, 'tools/ai-quality/recordings/m0-example-conveyor');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
replies.forEach(([stage, body], i) => fs.writeFileSync(path.join(dir, `${String(i + 1).padStart(2, '0')}-${stage}.json`), JSON.stringify({ stage, model: 'e2e-fixture', text: JSON.stringify(body) }, null, 1)));
console.log(`wrote ${replies.length} fixture replies to ${path.relative(ROOT, dir)}`);
