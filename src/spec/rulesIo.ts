/**
 * A first I/O list from the machine description, by plain rules (no AI, no key): the equipment the description
 * names — motors (across the line or on a VFD), servos, encoders, cylinders, vacuum, sensors, switches, buttons,
 * selectors, lamps, stack lights, safety devices, transmitters, heaters and other machines' handshakes — each gives
 * the PLC points the AI prompt (src/lib/ai/ioAI.ts) asks for, with descriptions in the same drawing style, so a
 * later AI run keeps them (and their wiring). What the rules cannot read is asked in `questions`, never guessed
 * silently. The result has the shape of generateIOFromSpec's, so planIOMerge / applyIOUpdate take it unchanged.
 */
import type { GeneratedPoint } from '../lib/ai/ioAI';
import type { AnalogRange, AnalogSpec, IOCategory } from '../types/io';
import type { FieldDeviceType } from '../electrical/types';
import { specToText, type SpecSections } from './types';

export interface RulesIo { points: GeneratedPoint[]; explanation: string; questions: string[] }

const NUM: Record<string, number> = { a: 1, an: 1, one: 1, single: 1, two: 2, both: 2, pair: 2, twin: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const countOf = (w: string | undefined) => (w ? (NUM[w.toLowerCase()] ?? (/^\d+$/.test(w) ? Number(w) : 1)) : 1);
const COUNT = String.raw`(\d+|a|an|one|single|two|both|pair of|twin|three|four|five|six|seven|eight|nine|ten)`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Motor-driven equipment, singular → the name used on the drawing. */
const MOTOR_NOUNS: [RegExp, string][] = [
  [/\b(?:belt\s+)?conveyors?\b|\bbelts\b/, 'Conveyor'], [/\bpumps?\b/, 'Pump'], [/\bfans?\b/, 'Fan'], [/\bblowers?\b/, 'Blower'],
  [/\bagitators?\b/, 'Agitator'], [/\bmixers?\b/, 'Mixer'], [/\bcompressors?\b/, 'Compressor'], [/\bspindles?\b/, 'Spindle'],
  [/\b(?:film\s+)?unwinders?\b/, 'Unwinder'], [/\brewinders?\b/, 'Rewinder'], [/\baugers?\b/, 'Auger'], [/\bhoists?\b/, 'Hoist'],
];
const VFD_RE = /\bvfds?\b|\bvariable[- ]speed\b|\binverters?\b|\bfrequency (drive|converter)s?\b|\bon (a |its own )?drives?\b/i;

interface Ctx { out: GeneratedPoint[]; questions: string[]; seen: Set<string> }

function add(c: Ctx, description: string, type: 'input' | 'output', category: IOCategory, deviceType: FieldDeviceType, reason: string, analog?: AnalogSpec) {
  const d = clean(cap(description));
  if (c.seen.has(d.toLowerCase())) return;
  c.seen.add(d.toLowerCase());
  c.out.push({ description: d, type, category, deviceType, reason, signal: analog ? 'analog' : 'discrete', analog: analog ?? null });
}

/** Names for n items of one kind: "Conveyor" for one, "Conveyor 1"… for several. */
const names = (base: string, n: number) => (n > 1 ? Array.from({ length: n }, (_, i) => `${base} ${i + 1}`) : [base]);

function motors(text: string, sentences: string[], c: Ctx): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const s of sentences) {
    const low = s.toLowerCase();
    for (const [re, noun] of MOTOR_NOUNS) {
      // The mention with a count wins ("Water pump skid with two 10 HP pumps": two pumps).
      const all = [...low.matchAll(new RegExp(String.raw`(?:\b${COUNT}\s+)?(?:(?:\d+(?:\.\d+)?)\s*(?:hp|kw)\s+)?(?:[a-z-]+\s+)?${re.source}`, 'gi'))];
      const m = all.sort((a, b) => countOf(b[1]) - countOf(a[1]))[0];
      if (!m || groups.has(noun)) continue;
      // "Each belt has a motor": the motor belongs to a group counted before ("Three belt conveyors").
      const n = /^each\b/.test(low) ? 0 : countOf(m[1]?.replace(/^pair of$/, 'two'));
      if (!n) continue;
      // A motor is named only where it is driven: "conveyor", "pump" (motor-driven by nature), or "<name> motor".
      const driven = noun !== 'Spindle' && noun !== 'Unwinder' && noun !== 'Rewinder' ? true : /\bmotor\b|\bdriven\b|\bhp\b|\bkw\b|\bvfd\b|\bruns?\b/.test(low);
      if (!driven) continue;
      const label = noun === 'Unwinder' && /\bfilm\s+unwinder/.test(low) ? 'Film unwinder' : noun;
      groups.set(noun, names(label, n));
      const vfd = VFD_RE.test(s) || VFD_RE.test(sentences.find((x) => new RegExp(String.raw`\beach ${re.source}`, 'i').test(x)) ?? '');
      const reversing = /\brevers|\bforward and reverse\b|\bboth directions\b/i.test(s);
      const speedRef = vfd && !/\brun and fault only\b/i.test(s) && /\bspeed\b|\bsetpoint\b|\bpid\b|\bholding\b/i.test(s);
      for (const name of groups.get(noun)!) {
        const why = `${name} motor${vfd ? ' on a VFD' : ''} (description)`;
        if (vfd) {
          add(c, `${name} VFD run`, 'output', noun === 'Conveyor' ? 'Conveyor' : 'Station 1', 'vfd-input', why);
          if (reversing) add(c, `${name} VFD reverse`, 'output', noun === 'Conveyor' ? 'Conveyor' : 'Station 1', 'vfd-input', why);
          add(c, `${name} VFD fault`, 'input', noun === 'Conveyor' ? 'Conveyor' : 'Station 1', 'vfd-input', why);
          if (speedRef) add(c, `${name} speed reference`, 'output', 'Analog/Process', 'other', why, { range: '0-10V', min: 0, max: 60, units: 'Hz' });
        } else {
          add(c, `${name} motor contactor`, 'output', noun === 'Conveyor' ? 'Conveyor' : 'Station 1', 'contactor-coil', why);
          add(c, `${name} overload tripped`, 'input', noun === 'Conveyor' ? 'Conveyor' : 'Station 1', 'other', why);
        }
      }
      if (speedRef) c.questions.push(`The speed references of ${groups.get(noun)!.join(', ')} are taken as 0-10 V = 0–60 Hz: check the drive's analog input.`);
    }
  }
  // "Hand-off-auto selector per pump": two selector inputs for each.
  const hoa = /\bhand[- ]off[- ]auto\b|\bh-o-a\b/i.test(text);
  if (hoa) for (const [noun, list] of groups) if (new RegExp(String.raw`\bhand[- ]off[- ]auto\b[^.]*\b(per|each|for every)\s+${noun.toLowerCase()}`, 'i').test(text) || groups.size === 1) {
    for (const name of list) { add(c, `${name} selector in Hand`, 'input', 'Operator/HMI', 'selector', 'Hand-off-auto selector'); add(c, `${name} selector in Auto`, 'input', 'Operator/HMI', 'selector', 'Hand-off-auto selector'); }
  }
  return groups;
}

/** Pneumatic actuators: a solenoid each, and a sensor per end position the description relies on (two by default). */
function actuators(sentences: string[], c: Ctx) {
  const found: { name: string; ends: [string, string] }[] = [];
  const has = (n: string) => found.some((f) => f.name.toLowerCase() === n.toLowerCase());
  for (const s of sentences) {
    const low = s.toLowerCase();
    // "an X slide and a Z slide", "press cylinder", "the pusher", "a clamp", "stop gate"
    for (const m of low.matchAll(/\b(?:(?:an?|the|one)\s+)?([a-z]{1,12}\s+)?(slide|cylinder|pusher|clamp|gate|stopper|lift|ram)s?\b/g)) {
      const pre = (m[1] ?? '').trim();
      const name = cap(pre && !/^(pneumatic|air|each|its|their|this|with|and|the|a|an|of)$/.test(pre) ? `${pre} ${m[2]}` : m[2]).replace(/^X /, 'X ').replace(/^(\w) slide/i, (_, a: string) => `${a.toUpperCase()} slide`);
      if (has(name)) continue;
      // "Each slide has…" speaks of slides already named ("an X slide and a Z slide").
      if (name.toLowerCase() === m[2] && found.some((f) => f.name.toLowerCase().endsWith(` ${m[2]}`))) continue;
      const updown = /\bup\b[^.]*\bdown\b|\bdown\b[^.]*\bup\b|\bvertical\b|\bpress\b/.test(low) && !/slide/.test(m[2]);
      found.push({ name, ends: updown ? ['up', 'down'] : ['extended', 'retracted'] });
    }
    // A head or plate that "comes down ... goes up" is a vertical cylinder.
    const head = /\b((?:heated\s+)?(?:sealing|press|cutting|capping)?\s*(?:head|plate|bar))\s+(?:comes|moves|goes)\s+(?:down|up)\b/.exec(low);
    if (head) { const name = cap(head[1].replace(/^heated\s+/, '').trim()); if (!has(name)) found.push({ name, ends: ['up', 'down'] }); }
  }
  const twoSensors = sentences.some((s) => /\btwo end sensors\b|\bboth end\b|\bup and down sensors\b|\bextended and retracted\b/i.test(s));
  for (const f of found) {
    const why = `${f.name} (pneumatic, description)`;
    const [a, b] = f.ends;
    add(c, `${f.name} ${a === 'up' ? 'down' : 'extend'} solenoid`, 'output', 'Pneumatic', 'solenoid', why);
    if (a === 'up') add(c, `${f.name} up solenoid`, 'output', 'Pneumatic', 'solenoid', why);
    add(c, `${f.name} ${a}`, 'input', 'Pneumatic', 'sensor-pnp', why);
    add(c, `${f.name} ${b}`, 'input', 'Pneumatic', 'sensor-pnp', why);
  }
  if (found.length && !twoSensors) c.questions.push(`${found.map((f) => f.name).join(', ')} ${found.length > 1 ? 'are each' : 'is'} given a sensor at both end positions and one solenoid${found.some((f) => f.ends[0] === 'up') ? ' per direction for up / down' : ' (spring return)'}: say if a position has no sensor or a valve has two coils.`);
}

function sensors(sentences: string[], groups: Map<string, string[]>, c: Ctx) {
  const conveyors = groups.get('Conveyor') ?? [];
  let n = 0;
  for (const s of sentences) {
    const low = s.toLowerCase();
    // "Each belt has ... a photo-eye at its end": one per conveyor.
    if (/^each\s+(belt|conveyor)\b/.test(low) && /photo-?eye|photocell/.test(low) && conveyors.length) {
      for (const name of conveyors) add(c, `${name} end photo-eye`, 'input', 'Product Detection', 'sensor-pnp', 'Photo-eye at the end of each conveyor');
      continue;
    }
    for (const m of low.matchAll(new RegExp(String.raw`(?:\b${COUNT}\s+)?((?:[a-z-]+\s+){0,2})(photo-?eyes?|photocells?|prox(?:imity)? (?:sensors?|switch(?:es)?)|float switch(?:es)?|level switch(?:es)?|limit switch(?:es)?|pressure switch(?:es)?|vacuum switch(?:es)?|flow switch(?:es)?)\b`, 'g'))) {
      const count = countOf(m[1]?.replace(/^pair of$/, 'two'));
      const kind = m[3];
      const pre = clean((m[2] ?? '').replace(/\b(a|an|the|has|with|and|each|its|for|on|at)\b/g, ''));
      const isSwitch = /switch/.test(kind);
      const deviceType: FieldDeviceType = /pressure|vacuum/.test(kind) ? 'pressure-switch' : /limit/.test(kind) ? 'limit-switch' : 'sensor-pnp';
      const base = kind.replace(/es$|s$/, '').replace(/photo-?eye/, 'photo-eye').replace(/^prox(imity)? /, 'proximity ');
      const what = /vacuum/.test(kind) ? 'Vacuum OK' : /float|level/.test(kind) ? cap(`${pre || 'tank level'} ${base}`) : /pressure/.test(kind) ? `${cap(pre ? `${pre} ` : /\bair\b/.test(low) ? 'air ' : '')}pressure OK` : `${cap(pre ? `${pre} ` : '')}${base}`;
      const cat: IOCategory = isSwitch && !/limit/.test(kind) ? (/vacuum/.test(kind) ? 'Vacuum' : /pressure/.test(kind) && /\bair\b/.test(pre + low) ? 'Pneumatic' : 'Station 1') : 'Product Detection';
      for (let i = 0; i < count; i++) add(c, count > 1 ? `${what} ${++n}` : what, 'input', cat, deviceType, `${kind} (description)`);
    }
    if (/\bover-?temperature (limit|switch|thermostat)\b/.test(low)) add(c, 'Heater over-temperature limit tripped', 'input', 'Station 1', 'other', 'Over-temperature limit');
  }
}

function operator(text: string, c: Ctx, hasPanel: boolean) {
  const low = text.toLowerCase();
  const why = 'Operator device (description)';
  if (/\btwo[- ]hand\b/.test(low)) {
    add(c, 'Two-hand start button left', 'input', 'Operator/HMI', 'pushbutton-no', 'Two-hand start');
    add(c, 'Two-hand start button right', 'input', 'Operator/HMI', 'pushbutton-no', 'Two-hand start');
  }
  // A start / stop / reset named as a physical button (or "on the panel"); on a touch screen they are HMI buttons.
  const physical = (w: string) => new RegExp(String.raw`(?<!e-|e)\b${w}(?:\s*/\s*\w+)?\s+(?:push)?button|(?<!e-|e)\b${w}\b[^.]{0,40}\bon the (?:panel|door|cabinet|operator station)\b`, 'i').test(low);
  if (physical('start') && !/\btwo[- ]hand start\b/.test(low.replace(/two[- ]hand start\b[^.]*\bstart button/, ''))) add(c, 'Start button', 'input', 'Operator/HMI', 'pushbutton-no', why);
  else if (physical('start')) add(c, 'Start button', 'input', 'Operator/HMI', 'pushbutton-no', why);
  if (physical('stop') || /\bstart\s*\/\s*stop\b[^.]*\bpanel\b|\bstart, stop\b[^.]*\bpanel\b/.test(low)) add(c, 'Stop button', 'input', 'Operator/HMI', 'pushbutton-nc', why);
  if (/\bstart, stop\b[^.]*\bpanel\b|\bstart\s*\/\s*stop\b[^.]*\bpanel\b/.test(low)) add(c, 'Start button', 'input', 'Operator/HMI', 'pushbutton-no', why);
  if (physical('reset')) add(c, 'Fault reset button', 'input', 'Operator/HMI', 'pushbutton-no', why);
  const sel = /\b([a-z]+)\s*\/\s*([a-z]+)\s+selector\b/.exec(low);
  if (sel) add(c, `${cap(sel[2])} mode selected`, 'input', 'Operator/HMI', 'selector', `${sel[1]}/${sel[2]} selector`);
  else if (/\b(mode|auto\/manual|manual\/auto) selector\b/.test(low)) add(c, 'Auto mode selected', 'input', 'Operator/HMI', 'selector', 'Mode selector');
  // Lamps: "a green running lamp and red fault lamp"
  for (const m of low.matchAll(/\b(green|red|amber|yellow|white|blue)\s+([a-z]+\s+)?(?:lamp|pilot light|light)\b(?!\s+curtain)/g)) {
    if (/stack/.test(m[0])) continue;
    add(c, `${cap(m[2]?.trim() || m[1])} lamp${m[2] ? ` (${m[1]})` : ''}`, 'output', 'Operator/HMI', 'pilot-light', 'Pilot lamp');
  }
  if (/\bstack ?lights?\b|\blight tower\b|\bbeacon\b/.test(low)) {
    const colours = ['green', 'amber', 'red'].filter((k) => new RegExp(String.raw`\bstack ?light[^.]*\b${k}\b|\b${k}\b[^.]*\bstack ?light`).test(low));
    for (const k of colours.length ? colours : ['green', 'amber', 'red']) add(c, `Stack light ${k}`, 'output', 'Operator/HMI', 'stack-light', 'Stack light');
    if (!colours.length) c.questions.push('The stack light is given green, amber and red: say if it has other colours or a buzzer.');
  }
  if (/\b(horn|buzzer|siren)\b/.test(low)) add(c, `Alarm ${/\bbuzzer\b/.test(low) ? 'buzzer' : 'horn'}`, 'output', 'Operator/HMI', 'other', 'Audible alarm');
  if (!hasPanel && !/\bstart\b/.test(low)) c.questions.push('No start / stop buttons are named: how does the operator start and stop the machine?');
}

function safety(text: string, c: Ctx) {
  const low = text.toLowerCase();
  const parts = [
    /\be-?stops?\b|\bemergency stop\b/.test(low) && 'E-stop',
    /\bguard\b|\binterlocked door\b/.test(low) && 'guard door',
    /\blight curtains?\b/.test(low) && 'light curtain',
    /\bsafety mats?\b/.test(low) && 'safety mat',
    /\bpull[- ]?cords?\b/.test(low) && 'pull-cord',
  ].filter((x): x is string => Boolean(x));
  if (parts.length) add(c, `Safety relay OK (${parts.join(', ')})`, 'input', 'Safety', 'safety-relay-output', 'Safety devices go to a safety relay; the PLC sees its status');
  else c.questions.push('No E-stop is named: a machine needs one (wired to a safety relay). Which safety devices does it have?');
  if (/\blight curtains?\b/.test(low)) add(c, 'Light curtain clear', 'input', 'Safety', 'safety-relay-output', 'Light curtain status (safety relay)');
  if (/\b(guard|interlocked) door\b|\bdoor interlock\b/.test(low)) add(c, 'Guard door closed', 'input', 'Safety', 'limit-switch', 'Guard door status');
}

const RANGE_RE = /\b4\s*[-–…]\s*20\s*ma\b|\b0\s*[-–…]\s*20\s*ma\b|\b0\s*[-–…]\s*10\s*v\b|\b0\s*[-–…]\s*5\s*v\b/i;
const rangeOf = (s: string): AnalogRange | null => {
  const m = RANGE_RE.exec(s)?.[0].replace(/\s+/g, '').toLowerCase() ?? '';
  return m.startsWith('4') ? '4-20mA' : /^0.?20/.test(m) ? '0-20mA' : /^0.?10/.test(m) ? '0-10V' : /^0.?5/.test(m) ? '0-5V' : null;
};
const UNITS: [RegExp, Omit<AnalogSpec, 'range'>][] = [
  [/pressure/, { min: 0, max: 100, units: 'psi' }], [/flow/, { min: 0, max: 100, units: 'gpm' }], [/level/, { min: 0, max: 100, units: '%' }],
  [/temp/, { min: 0, max: 150, units: '°C' }], [/weigh|load/, { min: 0, max: 1000, units: 'kg' }],
];

function process(sentences: string[], c: Ctx) {
  const heater = sentences.some((x) => /\bseal(ing)? bar\b/i.test(x)) ? 'Seal bar' : 'Heater';
  for (const s of sentences) {
    // Signal ranges are not part of a transmitter's name ("4-20 mA temperature transmitter").
    const low = s.toLowerCase().replace(RANGE_RE, ' ').replace(/\s+/g, ' ');
    const range = rangeOf(s);
    // "Discharge pressure, flow, tank level and water temperature transmitters": a list before "transmitters".
    const list = /((?:[a-z-]+\s+){0,3}?(?:pressure|flow|level|temperature|weight)(?:\s*(?:,|and)\s*(?:[a-z-]+\s+){0,2}?(?:pressure|flow|level|temperature|weight))*)\s+(?:transmitters?|sensors?|transducers?)\b/.exec(low);
    if (list) {
      // "heater with a temperature" → "temperature": only the words that name the measurement.
      const items = list[1].split(/\s*,\s*|\s+and\s+/).map((x) => clean(x.replace(/^.*\b(?:with|a|an|the|of|on|for|has|have|all|its)\s+/, ''))).filter(Boolean);
      for (const it of items) {
        const u = UNITS.find(([re]) => re.test(it))?.[1] ?? { min: 0, max: 100, units: '%' };
        add(c, `${cap(it)} transmitter`, 'input', 'Analog/Process', 'other', 'Transmitter (description)', { range: range ?? '4-20mA', ...u });
      }
      c.questions.push(`Ranges of ${items.join(', ')} are assumed (${UNITS.filter(([re]) => items.some((i) => re.test(i))).map(([, u]) => `0–${u.max} ${u.units}`).join(', ')})${range ? '' : ' on 4-20 mA'}: give each transmitter's real range.`);
    }
    if (/\bthermocouple\b/.test(low) && !/\btransmitter\b/.test(low) && !c.out.some((p) => /\(thermocouple\)$/.test(p.description))) {
      add(c, `${heater} temperature (thermocouple)`, 'input', 'Analog/Process', 'other', 'Thermocouple read by the PLC', { range: 'thermocouple', min: 0, max: 300, units: '°C' });
    }
    if (/\bheat(er|ed|ing)\b/.test(low) && !/\bheat(er|ed)? exchanger\b/.test(low)) add(c, `${heater} heater on`.replace(/^Heater heater/, 'Heater'), 'output', 'Station 1', 'other', 'Heater (description)');
  }
}

function motion(text: string, c: Ctx) {
  const low = text.toLowerCase();
  const m = new RegExp(String.raw`(?:\b${COUNT}\s+)?(?:[a-z-]+\s+)?servo(?:\s+(?:axis|axes|motors?|drives?))?`).exec(low);
  if (m) {
    const n = /\baxes\b/.test(m[0]) || /servos\b/.test(m[0]) ? Math.max(2, countOf(m[1])) : countOf(m[1]);
    for (const name of names('Servo axis', n)) {
      const why = `${name} (servo drive handshake)`;
      for (const o of ['enable', 'start move', 'home']) add(c, `${name} ${o}`, 'output', 'Servo/Axis', 'servo-drive', why);
      for (const i of ['in position', 'fault']) add(c, `${name} ${i}`, 'input', 'Servo/Axis', 'servo-drive', why);
    }
    c.questions.push('Servo axes are given enable / start move / home outputs and in position / fault inputs: check them against the drive (positions over a network need no extra points).');
  }
  if (/\bencoders?\b/.test(low)) {
    add(c, 'Encoder channel A', 'input', 'Servo/Axis', 'encoder', 'Encoder (description)');
    add(c, 'Encoder channel B', 'input', 'Servo/Axis', 'encoder', 'Encoder (description)');
  }
  if (/\bvacuum (gripper|cups?|generator|pad)\b/.test(low)) add(c, 'Vacuum on', 'output', 'Vacuum', 'solenoid', 'Vacuum gripper');
}

function external(text: string, c: Ctx) {
  const low = text.toLowerCase();
  for (const m of low.matchAll(/\bready signal from (?:the )?([a-z-]+)|\b([a-z-]+) ready signal\b(?! from)/g)) {
    const raw = (m[1] ?? m[2]).replace(/\s+(and|or|on|in)$/, '');
    if (/^(a|an|the|its|one)$/.test(raw)) continue;
    const who = cap(raw);
    add(c, `${who} ready`, 'input', 'External Machine', 'other', `Handshake with the ${who.toLowerCase()}`);
  }
  if (/\brobot\b/.test(low)) {
    add(c, 'Robot ready', 'input', 'External Machine', 'other', 'Robot handshake');
    add(c, 'Robot start cycle', 'output', 'External Machine', 'relay-coil', 'Robot handshake');
  }
  for (const m of low.matchAll(/\b(upstream|downstream)\s+([a-z-]+)/g)) {
    const who = cap(`${m[1]} ${m[2]}`.replace(/\s+(machine|line)$/, ' $1'));
    if (m[1] === 'upstream') add(c, `${who} ready`, 'input', 'External Machine', 'other', 'Handshake');
    else add(c, `${who} ready to receive`, 'input', 'External Machine', 'other', 'Handshake');
  }
}

/** The I/O list the rules read from the machine description. `noPanel`: the machine has no touch panel. */
export function ioFromDescription(spec: SpecSections | string, opts: { noPanel?: boolean } = {}): RulesIo {
  const text = typeof spec === 'string' ? spec : specToText(spec);
  const sentences = text.replace(/\s*\n+\s*/g, '. ').split(/(?<=[.;!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const c: Ctx = { out: [], questions: [], seen: new Set() };
  if (!text.trim()) return { points: [], explanation: 'The description is empty: nothing to read.', questions: ['Describe the machine first (its equipment, sensors and operator devices).'] };
  const hasPanel = !opts.noPanel && /\btouch ?(screen|panel)\b|\bhmi\b|\bscreen\b/i.test(text);
  safety(text, c);
  operator(text, c, hasPanel);
  const groups = motors(text, sentences, c);
  actuators(sentences, c);
  motion(text, c);
  sensors(sentences, groups, c);
  process(sentences, c);
  external(text, c);
  const ins = c.out.filter((p) => p.type === 'input'), outs = c.out.filter((p) => p.type === 'output');
  const an = c.out.filter((p) => p.signal === 'analog').length;
  const explanation = `Read by the rules from the description (no AI): ${ins.length} inputs and ${outs.length} outputs${an ? `, ${an} of them analog` : ''}. Check the list: the rules read only the equipment the description names.`;
  return { points: c.out, explanation, questions: [...new Set(c.questions)] };
}
