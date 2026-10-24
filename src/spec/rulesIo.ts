/**
 * A first I/O list from the machine description, by plain rules (no AI, no key): the equipment the description
 * names — motors (across the line, reversing, two-speed, star-delta or on a VFD), servos (with the flying-shear /
 * E-cam handshake when the drive runs it), encoders, cylinders, punches, grippers and valves (pneumatic or hydraulic),
 * vacuum, sensors, switches, buttons, selectors, lamps, stack lights, safety devices, transmitters, heaters, robots
 * and other machines' handshakes — each gives the PLC points the AI prompt (src/lib/ai/ioAI.ts) asks for, with
 * descriptions in the same drawing style, so a later AI run keeps them (and their wiring). Never invented: what the
 * description says is absent ("no stack light", "the heater is not used") gives no point, and what the rules cannot
 * read is asked in `questions`. The result has the shape of generateIOFromSpec's, so planIOMerge / applyIOUpdate
 * take it unchanged.
 */
import type { GeneratedPoint } from '../lib/ai/ioAI';
import type { AnalogRange, AnalogSpec, IOCategory } from '../types/io';
import type { FieldDeviceType } from '../electrical/types';
import { specToText, type SpecSections } from './types';

export interface RulesIo { points: GeneratedPoint[]; explanation: string; questions: string[]; reasoning: null }

const NUM: Record<string, number> = { a: 1, an: 1, one: 1, single: 1, two: 2, both: 2, twin: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const countOf = (w: string | undefined) => (w ? (NUM[w.toLowerCase()] ?? (/^\d+$/.test(w) ? Number(w) : 1)) : 1);
const COUNT = String.raw`(\d+|a|an|one|single|two|both|twin|three|four|five|six|seven|eight|nine|ten)`;
const IS_COUNT = new RegExp(String.raw`^${COUNT}$`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
/** Words that never name a device ("the", "is", "each", a count). */
const STOP = /^(?:a|an|the|is|are|was|be|been|has|have|had|with|and|or|of|in|on|at|to|by|for|from|each|every|its|their|this|that|these|those|which|when|then|one|two|three|four|five|six|seven|eight|nine|ten|both|single|twin|pair|\d+|it|there|also|plus|all|any|some|new|old|another|other|simple)$/;
/** Words that describe a motor, not what it drives ("2-speed motors", "electric motor"). */
const MOTOR_ADJ = /^(?:#+|~+|(?:#+|\d+|two|multi)?-?speed|reversing|reversible|electric|induction|ac|dc|geared|gear|brake|3-phase|three-phase|single-phase|small|large|big|main-?line|motors?|motor)$/;
const singular = (w: string) => w.replace(/eyes$/, 'eye').replace(/(switch|box)es$/, '$1').replace(/ies$/, 'y').replace(/s$/, '');
const words = (s: string) => s.split(/\s+/).map((w) => w.replace(/[^a-z0-9#~-]/g, '')).filter(Boolean);

/**
 * The text with figures that are not counts taken out ("1.5 kW servo" is one servo, "2 HP motor" one motor), and the
 * devices the description says are absent ("no stack light", "pick and place without vacuum", "the heater is not
 * used") struck out, so no rule reads them. Same length as the text, so positions stay.
 */
function prepare(text: string): string {
  let t = text.toLowerCase();
  t = t.replace(/\b\d+(?:[.,]\d+)?\s*(?:kw|hp|w|kva|v|vac|vdc|a|ma|mm|cm|m|ppr|bar|psi|kpa|mpa|°c|°f|hz|rpm|ms|s|min|kg|t|l\/min|gpm|in|inch|"|%)(?![a-z])/g, (m) => '#'.repeat(m.length));
  t = t.replace(/\b(?:no|without|not\s+(?:a|any)|never\s+a)\s+([^.;:,()]{1,60}?)(?=\s*[.;:,()]|$)/g, (m) => '~'.repeat(m.length));
  t = t.replace(/\b((?:the\s+)?(?:[a-z-]+\s+){0,2}?[a-z-]+)\s+(?:is|are)\s+not\s+(?:used|needed|required|fitted|installed|present|wired)\b/g, (m) => '~'.repeat(m.length));
  return t;
}

/** The text is not in English: the rules read English only (they must not say "no E-stop is named" of a German text). */
function notEnglish(text: string): boolean {
  const ws = text.toLowerCase().match(/[a-zà-ÿ]+/g) ?? [];
  if (ws.length < 6) return false;
  const en = ws.filter((w) => /^(the|and|with|is|are|on|of|to|a|an|for|by|at|in|it|from|each|has|have|when|then)$/.test(w)).length;
  const other = ws.filter((w) => /^(und|der|die|das|mit|ist|ein|eine|für|von|am|le|la|les|et|avec|est|un|une|pour|des|el|los|las|con|para|una|y|il|di|che|per)$/.test(w)).length;
  return other > en;
}

interface Ctx { out: GeneratedPoint[]; questions: string[]; seen: Set<string> }

function add(c: Ctx, description: string, type: 'input' | 'output', category: IOCategory, deviceType: FieldDeviceType, reason: string, analog?: AnalogSpec) {
  const d = clean(cap(description));
  if (c.seen.has(d.toLowerCase())) return;
  c.seen.add(d.toLowerCase());
  c.out.push({ description: d, type, category, deviceType, reason, signal: analog ? 'analog' : 'discrete', analog: analog ?? null });
}
const ask = (c: Ctx, q: string) => { if (!c.questions.includes(q)) c.questions.push(q); };

/** Names for n items of one kind: "Conveyor" for one, "Conveyor 1"… for several. */
const names = (base: string, n: number) => (n > 1 ? Array.from({ length: n }, (_, i) => `${base} ${i + 1}`) : [base]);

/** Motor-driven equipment, as written → the name used on the drawing. */
const MOTOR_NOUNS: [string, string][] = [
  ['(?:belt\\s+)?conveyors?|belts', 'Conveyor'], ['pumps?', 'Pump'], ['fans?', 'Fan'], ['blowers?', 'Blower'],
  ['agitators?', 'Agitator'], ['mixers?', 'Mixer'], ['compressors?', 'Compressor'], ['spindles?', 'Spindle'],
  ['unwinders?', 'Unwinder'], ['rewinders?', 'Rewinder'], ['augers?', 'Auger'], ['hoists?', 'Hoist'], ['winch(?:es)?', 'Winch'],
];
const VFD_RE = /\bvfds?\b|\bvariable[- ]speed\b|\binverters?\b|\bfrequency (?:drive|converter)s?\b|\bon (?:a |its own )?drives?\b/;
/** Qualifiers that make two groups of one kind ("infeed and outfeed conveyors"). */
const QUAL = '(?:infeed|outfeed|discharge|transfer|feed|takeaway|take-away|accumulation|reject|incline|decline|upper|lower|left|right|front|rear|hydraulic|coolant|vacuum|oil|lube|lubrication|exhaust|supply|return|circulation|dosing|metering|cooling)';

interface Starter { vfd: boolean; reversing: boolean; twoSpeed: boolean; starDelta: boolean }
function starter(s: string): Starter {
  return {
    vfd: VFD_RE.test(s),
    reversing: /\brevers(?:ing|ible)\b|\bforward and reverse\b|\bboth directions\b/.test(s),
    twoSpeed: /\btwo[- ]speed\b|\b2[- ]speed\b|\bdahlander\b/.test(s),
    starDelta: /\bstar[- ]delta\b|\bwye[- ]delta\b|\by[- ]delta\b/.test(s),
  };
}

function motorPoints(c: Ctx, name: string, k: Starter, s: string, category: IOCategory) {
  const why = `${name} motor (description)`;
  if (k.vfd) {
    add(c, `${name} VFD run`, 'output', category, 'vfd-input', why);
    if (k.reversing) add(c, `${name} VFD reverse`, 'output', category, 'vfd-input', why);
    add(c, `${name} VFD fault`, 'input', category, 'vfd-input', why);
    if (!/\brun and fault only\b/.test(s) && /\bspeed\b|\bsetpoint\b|\bpid\b|\bholding\b|\bfrom the (?:screen|hmi|panel)\b/.test(s)) {
      add(c, `${name} speed reference`, 'output', 'Analog/Process', 'other', why, { range: '0-10V', min: 0, max: 60, units: 'Hz' });
      ask(c, `The speed reference of ${name} is taken as 0-10 V = 0–60 Hz: check the drive's analog input.`);
    }
    return;
  }
  const hoist = /hoist|winch/i.test(name);
  const dirs: [string, string] = hoist ? ['up', 'down'] : ['forward', 'reverse'];
  const speeds = k.twoSpeed ? ['low speed', 'high speed'] : [''];
  if (k.starDelta) for (const x of ['main', 'star', 'delta']) add(c, `${name} ${x} contactor`, 'output', category, 'contactor-coil', why);
  else if (k.reversing || hoist) {
    for (const d of dirs) add(c, `${name} ${d} contactor`, 'output', category, 'contactor-coil', why);
    if (k.twoSpeed) for (const sp of speeds) add(c, `${name} ${sp} contactor`, 'output', category, 'contactor-coil', why);
  } else if (k.twoSpeed) for (const sp of speeds) add(c, `${name} ${sp} contactor`, 'output', category, 'contactor-coil', why);
  else add(c, `${name} motor contactor`, 'output', category, 'contactor-coil', why);
  add(c, `${name} overload tripped`, 'input', category, 'other', why);
  if (k.twoSpeed) ask(c, 'A two-speed motor is taken as one winding pair (Dahlander) with one overload: say if it has two windings or two overloads.');
}

function motors(sentences: string[], text: string, c: Ctx): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  // "The motors are 2-speed motors and reversing": said of every motor.
  const general = sentences.filter((x) => /\b(?:the|all)\s+motors\s+(?:are|run|have)\b/.test(x)).join(' ');
  for (const s of sentences) {
    for (const [src, noun] of MOTOR_NOUNS) {
      // The counted mention first ("Water pump skid with two pumps": two pumps); "pump skid" names the machine.
      const mentions = [...s.matchAll(new RegExp(String.raw`(?:\b${COUNT}\s+)?(?:#+\s+)?(?:(${QUAL})(?:\s+and\s+(${QUAL}))?\s+)?(?:[a-z-]+\s+)?\b(?:${src})\b(?!\s+(?:skid|station|unit|room|house|set|package|system|cell|line|carriage))`, 'g'))]
        .sort((a, b) => countOf(b[1]) - countOf(a[1]));
      for (const m of mentions) {
        // "Each belt has a motor" / "a photo-eye on each belt" speak of a group counted before.
        if (new RegExp(String.raw`\beach\s+(?:${src})\b`).test(m[0]) || (/^each\b/.test(s) && [...groups.keys()].some((k) => k.toLowerCase().endsWith(noun.toLowerCase())))) continue;
        const quals = [m[2], m[3]].filter(Boolean) as string[];
        const keys = quals.length ? quals.map((q) => `${cap(q)} ${noun.toLowerCase()}`) : [noun];
        if (/^(Spindle|Unwinder|Rewinder)$/.test(noun) && !/\bmotor\b|\bdriven\b|#|\bvfd\b|\bruns?\b/.test(s)) continue;
        for (const key of keys) {
          // A plain "the pump" after "the hydraulic pump" is the same pump.
          if (groups.has(key) || (!quals.length && [...groups.keys()].some((k) => k.endsWith(` ${noun.toLowerCase()}`)))) continue;
          const n = quals.length > 1 ? 1 : countOf(m[1]);
          const label = noun === 'Unwinder' && /\bfilm\s+unwinder/.test(s) ? 'Film unwinder' : key;
          groups.set(key, names(label, n));
          const each = sentences.find((x) => new RegExp(String.raw`\beach\s+(?:${src})\b`).test(x)) ?? '';
          const said = `${s} ${each} ${general}`;
          for (const name of groups.get(key)!) motorPoints(c, name, starter(said), said, noun === 'Conveyor' ? 'Conveyor' : 'Station 1');
        }
      }
    }
    // Any other motor named by what it drives: "5.5 kW main roll motor on a VFD", "the main drive".
    for (const m of s.matchAll(/\b((?:[a-z#~-]+\s+){0,3}?)(?:motors?|main drive)\b(?!\s+(?:protector|overload|contactor|starter|circuit))/g)) {
      const pre = clean(words(m[1]).filter((w) => !STOP.test(w) && !MOTOR_ADJ.test(w)).join(' '));
      if (MOTOR_NOUNS.some(([src]) => new RegExp(String.raw`\b(?:${src})\b`).test(pre)) || /servo|vfd|drive|driven/.test(pre)) continue;
      const main = /main drive/.test(m[0]);
      if (!pre && !main) continue;
      const key = main ? 'Main drive' : cap(pre);
      if ([...groups.keys()].some((k) => k.toLowerCase() === key.toLowerCase())) continue;
      groups.set(key, [key]);
      motorPoints(c, key, starter(`${s} ${general}`), s, 'Station 1');
    }
  }
  // "Hand-off-auto selector per pump" / "3 pumps, each with a Hand-Off-Auto selector": two selector inputs for each.
  if (/\bhand[- ]off[- ]auto\b|\bh-o-a\b/.test(text)) for (const [noun, list] of groups) if (new RegExp(String.raw`\b${noun.split(' ').pop()!.toLowerCase()}s?\b[^.]*\bhand[- ]off[- ]auto\b|\bhand[- ]off[- ]auto\b[^.]*\b(?:per|each|for every)\s+${noun.split(' ').pop()!.toLowerCase()}`).test(text) || groups.size === 1) {
    for (const name of list) { add(c, `${name} selector in Hand`, 'input', 'Operator/HMI', 'selector', 'Hand-off-auto selector'); add(c, `${name} selector in Auto`, 'input', 'Operator/HMI', 'selector', 'Hand-off-auto selector'); }
  }
  if (!groups.size && VFD_RE.test(text)) ask(c, 'A VFD is named but not the motor it drives: which motor is on the VFD (run, fault and speed reference points)?');
  return groups;
}

const ACT = /^(slide|cylinder|pusher|clamp|gate|stopper|lift|ram|punch|shear|gripper)(?:e?s)?$/;
/** Hydraulic or pneumatic by nature (a punch, a shear) only when the text says so: a "flying shear" may be a servo. */
const TOOL = /^(?:punch|shear|ram)$/;

/** Cylinders, slides, punches, shears, grippers and valves (pneumatic or hydraulic): solenoids and end sensors. */
function actuators(sentences: string[], c: Ctx): Set<number> {
  const found: { name: string; ends: [string, string]; coils: number; sensors: string[] | null; tool: boolean }[] = [];
  const used = new Set<number>();
  const has = (n: string) => found.some((f) => f.name.toLowerCase() === n.toLowerCase());
  sentences.forEach((s, si) => {
    const ws = words(s);
    ws.forEach((w, i) => {
      const noun = ACT.exec(w)?.[1];
      if (!noun) return;
      const prev = ws[i - 1] ?? '', prev2 = ws[i - 2] ?? '';
      // "two cylinders clamp the part": clamp is what they do; "punch punches holes".
      if ((ACT.test(prev) && !/^gates?$/.test(w)) || /^(?:valve|solenoid|motor|pump|guard|gates?|sensor|switch|sensors|switches|holes|carriage)$/.test(ws[i + 1] ?? '')) return;
      if (noun === 'gripper' && /^(?:vacuum|suction)$/.test(prev)) return;
      // "the hoist lifts the basket", "a ram presses the part": a verb, not a device.
      if (/^(?:the|a|an|it|them|its|their|each|all|parts?|products?)$/.test(ws[i + 1] ?? '') && /s$/.test(w) && !/^(?:slides|cylinders|clamps|gates|stoppers|lifts|grippers|pushers)$/.test(w) || (/^(?:the|it|them)$/.test(ws[i + 1] ?? '') && i > 0 && !/^(?:#+|~+|two|three|four|five|six|both|all|\d+)$/.test(prev) && /s$/.test(w))) return;
      if (TOOL.test(noun) && !/\b(?:hydraulic|pneumatic)\b/.test(s)) return;
      if (TOOL.test(noun) && !/^(?:hydraulic|pneumatic)$/.test(prev) && !/^(?:hydraulic|pneumatic)$/.test(prev2) && !/\bvalves?\b/.test(s)) return;
      if (noun === 'lift' && /^(?:to|will|and|it|they)$/.test(prev)) return;
      const n = IS_COUNT.test(prev) ? countOf(prev) : IS_COUNT.test(prev2) && !STOP.test(prev) ? countOf(prev2) : 1;
      const pre = IS_COUNT.test(prev) || STOP.test(prev) || /^(?:pneumatic|hydraulic|air|oil|end|mechanical|#+|~+)$/.test(prev) || !prev ? '' : prev;
      const nameBase = cap(pre ? `${pre} ${noun}` : noun).replace(/^(\w) slide/i, (_, x: string) => `${x.toUpperCase()} slide`);
      // "Each slide has…" speaks of slides already named ("an X slide and a Z slide").
      if (!pre && found.some((f) => f.name.toLowerCase().includes(noun))) return;
      const vertical = /\bup\b[^.]*\bdown\b|\bdown\b[^.]*\bup\b|\bvertical\b/.test(s) || TOOL.test(noun) || pre === 'press';
      const ends: [string, string] = noun === 'gripper' ? ['closed', 'open'] : vertical ? ['up', 'down'] : ['extended', 'retracted'];
      // Its own valves and limit switches named in the sentence ("a down valve and an up valve, with an up limit
      // switch and a down limit switch") are its coils and end sensors, not devices of their own.
      const twoValves = /\b(?:down|up)\s+valve\b[^.]*\b(?:up|down)\s+valve\b|\btwo\s+(?:solenoid\s+)?valves\b|\bdouble[- ]acting\b|\btwo coils\b/.test(s);
      // "an up limit switch and a down limit switch", "up and down limit switches", "up and down sensors".
      const END = 'up|down|upper|lower|open|closed|extended|retracted|home';
      const sensors: string[] = [];
      for (const x of s.matchAll(new RegExp(String.raw`\b(${END})(?:\s+and\s+(?:an?\s+)?(${END}))?\s+(limit\s+switch|sensor|prox)`, 'g'))) {
        for (const l of [x[1], x[2]]) if (l) sensors.push(/limit/.test(x[3]) ? `${l} limit switch` : l);
      }
      const limits = sensors;
      if (twoValves || limits.length) used.add(si);
      for (const name of names(nameBase, n)) if (!has(name)) found.push({ name, ends, coils: twoValves || (vertical && !/\bpushes\b[^.]*\bdown\b/.test(s)) ? 2 : 1, sensors: sensors.length ? sensors : null, tool: TOOL.test(noun) });
    });
    // A head or plate that "comes down ... goes up" is a vertical cylinder.
    const head = /\b((?:heated\s+)?(?:sealing|press|cutting|capping)?\s*(?:head|plate|bar))\s+(?:comes|moves|goes)\s+(?:down|up)\b/.exec(s);
    if (head) { const name = cap(head[1].replace(/^heated\s+/, '').trim()); if (!has(name)) found.push({ name, ends: ['up', 'down'], coils: 2, sensors: null, tool: false }); }
    // A valve named on its own ("dump valve", "hydraulic valve"): its solenoid only; not the valves of an actuator.
    if (!used.has(si)) for (const m of s.matchAll(/\b((?:[a-z-]+\s+){0,2}?)(?:solenoid\s+)?valves?\b/g)) {
      const pre = clean(words(m[1]).filter((w) => !STOP.test(w)).join(' '));
      if (/^(?:pneumatic|air)?$/.test(pre) && found.length) continue;
      if (/cylinder|slide|pusher|clamp|gate|punch|shear|press|inlet|outlet/.test(pre) && found.length) continue;
      const name = cap(`${pre ? `${pre} ` : ''}valve`);
      if (!has(name)) found.push({ name, ends: ['open', 'closed'], coils: 0, sensors: null, tool: false });
    }
  });
  const twoSensors = sentences.some((s) => /\b(?:two|2|both) end sensors\b|\bboth end\b|\bup and down sensors\b|\bextended and retracted\b/.test(s));
  for (const f of found) {
    const why = `${f.name} (description)`;
    if (!f.coils) { add(c, `${f.name} solenoid`, 'output', 'Pneumatic', 'solenoid', why); continue; }
    const [a, b] = f.ends;
    if (a === 'closed') add(c, `${f.name} close solenoid`, 'output', 'Pneumatic', 'solenoid', why);
    else if (a === 'up') { add(c, `${f.name} down solenoid`, 'output', 'Pneumatic', 'solenoid', why); if (f.coils > 1) add(c, `${f.name} up solenoid`, 'output', 'Pneumatic', 'solenoid', why); }
    else add(c, `${f.name} extend solenoid`, 'output', 'Pneumatic', 'solenoid', why);
    if (f.sensors) for (const sn of f.sensors) add(c, `${f.name} ${sn}`, 'input', 'Pneumatic', 'limit-switch', why);
    else if (f.tool) { add(c, `${f.name} up`, 'input', 'Pneumatic', 'sensor-pnp', why); ask(c, `${f.name}: given a down and an up solenoid and an up (home) sensor: is there a bottom sensor, one coil or two, and a hydraulic pump motor?`); }
    else { add(c, `${f.name} ${a}`, 'input', 'Pneumatic', 'sensor-pnp', why); add(c, `${f.name} ${b}`, 'input', 'Pneumatic', 'sensor-pnp', why); }
  }
  const moving = found.filter((f) => f.coils && !f.sensors && !f.tool);
  if (moving.length && !twoSensors) ask(c, `${moving.map((f) => f.name).join(', ')} ${moving.length > 1 ? 'are each' : 'is'} given a sensor at both end positions: say if a position has no sensor or a valve has two coils.`);
  return used;
}

const SENSOR_RE = /(photo-?eyes?|photocells?|photo sensors?|prox(?:imity)? (?:sensors?|switch(?:es)?)|inductive sensors?|capacitive sensors?|float switch(?:es)?|level switch(?:es)?|limit switch(?:es)?|pressure switch(?:es)?|vacuum switch(?:es)?|flow switch(?:es)?)/;

function sensors(sentences: string[], groups: Map<string, string[]>, used: Set<number>, c: Ctx) {
  const conveyors = [...groups.entries()].filter(([k]) => /conveyor$/i.test(k)).flatMap(([, v]) => v);
  const hoist = [...groups.keys()].find((k) => /^(?:hoist|winch)$/i.test(k));
  const counter = new Map<string, number>();
  sentences.forEach((s, si) => {
    // "Each belt has … a photo-eye at its end", "a photo-eye on each belt": one per conveyor.
    if (/\beach\s+(?:belt|conveyor)\b/.test(s) && /photo-?eye|photocell/.test(s) && conveyors.length) {
      for (const name of conveyors) add(c, `${name} ${/\bend\b/.test(s) ? 'end ' : ''}photo-eye`, 'input', 'Product Detection', 'sensor-pnp', 'Photo-eye on each conveyor');
      return;
    }
    for (const m of s.matchAll(new RegExp(String.raw`(?:\b${COUNT}\s+)?((?:[a-z-]+\s+){0,2})${SENSOR_RE.source}\b`, 'g'))) {
      // Limit switches of an actuator or a hoist named in the sentence are theirs.
      if (/limit/.test(m[3]) && used.has(si)) continue;
      if (/limit/.test(m[3]) && hoist && /\b(?:up|down)\b/.test(s)) {
        for (const d of ['up', 'down']) if (new RegExp(String.raw`\b${d}\b`).test(s)) add(c, `${hoist} ${d} limit switch`, 'input', 'Station 1', 'limit-switch', 'Hoist travel limit');
        continue;
      }
      // The count may sit among the words before ("and two prox sensors"): the last count word counts.
      const pw = m[2].split(/\s+/).filter(Boolean);
      const ci = pw.map((w) => IS_COUNT.test(w)).lastIndexOf(true);
      const count = ci >= 0 ? countOf(pw[ci]) : countOf(m[1]);
      const kind = m[3];
      const pre = clean(pw.slice(ci + 1).filter((w) => !STOP.test(w)).join(' '));
      const isSwitch = /switch/.test(kind);
      const deviceType: FieldDeviceType = /pressure|vacuum/.test(kind) ? 'pressure-switch' : /limit/.test(kind) ? 'limit-switch' : 'sensor-pnp';
      const base = kind.split(' ').map(singular).join(' ').replace(/^photo-?eye$/, 'photo-eye').replace(/^prox(?:imity)? /, 'proximity ');
      // "Two photo-eyes on the infeed": named after the conveyor they sit on.
      const on = /^\s+(?:on|at)\s+the\s+([a-z-]+)/.exec(s.slice((m.index ?? 0) + m[0].length))?.[1];
      const where = on && [...groups.keys()].some((k) => k.toLowerCase().split(' ')[0] === on) ? on : '';
      const what = /vacuum/.test(kind) ? 'Vacuum OK' : /float|level/.test(kind) ? cap(`${pre || 'tank level'} ${base}`)
        : /pressure/.test(kind) ? `${cap(pre ? `${pre} ` : /\bair\b/.test(s) ? 'air ' : '')}pressure OK` : `${cap(pre ? `${pre} ` : where ? `${where} ` : '')}${base}`;
      const cat: IOCategory = /limit/.test(kind) ? 'Station 1' : isSwitch ? (/vacuum/.test(kind) ? 'Vacuum' : /pressure/.test(kind) && /\bair\b/.test(`${pre} ${s}`) ? 'Pneumatic' : 'Station 1') : 'Product Detection';
      // Numbered per kind of sensor (two prox sensors are 1 and 2, whatever came before).
      for (let i = 0; i < count; i++) {
        const k = counter.get(what) ?? 0;
        counter.set(what, k + 1);
        add(c, count > 1 ? `${what} ${k + 1}` : what, 'input', cat, deviceType, `${kind} (description)`);
      }
    }
    if (/\bover-?temperature (?:limit|switch|thermostat)\b/.test(s)) add(c, 'Heater over-temperature limit tripped', 'input', 'Station 1', 'other', 'Over-temperature limit');
  });
}

const BUTTON_WORDS = '(?:cycle start|cycle stop|start|stop|reset|acknowledge|jog forward|jog reverse|jog|up|down|forward|reverse|raise|lower)';

function operator(text: string, c: Ctx, hasPanel: boolean, hoist: string | undefined) {
  const why = 'Operator device (description)';
  const press = /\bpress\b/.test(text) && !/\bpress(?:es|ed)?\s+(?:the\s+)?(?:two-hand|start|button)/.test(text);
  if (/\btwo[- ]hand\b/.test(text)) {
    if (press) {
      // On a press the two-hand control is a safety function: a two-hand safety module, its status to the PLC.
      add(c, 'Two-hand control OK (two-hand safety module)', 'input', 'Safety', 'safety-relay-output', 'Two-hand control on a press');
      ask(c, 'Two-hand control on a press needs a two-hand safety module (EN ISO 13851, type IIIC); its status is one PLC input. Does the PLC also read both buttons?');
    } else {
      add(c, 'Two-hand start button left', 'input', 'Operator/HMI', 'pushbutton-no', 'Two-hand start');
      add(c, 'Two-hand start button right', 'input', 'Operator/HMI', 'pushbutton-no', 'Two-hand start');
      ask(c, 'Two-hand start: the two buttons belong on a two-hand safety module (EN ISO 13851, type IIIC); the PLC reads the buttons for the cycle, and the module\'s output is the safety signal. Is there one?');
    }
  }
  // Buttons: "start button", "start/stop buttons", "Start, stop, reset, jog forward and jog reverse push buttons",
  // "up and down buttons", "start, stop … on the panel".
  const named = new Set<string>();
  for (const m of text.matchAll(new RegExp(String.raw`((?:(?<!e-|e)\b${BUTTON_WORDS}\s*(?:,|\/|\band\b)\s*)*(?<!e-|e)\b${BUTTON_WORDS})\s+(?:push[- ]?)?buttons?\b`, 'g'))) {
    for (const w of m[1].split(/\s*(?:,|\/|\band\b)\s*/)) if (w.trim()) named.add(w.trim());
  }
  for (const m of text.matchAll(new RegExp(String.raw`((?:(?<!e-|e)\b(?:start|stop|reset)\s*(?:,|\/|\band\b)\s*)*(?<!e-|e)\b(?:start|stop|reset))\b[^.]{0,30}\bon the (?:panel|door|cabinet|operator station|console)\b`, 'g'))) {
    for (const w of m[1].split(/\s*(?:,|\/|\band\b)\s*/)) if (w.trim()) named.add(w.trim());
  }
  const label: Record<string, [string, FieldDeviceType]> = { start: ['Start button', 'pushbutton-no'], 'cycle start': ['Cycle start button', 'pushbutton-no'], stop: ['Stop button', 'pushbutton-nc'], 'cycle stop': ['Cycle stop button', 'pushbutton-nc'], reset: ['Fault reset button', 'pushbutton-no'], acknowledge: ['Alarm acknowledge button', 'pushbutton-no'], jog: ['Jog button', 'pushbutton-no'], 'jog forward': ['Jog forward button', 'pushbutton-no'], 'jog reverse': ['Jog reverse button', 'pushbutton-no'] };
  for (const w of named) {
    const l = label[w] ?? [`${hoist ? `${hoist} ` : ''}${w} button`, 'pushbutton-no' as FieldDeviceType];
    add(c, l[0], 'input', 'Operator/HMI', l[1], why);
  }
  const sel = /\b([a-z]+)\s*\/\s*([a-z]+)\s+selector\b/.exec(text);
  if (sel) add(c, `${cap(sel[2])} mode selected`, 'input', 'Operator/HMI', 'selector', `${sel[1]}/${sel[2]} selector`);
  else if (/\b(?:mode|auto\/manual|manual\/auto) selector\b/.test(text)) add(c, 'Auto mode selected', 'input', 'Operator/HMI', 'selector', 'Mode selector');
  // Lamps: "a green running lamp and red fault lamp"
  for (const m of text.matchAll(/\b(green|red|amber|yellow|white|blue)\s+([a-z]+\s+)?(?:lamp|pilot light|light)\b(?!\s+curtain)/g)) {
    if (/stack/.test(m[0])) continue;
    add(c, `${cap(m[2]?.trim() || m[1])} lamp${m[2] ? ` (${m[1]})` : ''}`, 'output', 'Operator/HMI', 'pilot-light', 'Pilot lamp');
  }
  if (/\bstack ?lights?\b|\blight tower\b|\bbeacon\b/.test(text)) {
    const colours = ['green', 'amber', 'red', 'blue', 'white'].filter((k) => new RegExp(String.raw`\bstack ?light[^.]*\b${k}\b|\b${k}\b[^.]*\bstack ?light`).test(text));
    for (const k of colours.length ? colours : ['green', 'amber', 'red']) add(c, `Stack light ${k}`, 'output', 'Operator/HMI', 'stack-light', 'Stack light');
    if (!colours.length) ask(c, 'The stack light is given green, amber and red: say if it has other colours or a buzzer.');
  }
  if (/\b(?:horn|buzzer|siren|sounder)\b/.test(text)) add(c, `Alarm ${/\bbuzzer\b/.test(text) ? 'buzzer' : 'horn'}`, 'output', 'Operator/HMI', 'other', 'Audible alarm');
  const pendant = /\bpendant\b/.test(text) && named.size > 0;
  const start = [...named].some((w) => /start/.test(w)) || /\btwo[- ]hand\b/.test(text);
  const stop = [...named].some((w) => /stop/.test(w));
  if (!hasPanel && !pendant) {
    if (!start && !stop) ask(c, 'No start / stop buttons are named: how does the operator start and stop the machine?');
    else if (start && !stop) ask(c, 'No stop button is named: how is the machine stopped (a stop button, or the E-stop only)?');
  }
}

function safety(text: string, original: string, c: Ctx) {
  const parts = [
    /\be-?stops?\b|\bemergency stops?\b/.test(text) && 'E-stop',
    /\bguard\b|\binterlocked door\b|\bguard doors?\b|\bshear guard\b/.test(text) && 'guard door',
    /\blight curtains?\b/.test(text) && 'light curtain',
    /\bsafety mats?\b/.test(text) && 'safety mat',
    /\bpull[- ]?cords?\b/.test(text) && 'pull-cord',
  ].filter((x): x is string => Boolean(x));
  if (parts.length) add(c, `Safety relay OK (${parts.join(', ')})`, 'input', 'Safety', 'safety-relay-output', 'Safety devices go to a safety relay; the PLC sees its status');
  else if (/\bno e-?stop\b|\bwithout (?:an? )?e-?stop\b/.test(original.toLowerCase())) ask(c, "No E-stop on this machine: is the cell's safety status brought to this PLC (a Cell safety OK input)?");
  else ask(c, 'No E-stop is named: a machine needs one (wired to a safety relay). Which safety devices does it have?');
  if (/\blight curtains?\b/.test(text)) add(c, 'Light curtain clear', 'input', 'Safety', 'safety-relay-output', 'Light curtain status (safety relay)');
  // A guard door with an interlock: its status to the PLC as well.
  if (/\binterlocked (?:guard )?doors?\b|\bdoor interlocks?\b|\bguard doors? with (?:an? )?interlocks?\b|\bguard with an interlocked door\b/.test(text)) {
    add(c, /\bguard doors\b/.test(text) ? 'Guard doors closed' : 'Guard door closed', 'input', 'Safety', 'limit-switch', 'Guard door status');
  }
}

const RANGE_SRC = String.raw`\b4\s*[-–…]\s*20\s*ma\b|\b0\s*[-–…]\s*20\s*ma\b|\b0\s*[-–…]\s*10\s*v\b|\b0\s*[-–…]\s*5\s*v\b`;
const rangeName = (m: string): AnalogRange | null => {
  const x = m.replace(/\s+/g, '').toLowerCase();
  return x.startsWith('4') ? '4-20mA' : /^0.?20/.test(x) ? '0-20mA' : /^0.?10/.test(x) ? '0-10V' : /^0.?5/.test(x) ? '0-5V' : null;
};
const UNITS: [RegExp, Omit<AnalogSpec, 'range'>][] = [
  [/pressure/, { min: 0, max: 100, units: 'psi' }], [/flow/, { min: 0, max: 100, units: 'gpm' }], [/level/, { min: 0, max: 100, units: '%' }],
  [/temp/, { min: 0, max: 150, units: '°C' }], [/weigh|load/, { min: 0, max: 1000, units: 'kg' }],
];
/** An engineering range the text states ("0-250 bar", "0 to 5 m", "0–150 °C"), not a signal range. */
const ENG_RE = /\b(-?\d+(?:\.\d+)?)\s*(?:[-–…]|to)\s*(-?\d+(?:\.\d+)?)\s*(bar|psi|kpa|mpa|m|mm|cm|%|°c|°f|gpm|l\/min|m3\/h|kg|t|lb|rpm|hz)(?![a-z])/gi;

function process(rawSentences: string[], sentences: string[], c: Ctx) {
  const heater = sentences.some((x) => /\bseal(?:ing)? bar\b/.test(x)) ? 'Seal bar' : 'Heater';
  sentences.forEach((s, si) => {
    const raw = rawSentences[si] ?? '';
    // Same length as the description's sentence, so a list's position finds the ranges written after it.
    const low = s.replace(new RegExp(RANGE_SRC, 'gi'), (m) => ' '.repeat(m.length)).replace(/[#~]/g, ' ');
    const signals = [...raw.matchAll(new RegExp(RANGE_SRC, 'gi'))];
    const all = [...raw.matchAll(ENG_RE)];
    const lists = [...low.matchAll(/((?:[a-z-]+\s+){0,3}?(?:pressure|flow|level|temperature|weight)(?:\s*(?:,|and)\s*(?:[a-z-]+\s+){0,2}?(?:pressure|flow|level|temperature|weight))*)\s+(transmitters?|sensors?|transducers?)\b/g)];
    lists.forEach((list, li) => {
      const items = list[1].split(/\s*,\s*|\s+and\s+/).map((x) => clean(x.replace(/^.*\b(?:with|a|an|the|of|on|for|has|have|all|its|is|are)\s+/, '').replace(/^[^a-z]+/, ''))).filter((x) => /\b(?:pressure|flow|level|temperature|weight)\b/.test(x));
      const end = (list.index ?? 0) + list[0].length;
      const next = lists[li + 1]?.index ?? Infinity;
      const after = (r: RegExpMatchArray) => (r.index ?? 0) >= end && (r.index ?? 0) < next && (r.index ?? 0) - end < 40;
      // The signal and the ranges written right after this list ("a pressure transmitter 0-250 bar 4-20 mA"),
      // else those of the sentence when it has one list.
      const sig = signals.find(after) ?? (lists.length === 1 ? signals[0] : undefined);
      const near = all.filter(after);
      const stated = near.length ? near : lists.length === 1 && items.length > 1 && all.length === items.length ? all : [];
      const unstated: string[] = [];
      const noun = singular(list[2]);
      for (const it of items) {
        const u = UNITS.find(([re]) => re.test(it))?.[1] ?? { min: 0, max: 100, units: '%' };
        const r = stated.length === items.length ? stated[items.indexOf(it)] : items.length === 1 ? stated[0] : undefined;
        if (!r) unstated.push(it);
        add(c, `${cap(it)} ${noun === 'sensor' ? 'transmitter' : noun}`, 'input', 'Analog/Process', 'other', 'Transmitter (description)', { range: (sig && rangeName(sig[0])) ?? '4-20mA', ...(r ? { min: Number(r[1]), max: Number(r[2]), units: r[3] } : u) });
      }
      if (unstated.length) ask(c, `Ranges of ${unstated.join(', ')} are assumed (${UNITS.filter(([re]) => unstated.some((i) => re.test(i))).map(([, u]) => `0–${u.max} ${u.units}`).join(', ')})${sig ? '' : ' on 4-20 mA'}: give each transmitter's real range.`);
    });
    if (/\bthermocouple\b/.test(s) && !/\btransmitter\b/.test(s) && !c.out.some((p) => /\(thermocouple\)$/.test(p.description))) {
      add(c, `${heater} temperature (thermocouple)`, 'input', 'Analog/Process', 'other', 'Thermocouple read by the PLC', { range: 'thermocouple', min: 0, max: 300, units: '°C' });
    }
    if (/\bheat(?:er|ed|ing)\b/.test(s) && !/\bheat(?:er|ed)? exchanger\b/.test(s)) add(c, `${heater} heater on`.replace(/^Heater heater/, 'Heater'), 'output', 'Station 1', 'other', 'Heater (description)');
  });
}

function motion(text: string, sentences: string[], groups: Map<string, string[]>, c: Ctx) {
  const m = new RegExp(String.raw`(?:\b${COUNT}\s+)?(?:#+\s+)?(?:[a-z-]+\s+)?servo(?:s|\s+(?:axis|axes|motors?|drives?))?\b`).exec(text);
  // The drive runs the flying shear / electronic cam itself: the PLC enables it and engages the cam.
  const cam = /\bflying[- ]shear function\b|\be-?cam\b|\belectronic cam\b|\bcam (?:profile|function)\b/.test(text);
  if (m) {
    const n = /\baxes\b|servos\b/.test(m[0]) ? Math.max(2, countOf(m[1])) : countOf(m[1]);
    const by = /\b((?:[a-z-]+\s+)?[a-z-]+)\s+(?:is\s+)?driven by an? servo\b/.exec(text)?.[1].split(/\s+/).filter((w) => !STOP.test(w)).join(' ');
    const what = by ? `${cap(by)} servo` : /flying shear/.test(text) && n === 1 ? 'Flying shear servo' : 'Servo axis';
    for (const name of names(what, n)) {
      const why = `${name} (servo drive handshake)`;
      if (cam) {
        for (const o of ['enable', 'cam engage', 'alarm reset']) add(c, `${name} ${o}`, 'output', 'Servo/Axis', 'servo-drive', why);
        for (const i of ['ready', 'fault']) add(c, `${name} ${i}`, 'input', 'Servo/Axis', 'servo-drive', why);
        if (/\bcut signal\b|\bcut command\b/.test(text)) add(c, `${/flying shear/.test(name.toLowerCase()) ? name.replace(/ servo$/, '') : name} cut command (drive output)`, 'input', 'Servo/Axis', 'servo-drive', why);
      } else {
        for (const o of ['enable', 'start move', 'home']) add(c, `${name} ${o}`, 'output', 'Servo/Axis', 'servo-drive', why);
        for (const i of ['in position', 'fault']) add(c, `${name} ${i}`, 'input', 'Servo/Axis', 'servo-drive', why);
      }
    }
    ask(c, 'Servo axes are given the usual handshake with the drive: check it against the drive (positions over a network need no extra points).');
  }
  // An encoder that is the servo drive's master goes to the drive, not to the PLC.
  const enc = sentences.find((s) => /\bencoders?\b/.test(s));
  if (enc) {
    if (/\bservo drive\b|\bdrive'?s\b|\bmaster\b|\bfollow(?:s|ing)\b/.test(enc)) ask(c, 'The encoder is wired to the servo drive (its master input): does the PLC also read it on a high-speed counter?');
    else {
      const on = /\bencoder on the ([a-z-]+(?:\s+[a-z-]+)?)/.exec(enc)?.[1];
      const conv = on && [...groups.keys()].find((k) => k.toLowerCase() === on.replace(/\s+conveyor$/, ' conveyor'));
      const base = conv ? `${conv} encoder` : 'Encoder';
      add(c, `${base} channel A`, 'input', 'Servo/Axis', 'encoder', 'Encoder (description)');
      add(c, `${base} channel B`, 'input', 'Servo/Axis', 'encoder', 'Encoder (description)');
      ask(c, 'The encoder is given A / B inputs on the PLC\'s high-speed counter: is it wired to the PLC or to a drive?');
    }
  }
  if (/\bvacuum\b/.test(text.replace(/\bvacuum switch(?:es)?\b/g, ''))) add(c, 'Vacuum on', 'output', 'Vacuum', 'solenoid', 'Vacuum');
}

function jog(text: string, groups: Map<string, string[]>, c: Ctx) {
  // Jog buttons on a VFD drive: the drive's reverse and jog-speed inputs.
  const vfd = c.out.find((p) => / VFD run$/.test(p.description))?.description.replace(/ VFD run$/, '');
  if (!vfd || !/\bjog\b/.test(text)) return;
  if (/\bjog reverse\b|\bjog backward\b/.test(text)) add(c, `${vfd} VFD reverse`, 'output', 'Station 1', 'vfd-input', 'Jog reverse on the VFD');
  add(c, `${vfd} VFD jog speed (preset)`, 'output', 'Station 1', 'vfd-input', 'Jog speed preset on the VFD');
  void groups;
}

function external(text: string, c: Ctx) {
  for (const m of text.matchAll(/\bready signal from (?:the )?((?:[a-z-]+\s+)?[a-z-]+?)(?=\s*(?:[.,;]|\band\b|$))|\b([a-z-]+(?:\s+[a-z-]+)?) ready signal\b(?! from)/g)) {
    const raw = (m[1] ?? m[2]).replace(/\s+(?:and|or|on|in)$/, '').split(/\s+/).filter((w) => !STOP.test(w)).join(' ');
    if (!raw) continue;
    add(c, `${cap(raw)} ready`, 'input', 'External Machine', 'other', `Handshake with the ${raw}`);
  }
  if (/\brobots?\b/.test(text)) {
    // The signals the description lists, else the usual ready / cycle done / fault and start.
    const sig = (re: RegExp) => re.test(text);
    const ins: string[] = [], outs: string[] = [];
    if (sig(/\bready\b/)) ins.push('Robot ready');
    if (sig(/\bcycle (?:complete|done|finished)\b/)) ins.push('Robot cycle complete');
    if (sig(/\bfault\b/)) ins.push('Robot fault');
    if (sig(/\b(?:in |at )?home(?: position)?\b/)) ins.push('Robot at home');
    if (sig(/\bcycle start\b/)) outs.push('Robot cycle start');
    else if (sig(/\bsends? start\b|\bplc sends\b[^.]*\bstart\b|\bstart cycle\b/)) outs.push('Robot start cycle');
    if (sig(/\babort\b/)) outs.push('Robot abort');
    const listed = ins.length + outs.length > 0 && /\brobot (?:handshake|signals?)\b|\brobot (?:ready|fault)\b|\bplc sends\b/.test(text);
    for (const d of listed ? ins : ['Robot ready', 'Robot cycle done', 'Robot fault']) add(c, d, 'input', 'External Machine', 'other', 'Robot handshake');
    for (const d of listed ? outs : ['Robot start cycle']) add(c, d, 'output', 'External Machine', 'relay-coil', 'Robot handshake');
    if (!listed) ask(c, 'The robot is given ready / cycle done / fault inputs and a start-cycle output: list its other signals (program number, home, zone clear) if it has them.');
  }
  for (const m of text.matchAll(/\b(upstream|downstream)\s+((?:[a-z-]+\s+)?[a-z-]+?)(?=\s*(?:[.,;]|\band\b|\binterlock|$))/g)) {
    const who = clean(`${m[1]} ${m[2].split(/\s+/).filter((w) => !STOP.test(w)).join(' ')}`);
    if (m[1] === 'upstream') { add(c, `${cap(who)} ready`, 'input', 'External Machine', 'other', 'Handshake'); add(c, `Ready to receive from ${who}`, 'output', 'External Machine', 'relay-coil', 'Handshake'); }
    else { add(c, `${cap(who)} ready to receive`, 'input', 'External Machine', 'other', 'Handshake'); add(c, `${/\bpallet/.test(text) ? 'Pallet' : 'Part'} ready for ${who}`, 'output', 'External Machine', 'relay-coil', 'Handshake'); }
  }
}

/** The I/O list the rules read from the machine description. `noPanel`: the machine has no touch panel. */
export function ioFromDescription(spec: SpecSections | string, opts: { noPanel?: boolean } = {}): RulesIo {
  const text = typeof spec === 'string' ? spec : specToText(spec);
  if (!text.trim()) return { points: [], explanation: 'The description is empty: nothing to read.', questions: ['Describe the machine first (its equipment, sensors and operator devices).'], reasoning: null };
  if (notEnglish(text)) return { points: [], explanation: 'The description is not in English: the rules read English only.', questions: ['The description is not in English: the rules read English descriptions only. Write it in English, or use the AI (which reads other languages).'], reasoning: null };
  // Sentences end at a full stop, "!" or "?" (a ";" joins two halves of one sentence: "…on a VFD; speed is set on the screen").
  const split = (t: string) => t.replace(/\s*\n+\s*/g, '. ').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const rawSentences = split(text);
  const prepared = prepare(text);
  const sentences = split(prepared);
  const c: Ctx = { out: [], questions: [], seen: new Set() };
  const hasPanel = !opts.noPanel && /\btouch ?(?:screen|panel)\b|\bhmi\b|\bscreen\b/.test(prepared);
  safety(prepared, text, c);
  const groups = motors(sentences, prepared, c);
  const hoist = [...groups.keys()].find((k) => /^(?:hoist|winch)$/i.test(k));
  operator(prepared, c, hasPanel, hoist);
  const used = actuators(sentences, c);
  motion(prepared, sentences, groups, c);
  jog(prepared, groups, c);
  sensors(sentences, groups, used, c);
  process(rawSentences.length === sentences.length ? rawSentences : sentences, sentences, c);
  external(prepared, c);
  if (/\bpress\b/.test(prepared) && !c.out.some((p) => p.category === 'Pneumatic')) ask(c, 'What moves the press: its valves (down / up / pressure) and position sensors?');
  if (/\bpick and place\b/.test(prepared) && !c.out.some((p) => /slide|cylinder|servo/i.test(p.description))) ask(c, 'What moves the pick and place (cylinders, slides, servos)?');
  const ins = c.out.filter((p) => p.type === 'input'), outs = c.out.filter((p) => p.type === 'output');
  const an = c.out.filter((p) => p.signal === 'analog').length;
  const explanation = `Read by the rules from the description (no AI): ${ins.length} inputs and ${outs.length} outputs${an ? `, ${an} of them analog` : ''}. Check the list: the rules read only the equipment the description names.`;
  return { points: c.out, explanation, questions: c.questions, reasoning: null };
}
