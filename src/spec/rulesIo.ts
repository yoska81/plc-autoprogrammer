/**
 * A first I/O list from the machine description, by plain rules (no AI, no key): the equipment the description
 * names — motors (across the line, reversing, two-speed, star-delta or on a VFD), servos, encoders, cylinders and
 * valves (pneumatic or hydraulic), vacuum, sensors, switches, buttons, selectors, lamps, stack lights, safety devices,
 * transmitters, heaters and other machines' handshakes — each gives the PLC points the AI prompt
 * (src/lib/ai/ioAI.ts) asks for, with descriptions in the same drawing style, so a later AI run keeps them (and their
 * wiring). Never invented: what the description says is absent ("no stack light", "the heater is not used") gives no
 * point, and what the rules cannot read is asked in `questions`. The result has the shape of generateIOFromSpec's,
 * so planIOMerge / applyIOUpdate take it unchanged.
 */
import type { GeneratedPoint } from '../lib/ai/ioAI';
import type { AnalogRange, AnalogSpec, IOCategory } from '../types/io';
import type { FieldDeviceType } from '../electrical/types';
import { specToText, type SpecSections } from './types';

export interface RulesIo { points: GeneratedPoint[]; explanation: string; questions: string[]; reasoning: null }

const NUM: Record<string, number> = { a: 1, an: 1, one: 1, single: 1, two: 2, both: 2, 'pair of': 2, twin: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const countOf = (w: string | undefined) => (w ? (NUM[w.toLowerCase()] ?? (/^\d+$/.test(w) ? Number(w) : 1)) : 1);
const COUNT = String.raw`(\d+|a|an|one|single|two|both|pair of|twin|three|four|five|six|seven|eight|nine|ten)`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
/** Words that never name a device ("the", "is", "each", a count). */
const STOP = /^(?:a|an|the|is|are|was|be|been|has|have|had|with|and|or|of|in|on|at|to|by|for|from|each|every|its|their|this|that|these|those|which|when|then|one|two|three|four|five|six|seven|eight|nine|ten|both|single|twin|pair|\d+|it|there|also|plus|all|any|some|new|old)$/;
const singular = (w: string) => w.replace(/eyes$/, 'eye').replace(/(switch|box)es$/, '$1').replace(/ies$/, 'y').replace(/s$/, '');

/**
 * The text with figures that are not counts taken out ("1.5 kW servo" is one servo, "2 HP motor" one motor), and the
 * device names the description says are absent ("no stack light", "the heater is not used") struck, so no rule
 * reads them.
 */
function prepare(text: string): string {
  let t = text.toLowerCase();
  t = t.replace(/\b\d+(?:[.,]\d+)?\s*(?:kw|hp|w|kva|v|vac|vdc|a|ma|mm|cm|m|ppr|bar|psi|kpa|mpa|°c|°f|hz|rpm|ms|s|min|kg|t|l\/min|gpm|in|inch|"|%)(?![a-z])/g, (m) => '#'.repeat(m.length));
  // "no X", "without X", "no X and no Y", "X is not used / not needed / not fitted"
  t = t.replace(/\b(?:no|without|not\s+(?:a|any)|never\s+a)\s+((?:[a-z-]+\s+){0,2}?[a-z-]+)(?=\s*(?:[.,;:]|\band\b|\bor\b|$))/g, (m) => '~'.repeat(m.length));
  t = t.replace(/\b((?:the\s+)?(?:[a-z-]+\s+){0,2}?[a-z-]+)\s+(?:is|are)\s+not\s+(?:used|needed|required|fitted|installed|present|wired)\b/g, (m) => '~'.repeat(m.length));
  return t;
}

/** The text is not in English: the rules read English only (they must not say "no E-stop is named" of a German text). */
function notEnglish(text: string): boolean {
  const words = text.toLowerCase().match(/[a-zà-ÿ]+/g) ?? [];
  if (words.length < 6) return false;
  const en = words.filter((w) => /^(the|and|with|is|are|on|of|to|a|an|for|by|at|in|it|from|each|has|have|when|then)$/.test(w)).length;
  const other = words.filter((w) => /^(und|der|die|das|mit|ist|ein|eine|für|von|le|la|les|et|avec|est|un|une|pour|des|el|los|las|con|para|una|y|il|di|che|per)$/.test(w)).length;
  return other > en;
}

interface Ctx { out: GeneratedPoint[]; questions: string[]; seen: Set<string> }

function add(c: Ctx, description: string, type: 'input' | 'output', category: IOCategory, deviceType: FieldDeviceType, reason: string, analog?: AnalogSpec) {
  const d = clean(cap(description));
  if (c.seen.has(d.toLowerCase())) return;
  c.seen.add(d.toLowerCase());
  c.out.push({ description: d, type, category, deviceType, reason, signal: analog ? 'analog' : 'discrete', analog: analog ?? null });
}

/** Names for n items of one kind: "Conveyor" for one, "Conveyor 1"… for several. */
const names = (base: string, n: number) => (n > 1 ? Array.from({ length: n }, (_, i) => `${base} ${i + 1}`) : [base]);

/** Motor-driven equipment, as written → the name used on the drawing. */
const MOTOR_NOUNS: [string, string][] = [
  ['(?:belt\\s+)?conveyors?|belts', 'Conveyor'], ['pumps?', 'Pump'], ['fans?', 'Fan'], ['blowers?', 'Blower'],
  ['agitators?', 'Agitator'], ['mixers?', 'Mixer'], ['compressors?', 'Compressor'], ['spindles?', 'Spindle'],
  ['unwinders?', 'Unwinder'], ['rewinders?', 'Rewinder'], ['augers?', 'Auger'], ['hoists?', 'Hoist'], ['winches?', 'Winch'],
];
const VFD_RE = /\bvfds?\b|\bvariable[- ]speed\b|\binverters?\b|\bfrequency (?:drive|converter)s?\b|\bon (?:a |its own )?drives?\b/;
/** Qualifiers that make two groups of one kind ("infeed and outfeed conveyors"). */
const QUAL = '(?:infeed|outfeed|discharge|transfer|feed|main|takeaway|take-away|accumulation|reject|incline|decline|upper|lower|left|right|front|rear|hydraulic|coolant|vacuum|water|oil|lube|lubrication|exhaust|supply|return|circulation|dosing|metering|roll|forming)';

function starter(s: string): 'vfd' | 'reversing' | 'two-speed' | 'star-delta' | 'dol' {
  if (VFD_RE.test(s)) return 'vfd';
  if (/\bstar[- ]delta\b|\bwye[- ]delta\b|\by[- ]delta\b/.test(s)) return 'star-delta';
  if (/\btwo[- ]speed\b|\b2[- ]speed\b|\bdahlander\b/.test(s)) return 'two-speed';
  if (/\brevers(?:ing|ible)\b|\bforward and reverse\b|\bboth directions\b|\bup and down\b/.test(s)) return 'reversing';
  return 'dol';
}

function motorPoints(c: Ctx, name: string, kind: ReturnType<typeof starter>, s: string, category: IOCategory) {
  const why = `${name} motor (description)`;
  if (kind === 'vfd') {
    add(c, `${name} VFD run`, 'output', category, 'vfd-input', why);
    if (/\brevers|\bforward and reverse\b|\bboth directions\b|\bup and down\b/.test(s)) add(c, `${name} VFD reverse`, 'output', category, 'vfd-input', why);
    add(c, `${name} VFD fault`, 'input', category, 'vfd-input', why);
    if (!/\brun and fault only\b/.test(s) && /\bspeed\b|\bsetpoint\b|\bpid\b|\bholding\b|\bfrom the (?:screen|hmi|panel)\b/.test(s)) {
      add(c, `${name} speed reference`, 'output', 'Analog/Process', 'other', why, { range: '0-10V', min: 0, max: 60, units: 'Hz' });
      c.questions.push(`The speed reference of ${name} is taken as 0-10 V = 0–60 Hz: check the drive's analog input.`);
    }
    return;
  }
  const hoist = /hoist|winch|lift/i.test(name);
  // A hoist runs both ways: up and down contactors even when the description does not say "reversing".
  if (kind === 'reversing' || (hoist && kind === 'dol')) {
    add(c, `${name} ${hoist ? 'up' : 'forward'} contactor`, 'output', category, 'contactor-coil', why);
    add(c, `${name} ${hoist ? 'down' : 'reverse'} contactor`, 'output', category, 'contactor-coil', why);
  } else if (kind === 'two-speed') {
    add(c, `${name} low speed contactor`, 'output', category, 'contactor-coil', why);
    add(c, `${name} high speed contactor`, 'output', category, 'contactor-coil', why);
  } else if (kind === 'star-delta') {
    for (const k of ['main', 'star', 'delta']) add(c, `${name} ${k} contactor`, 'output', category, 'contactor-coil', why);
  } else add(c, `${name} motor contactor`, 'output', category, 'contactor-coil', why);
  add(c, `${name} overload tripped`, 'input', category, 'other', why);
  if (hoist) { add(c, `${name} upper limit`, 'input', 'Station 1', 'limit-switch', why); add(c, `${name} lower limit`, 'input', 'Station 1', 'limit-switch', why); }
}

function motors(sentences: string[], c: Ctx): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const s of sentences) {
    for (const [src, noun] of MOTOR_NOUNS) {
      // "two belt conveyors", "infeed and outfeed conveyors", "the hydraulic pump"
      // The counted mention first ("Water pump skid with two pumps": two pumps); "pump skid" names the machine.
      const mentions = [...s.matchAll(new RegExp(String.raw`(?:\b${COUNT}\s+)?(?:#+\s+)?(?:(${QUAL})(?:\s+and\s+(${QUAL}))?\s+)?(?:[a-z-]+\s+)?\b(?:${src})\b(?!\s+(?:skid|station|unit|room|house|set|package|system|cell|line))`, 'g'))]
        .sort((a, b) => countOf(b[1]) - countOf(a[1]));
      for (const m of mentions) {
        // "Each belt has a motor" speaks of a group counted before.
        if (new RegExp(String.raw`\beach\s+(?:${src})\b`).test(m[0]) || (/^each\b/.test(s) && groups.has(noun))) continue;
        const quals = [m[2], m[3]].filter(Boolean) as string[];
        const keys = quals.length ? quals.map((q) => `${cap(q)} ${noun.toLowerCase()}`) : [noun];
        const drivenByNature = !/^(Spindle|Unwinder|Rewinder)$/.test(noun) || /\bmotor\b|\bdriven\b|#|\bvfd\b|\bruns?\b/.test(s);
        if (!drivenByNature) continue;
        for (const key of keys) {
          // A plain "the pump" after "the hydraulic pump" is the same pump.
          if (groups.has(key) || (!quals.length && [...groups.keys()].some((k) => k.endsWith(` ${noun.toLowerCase()}`)))) continue;
          const n = quals.length > 1 ? 1 : countOf(m[1]);
          const label = noun === 'Unwinder' && /\bfilm\s+unwinder/.test(s) ? 'Film unwinder' : key;
          groups.set(key, names(label, n));
          const each = sentences.find((x) => new RegExp(String.raw`\beach\s+(?:${src})\b`).test(x)) ?? '';
          const kind = starter(`${s} ${each}`);
          for (const name of groups.get(key)!) motorPoints(c, name, kind, `${s} ${each}`, noun === 'Conveyor' ? 'Conveyor' : 'Station 1');
        }
      }
    }
    // Any other motor named by what it drives: "5.5 kW main roll motor on a VFD", "the main drive".
    for (const m of s.matchAll(/\b((?:[a-z-]+\s+){0,2}?)(?:motor|main drive)\b(?!\s+(?:protector|overload|contactor|starter|circuit))/g)) {
      const pre = clean(m[1].split(/\s+/).filter((w) => w && !STOP.test(w) && !/^#+$/.test(w)).join(' '));
      if (MOTOR_NOUNS.some(([src]) => new RegExp(String.raw`\b(?:${src})\b`).test(pre)) || /servo|vfd|drive/.test(pre)) continue;
      const name = cap(/main drive/.test(m[0]) ? 'Main drive' : pre ? `${pre} motor` : 'Motor').replace(/ motor motor$/, ' motor');
      const key = name.replace(/ motor$/, '');
      if (groups.has(key) || [...groups.keys()].some((k) => k.toLowerCase() === key.toLowerCase())) continue;
      if (!pre && !/main drive/.test(m[0]) && groups.size) continue;
      groups.set(key, [key]);
      motorPoints(c, key, starter(s), s, 'Station 1');
    }
  }
  // "Hand-off-auto selector per pump": two selector inputs for each.
  const text = sentences.join(' ');
  if (/\bhand[- ]off[- ]auto\b|\bh-o-a\b/.test(text)) for (const [noun, list] of groups) if (new RegExp(String.raw`\bhand[- ]off[- ]auto\b[^.]*\b(?:per|each|for every)\s+${noun.split(' ').pop()!.toLowerCase()}`).test(text) || groups.size === 1) {
    for (const name of list) { add(c, `${name} selector in Hand`, 'input', 'Operator/HMI', 'selector', 'Hand-off-auto selector'); add(c, `${name} selector in Auto`, 'input', 'Operator/HMI', 'selector', 'Hand-off-auto selector'); }
  }
  if (!groups.size && VFD_RE.test(text)) c.questions.push('A VFD is named but not the motor it drives: which motor is on the VFD (run, fault and speed reference points)?');
  return groups;
}

const ACT = /^(slide|cylinder|pusher|clamp|gate|stopper|ram|punch|shear)(?:e?s)?$/;

/** Cylinders, slides, punches and valves (pneumatic or hydraulic): a solenoid each, and a sensor per end position. */
function actuators(sentences: string[], c: Ctx) {
  const found: { name: string; ends: [string, string]; valveOnly: boolean }[] = [];
  const has = (n: string) => found.some((f) => f.name.toLowerCase() === n.toLowerCase());
  for (const s of sentences) {
    // Word by word: "two cylinders clamp the part" is two cylinders (clamp is what they do), "the X slide" one slide.
    const words = s.split(/\s+/).map((w) => w.replace(/[^a-z0-9#~-]/g, ''));
    words.forEach((w, i) => {
      const noun = ACT.exec(w)?.[1];
      if (!noun) return;
      const prev = words[i - 1] ?? '', prev2 = words[i - 2] ?? '';
      if (ACT.test(prev) || ['cylinders', 'slides', 'pushers'].includes(prev)) return;
      if (/^(?:cylinder|valve|solenoid|motor|pump|guard|sensor|switch|sensors|switches)$/.test(words[i + 1] ?? '')) return;
      const isCount = (x: string) => new RegExp(String.raw`^${COUNT}$`).test(x);
      const n = isCount(prev) ? countOf(prev) : isCount(prev2) ? countOf(prev2) : 1;
      const pre = isCount(prev) || STOP.test(prev) || /^(?:pneumatic|hydraulic|air|oil|end|#+|~+)$/.test(prev) || !prev ? '' : prev;
      const nameBase = cap(pre ? `${pre} ${noun}` : noun).replace(/^(\w) slide/i, (_, x: string) => `${x.toUpperCase()} slide`);
      // "Each slide has…" speaks of slides already named ("an X slide and a Z slide").
      if (!pre && found.some((f) => f.name.toLowerCase().includes(noun))) return;
      const updown = /\bup\b[^.]*\bdown\b|\bdown\b[^.]*\bup\b|\bvertical\b/.test(s) || /^(?:punch|shear|ram)$/.test(noun) || pre === 'press';
      for (const name of names(nameBase, n)) if (!has(name)) found.push({ name, ends: updown ? ['up', 'down'] : ['extended', 'retracted'], valveOnly: false });
    });
    // A head or plate that "comes down ... goes up" is a vertical cylinder.
    const head = /\b((?:heated\s+)?(?:sealing|press|cutting|capping)?\s*(?:head|plate|bar))\s+(?:comes|moves|goes)\s+(?:down|up)\b/.exec(s);
    if (head) { const name = cap(head[1].replace(/^heated\s+/, '').trim()); if (!has(name)) found.push({ name, ends: ['up', 'down'], valveOnly: false }); }
    // A valve named on its own ("dump valve", "hydraulic valve"): its solenoid only.
    for (const m of s.matchAll(/\b((?:[a-z-]+\s+){0,2}?)(?:solenoid\s+)?valves?\b/g)) {
      const pre = clean(m[1].split(/\s+/).filter((w) => w && !STOP.test(w)).join(' '));
      if (/^(?:pneumatic|air)?$/.test(pre) && found.length) continue;
      const name = cap(`${pre ? `${pre} ` : ''}valve`);
      if (!has(name) && !/cylinder|slide|pusher|clamp|gate|punch|shear/.test(pre)) found.push({ name, ends: ['open', 'closed'], valveOnly: true });
    }
  }
  const twoSensors = sentences.some((s) => /\b(?:two|2|both) end sensors\b|\bboth end\b|\bup and down sensors\b|\bextended and retracted\b/.test(s));
  for (const f of found) {
    const why = `${f.name} (description)`;
    if (f.valveOnly) { add(c, `${f.name} solenoid`, 'output', 'Pneumatic', 'solenoid', why); continue; }
    const [a, b] = f.ends;
    add(c, `${f.name} ${a === 'up' ? 'down' : 'extend'} solenoid`, 'output', 'Pneumatic', 'solenoid', why);
    if (a === 'up') add(c, `${f.name} up solenoid`, 'output', 'Pneumatic', 'solenoid', why);
    add(c, `${f.name} ${a}`, 'input', 'Pneumatic', 'sensor-pnp', why);
    add(c, `${f.name} ${b}`, 'input', 'Pneumatic', 'sensor-pnp', why);
  }
  const moving = found.filter((f) => !f.valveOnly);
  if (moving.length && !twoSensors) c.questions.push(`${moving.map((f) => f.name).join(', ')} ${moving.length > 1 ? 'are each' : 'is'} given a sensor at both end positions and ${moving.some((f) => f.ends[0] === 'up') ? 'a solenoid per direction for up / down' : 'one solenoid (spring return)'}: say if a position has no sensor or a valve has two coils.`);
}

const SENSOR_RE = /(photo-?eyes?|photocells?|photo sensors?|prox(?:imity)? (?:sensors?|switch(?:es)?)|inductive sensors?|capacitive sensors?|float switch(?:es)?|level switch(?:es)?|limit switch(?:es)?|pressure switch(?:es)?|vacuum switch(?:es)?|flow switch(?:es)?)/;

function sensors(sentences: string[], groups: Map<string, string[]>, c: Ctx) {
  const conveyors = [...groups.entries()].filter(([k]) => /conveyor$/i.test(k)).flatMap(([, v]) => v);
  const counter = new Map<string, number>();
  for (const s of sentences) {
    // "Each belt has ... a photo-eye at its end": one per conveyor.
    if (/^each\s+(?:belt|conveyor)\b/.test(s) && /photo-?eye|photocell/.test(s) && conveyors.length) {
      for (const name of conveyors) add(c, `${name} end photo-eye`, 'input', 'Product Detection', 'sensor-pnp', 'Photo-eye at the end of each conveyor');
      continue;
    }
    for (const m of s.matchAll(new RegExp(String.raw`(?:\b${COUNT}\s+)?((?:[a-z-]+\s+){0,2})${SENSOR_RE.source}\b`, 'g'))) {
      // The count may sit among the words before ("and two prox sensors"): the last count word counts.
      const preWords = m[2].split(/\s+/).filter(Boolean);
      const ci = preWords.map((w) => new RegExp(String.raw`^${COUNT}$`).test(w)).lastIndexOf(true);
      const count = ci >= 0 ? countOf(preWords[ci]) : countOf(m[1]);
      const kind = m[3];
      const pre = clean(preWords.slice(ci + 1).filter((w) => !STOP.test(w)).join(' '));
      const isSwitch = /switch/.test(kind);
      const deviceType: FieldDeviceType = /pressure|vacuum/.test(kind) ? 'pressure-switch' : /limit/.test(kind) ? 'limit-switch' : 'sensor-pnp';
      const base = kind.split(' ').map(singular).join(' ').replace(/^photo-?eye$/, 'photo-eye').replace(/^prox(imity)? /, 'proximity ');
      const what = /vacuum/.test(kind) ? 'Vacuum OK' : /float|level/.test(kind) ? cap(`${pre || 'tank level'} ${base}`)
        : /pressure/.test(kind) ? `${cap(pre ? `${pre} ` : /\bair\b/.test(s) ? 'air ' : '')}pressure OK` : `${cap(pre ? `${pre} ` : '')}${base}`;
      const cat: IOCategory = /limit/.test(kind) ? 'Station 1' : isSwitch ? (/vacuum/.test(kind) ? 'Vacuum' : /pressure/.test(kind) && /\bair\b/.test(`${pre} ${s}`) ? 'Pneumatic' : 'Station 1') : 'Product Detection';
      // Numbered per kind of sensor (two prox sensors are 1 and 2, whatever came before).
      for (let i = 0; i < count; i++) {
        const k = counter.get(what) ?? 0;
        counter.set(what, k + 1);
        add(c, count > 1 ? `${what} ${k + 1}` : what, 'input', cat, deviceType, `${kind} (description)`);
      }
    }
    if (/\bover-?temperature (?:limit|switch|thermostat)\b/.test(s)) add(c, 'Heater over-temperature limit tripped', 'input', 'Station 1', 'other', 'Over-temperature limit');
  }
}

function operator(text: string, c: Ctx, hasPanel: boolean) {
  const why = 'Operator device (description)';
  if (/\btwo[- ]hand\b/.test(text)) {
    add(c, 'Two-hand start button left', 'input', 'Operator/HMI', 'pushbutton-no', 'Two-hand start');
    add(c, 'Two-hand start button right', 'input', 'Operator/HMI', 'pushbutton-no', 'Two-hand start');
    c.questions.push('Two-hand start: the two buttons belong on a two-hand safety module (EN ISO 13851, type IIIC); the PLC reads the buttons for the cycle, and the module\'s output is the safety signal. Is there one?');
  }
  // A start / stop / reset named as a physical button (or "on the panel"); on a touch screen they are HMI buttons.
  const physical = (w: string) => new RegExp(String.raw`(?<!e-|e)\b(?:cycle\s+)?${w}(?:\s*/\s*\w+)?\s+(?:push)?buttons?|(?<!e-|e)\b${w}\b[^.]{0,40}\bon the (?:panel|door|cabinet|operator station|console)\b`).test(text) || (w !== 'reset' && /\bstart\s*\/\s*stop\b/.test(text));
  if (physical('start') || /\bstart, stop\b[^.]*\b(?:panel|door|console)\b/.test(text)) add(c, /\bcycle start\b/.test(text) ? 'Cycle start button' : 'Start button', 'input', 'Operator/HMI', 'pushbutton-no', why);
  if (physical('stop') || /\bstart\s*\/\s*stop\b|\bstart, stop\b[^.]*\b(?:panel|door|console)\b/.test(text)) add(c, 'Stop button', 'input', 'Operator/HMI', 'pushbutton-nc', why);
  if (physical('reset')) add(c, 'Fault reset button', 'input', 'Operator/HMI', 'pushbutton-no', why);
  const sel = /\b([a-z]+)\s*\/\s*([a-z]+)\s+selector\b/.exec(text);
  if (sel) add(c, `${cap(sel[2])} mode selected`, 'input', 'Operator/HMI', 'selector', `${sel[1]}/${sel[2]} selector`);
  else if (/\b(?:mode|auto\/manual|manual\/auto) selector\b/.test(text)) add(c, 'Auto mode selected', 'input', 'Operator/HMI', 'selector', 'Mode selector');
  if (/\bjog\b[^.]{0,30}\bbutton/.test(text)) add(c, 'Jog button', 'input', 'Operator/HMI', 'pushbutton-no', why);
  // Lamps: "a green running lamp and red fault lamp"
  for (const m of text.matchAll(/\b(green|red|amber|yellow|white|blue)\s+([a-z]+\s+)?(?:lamp|pilot light|light)\b(?!\s+curtain)/g)) {
    if (/stack/.test(m[0])) continue;
    add(c, `${cap(m[2]?.trim() || m[1])} lamp${m[2] ? ` (${m[1]})` : ''}`, 'output', 'Operator/HMI', 'pilot-light', 'Pilot lamp');
  }
  if (/\bstack ?lights?\b|\blight tower\b|\bbeacon\b/.test(text)) {
    const colours = ['green', 'amber', 'red', 'blue', 'white'].filter((k) => new RegExp(String.raw`\bstack ?light[^.]*\b${k}\b|\b${k}\b[^.]*\bstack ?light`).test(text));
    for (const k of colours.length ? colours : ['green', 'amber', 'red']) add(c, `Stack light ${k}`, 'output', 'Operator/HMI', 'stack-light', 'Stack light');
    if (!colours.length) c.questions.push('The stack light is given green, amber and red: say if it has other colours or a buzzer.');
  }
  if (/\b(?:horn|buzzer|siren|sounder)\b/.test(text)) add(c, `Alarm ${/\bbuzzer\b/.test(text) ? 'buzzer' : 'horn'}`, 'output', 'Operator/HMI', 'other', 'Audible alarm');
  if (!hasPanel && !c.out.some((p) => /start button|two-hand start/i.test(p.description))) c.questions.push('No start / stop buttons are named: how does the operator start and stop the machine?');
}

function safety(text: string, c: Ctx) {
  const parts = [
    /\be-?stops?\b|\bemergency stops?\b/.test(text) && 'E-stop',
    /\bguard\b|\binterlocked door\b|\bguard door\b|\bshear guard\b/.test(text) && 'guard door',
    /\blight curtains?\b/.test(text) && 'light curtain',
    /\bsafety mats?\b/.test(text) && 'safety mat',
    /\bpull[- ]?cords?\b/.test(text) && 'pull-cord',
  ].filter((x): x is string => Boolean(x));
  if (parts.length) add(c, `Safety relay OK (${parts.join(', ')})`, 'input', 'Safety', 'safety-relay-output', 'Safety devices go to a safety relay; the PLC sees its status');
  else c.questions.push('No E-stop is named: a machine needs one (wired to a safety relay). Which safety devices does it have?');
  if (/\blight curtains?\b/.test(text)) add(c, 'Light curtain clear', 'input', 'Safety', 'safety-relay-output', 'Light curtain status (safety relay)');
  if (/\b(?:guard|interlocked) door\b|\bdoor interlock\b|\bguard with an interlock/.test(text)) add(c, 'Guard door closed', 'input', 'Safety', 'limit-switch', 'Guard door status');
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
/** An engineering range the text states ("0-250 bar", "0 to 5 m", "0–150 °C"), not a signal range. */
const ENG_RE = /\b(-?\d+(?:\.\d+)?)\s*(?:[-–…]|to)\s*(-?\d+(?:\.\d+)?)\s*(bar|psi|kpa|mpa|m|mm|cm|%|°c|°f|gpm|l\/min|m3\/h|kg|t|lb|rpm|hz)(?![a-z])/gi;

function process(rawSentences: string[], sentences: string[], c: Ctx) {
  const heater = sentences.some((x) => /\bseal(?:ing)? bar\b/.test(x)) ? 'Seal bar' : 'Heater';
  sentences.forEach((s, si) => {
    const raw = rawSentences[si] ?? '';
    const range = rangeOf(raw);
    // Signal ranges are not part of a transmitter's name ("4-20 mA temperature transmitter").
    // Same length as the description's sentence, so a list's position finds the range written after it.
    const low = s.replace(new RegExp(RANGE_RE.source, 'gi'), (m) => ' '.repeat(m.length)).replace(/[#~]/g, ' ');
    // "Discharge pressure, flow, tank level and water temperature transmitters": every list in the sentence.
    for (const list of low.matchAll(/((?:[a-z-]+\s+){0,3}?(?:pressure|flow|level|temperature|weight)(?:\s*(?:,|and)\s*(?:[a-z-]+\s+){0,2}?(?:pressure|flow|level|temperature|weight))*)\s+(?:transmitters?|sensors?|transducers?)\b/g)) {
      const items = list[1].split(/\s*,\s*|\s+and\s+/).map((x) => clean(x.replace(/^.*\b(?:with|a|an|the|of|on|for|has|have|all|its|is|are)\s+/, '').replace(/^[^a-z]+/, ''))).filter(Boolean);
      const end = (list.index ?? 0) + list[0].length;
      const all = [...raw.matchAll(ENG_RE)];
      // The ranges written right after this list ("a pressure transmitter 0-250 bar"), else the sentence's own.
      const near = all.filter((r) => (r.index ?? 0) >= end && (r.index ?? 0) - end < 30);
      const stated = near.length ? near : all.length === items.length ? all : [];
      const unstated: string[] = [];
      for (const it of items) {
        const u = UNITS.find(([re]) => re.test(it))?.[1] ?? { min: 0, max: 100, units: '%' };
        // A range the sentence states for it (one item, or as many ranges as items in order).
        const r = stated.length === items.length ? stated[items.indexOf(it)] : items.length === 1 ? stated[0] : undefined;
        const spec = r ? { min: Number(r[1]), max: Number(r[2]), units: r[3] } : u;
        if (!r) unstated.push(it);
        add(c, `${cap(it)} transmitter`, 'input', 'Analog/Process', 'other', 'Transmitter (description)', { range: range ?? '4-20mA', ...spec });
      }
      if (unstated.length) c.questions.push(`Ranges of ${unstated.join(', ')} are assumed (${UNITS.filter(([re]) => unstated.some((i) => re.test(i))).map(([, u]) => `0–${u.max} ${u.units}`).join(', ')})${range ? '' : ' on 4-20 mA'}: give each transmitter's real range.`);
    }
    if (/\bthermocouple\b/.test(s) && !/\btransmitter\b/.test(s) && !c.out.some((p) => /\(thermocouple\)$/.test(p.description))) {
      add(c, `${heater} temperature (thermocouple)`, 'input', 'Analog/Process', 'other', 'Thermocouple read by the PLC', { range: 'thermocouple', min: 0, max: 300, units: '°C' });
    }
    if (/\bheat(?:er|ed|ing)\b/.test(s) && !/\bheat(?:er|ed)? exchanger\b/.test(s)) add(c, `${heater} heater on`.replace(/^Heater heater/, 'Heater'), 'output', 'Station 1', 'other', 'Heater (description)');
  });
}

function motion(text: string, c: Ctx) {
  const m = new RegExp(String.raw`(?:\b${COUNT}\s+)?(?:#+\s+)?(?:[a-z-]+\s+)?servo(?:s|\s+(?:axis|axes|motors?|drives?))?\b`).exec(text);
  if (m) {
    const n = /\baxes\b|servos\b/.test(m[0]) ? Math.max(2, countOf(m[1])) : countOf(m[1]);
    const what = /flying shear|shear/.test(text) && n === 1 ? 'Flying shear servo' : 'Servo axis';
    for (const name of names(what, n)) {
      const why = `${name} (servo drive handshake)`;
      for (const o of ['enable', 'start move', 'home']) add(c, `${name} ${o}`, 'output', 'Servo/Axis', 'servo-drive', why);
      for (const i of ['in position', 'fault']) add(c, `${name} ${i}`, 'input', 'Servo/Axis', 'servo-drive', why);
    }
    c.questions.push('Servo axes are given enable / start move / home outputs and in position / fault inputs: check them against the drive (positions over a network need no extra points).');
  }
  if (/\bencoders?\b/.test(text)) {
    add(c, 'Encoder channel A', 'input', 'Servo/Axis', 'encoder', 'Encoder (description)');
    add(c, 'Encoder channel B', 'input', 'Servo/Axis', 'encoder', 'Encoder (description)');
  }
  if (/\bvacuum\b/.test(text.replace(/\bvacuum switch(?:es)?\b/g, ''))) add(c, 'Vacuum on', 'output', 'Vacuum', 'solenoid', 'Vacuum');
}

function external(text: string, c: Ctx) {
  for (const m of text.matchAll(/\bready signal from (?:the )?((?:[a-z-]+\s+)?[a-z-]+?)(?=\s*(?:[.,;]|\band\b|$))|\b([a-z-]+(?:\s+[a-z-]+)?) ready signal\b(?! from)/g)) {
    const raw = (m[1] ?? m[2]).replace(/\s+(?:and|or|on|in)$/, '').split(/\s+/).filter((w) => !STOP.test(w)).join(' ');
    if (!raw) continue;
    add(c, `${cap(raw)} ready`, 'input', 'External Machine', 'other', `Handshake with the ${raw}`);
  }
  if (/\brobots?\b/.test(text)) {
    add(c, 'Robot ready', 'input', 'External Machine', 'other', 'Robot handshake');
    add(c, 'Robot cycle done', 'input', 'External Machine', 'other', 'Robot handshake');
    add(c, 'Robot fault', 'input', 'External Machine', 'other', 'Robot handshake');
    add(c, 'Robot start cycle', 'output', 'External Machine', 'relay-coil', 'Robot handshake');
    c.questions.push('The robot is given ready / cycle done / fault inputs and a start-cycle output: list its other signals (program number, home, zone clear) if it has them.');
  }
  for (const m of text.matchAll(/\b(upstream|downstream)\s+([a-z-]+)(?:\s+(machine|line|conveyor))?/g)) {
    const who = cap(clean(`${m[1]} ${m[2]} ${m[3] ?? ''}`));
    if (m[1] === 'upstream') { add(c, `${who} part available`, 'input', 'External Machine', 'other', 'Handshake'); add(c, `Ready to receive to ${who.toLowerCase()}`, 'output', 'External Machine', 'relay-coil', 'Handshake'); }
    else { add(c, `${who} ready to receive`, 'input', 'External Machine', 'other', 'Handshake'); add(c, `Part available to ${who.toLowerCase()}`, 'output', 'External Machine', 'relay-coil', 'Handshake'); }
  }
}

/** The I/O list the rules read from the machine description. `noPanel`: the machine has no touch panel. */
export function ioFromDescription(spec: SpecSections | string, opts: { noPanel?: boolean } = {}): RulesIo {
  const text = typeof spec === 'string' ? spec : specToText(spec);
  if (!text.trim()) return { points: [], explanation: 'The description is empty: nothing to read.', questions: ['Describe the machine first (its equipment, sensors and operator devices).'], reasoning: null };
  if (notEnglish(text)) return { points: [], explanation: 'The description is not in English: the rules read English only.', questions: ['The rules read English descriptions only: write the description in English, or use the AI (which reads other languages).'], reasoning: null };
  const split = (t: string) => t.replace(/\s*\n+\s*/g, '. ').split(/(?<=[.;!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const rawSentences = split(text);
  const prepared = prepare(text);
  const sentences = split(prepared);
  const c: Ctx = { out: [], questions: [], seen: new Set() };
  const hasPanel = !opts.noPanel && /\btouch ?(?:screen|panel)\b|\bhmi\b|\bscreen\b/.test(prepared);
  safety(prepared, c);
  operator(prepared, c, hasPanel);
  const groups = motors(sentences, c);
  actuators(sentences, c);
  motion(prepared, c);
  sensors(sentences, groups, c);
  process(rawSentences.length === sentences.length ? rawSentences : sentences, sentences, c);
  external(prepared, c);
  const ins = c.out.filter((p) => p.type === 'input'), outs = c.out.filter((p) => p.type === 'output');
  const an = c.out.filter((p) => p.signal === 'analog').length;
  const explanation = `Read by the rules from the description (no AI): ${ins.length} inputs and ${outs.length} outputs${an ? `, ${an} of them analog` : ''}. Check the list: the rules read only the equipment the description names.`;
  return { points: c.out, explanation, questions: [...new Set(c.questions)], reasoning: null };
}
