/**
 * Safety circuit, operator devices, field devices and the I/O wiring of the rule-based design, plus
 * the machine (field) wiring: zones, a junction box per zone with 4 or more field devices, routing.
 */
import type { IOPoint } from '../../types/io';
import type { CatalogCategory, CatalogPart, DesignComponent, FieldDeviceType, IOWiring, MachineWiring } from '../types';
import { deviceTypeOf, HEATER_RE, TWO_HAND_RE, type MachineModel } from './machineModel';
import type { ProcessResult } from './process';
import { comp, type MotorBranch, type Tags } from './power';
import { num, type Picker } from './select';

export const CABINET = 'Cabinet';
/** Input from a hardware over-temperature limit (not a sensor). */
export const OVER_TEMP_RE = /\b(over-?temp\w*|high[- ]?limit|temperature limit|limit alarm)\b/i;
const LIGHT_CURTAIN_RE = /\blight\s*curtain\b/i;
/** A guard-door / safety-gate input (the interlock's monitoring contact), not the cabinet door. */
const GUARD_RE = /\b(guard\s*door|safety\s*(gate|door)|interlock(ed)?\s*(door|gate|switch)|door\s*interlock|guard\s*(closed|switch|interlock))\b/i;
/** The closing (dangerous) stroke a two-hand control enables. */
const CLOSING_RE = /\b(down|close|closing|lower|clamp|press)\b/i;
export const DOOR = 'Cabinet door';

const STOP_WORDS = new Set(['the', 'and', 'for', 'motor', 'run', 'output', 'input', 'contactor', 'starter', 'coil', 'drive', 'vfd', 'forward', 'fwd', 'reverse', 'rev', 'fault', 'running', 'speed', 'ready', 'status']);
const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => (w.length > 2 || /^\d+$/.test(w)) && !STOP_WORDS.has(w)));
/** Shared words; numbers must agree ("Belt 2" is not "Belt 1 motor"). */
const shared = (a: string, b: string) => {
  const A = words(a), B = words(b);
  const na = [...A].filter((w) => /^\d+$/.test(w)), nb = [...B].filter((w) => /^\d+$/.test(w));
  if (na.length && nb.length && !na.some((n) => nb.includes(n))) return 0;
  return [...A].filter((w) => B.has(w)).length;
};

/** Loads a contactor or relay switches that are not motors: never attached to a motor branch by default. */
const NON_MOTOR_LOAD = /\b(heater|heaters|heating|element|oven|lamp|light|valve|brake|magnet|transformer|horn|sealer|seal bar|sealing bar)\b/i;

/**
 * The motor an I/O point belongs to: by its tag (M2, K3, VFD1), else most shared words with its description,
 * else the next motor not yet linked — but never a load that is not a motor (a heater contactor gets its own).
 */
export function motorFor(desc: string, branches: MotorBranch[], linked: Set<string>, kind: 'vfd' | 'contactor' | 'any'): MotorBranch | undefined {
  // "VFD1 run" / "drive 2 fault" is a drive branch, never a contactor-started motor with the same number
  const wantsDrive = kind === 'vfd' || (kind === 'any' && /\b(vfd|drive|inverter)\b/i.test(desc) && branches.some((b) => b.vfd));
  const pool = branches.filter((b) => (wantsDrive ? !!b.vfd : kind === 'any' || !b.vfd));
  const m = /\b(m|vfd|k)\s*-?(\d+)\b/i.exec(desc);
  if (m) {
    // the tag the description names, with its own prefix (VFD1 is a drive tag, not motor M1 or contactor K1)
    const want = `${m[1].toUpperCase()}${m[2]}`;
    const byTag = pool.find((b) => (m[1].toUpperCase() === 'M' ? b.motor.tag.toUpperCase() === want : m[1].toUpperCase() === 'VFD' ? b.vfd?.toUpperCase() === want : b.contactors.some((k) => k.toUpperCase() === want)));
    if (byTag) return byTag;
  }
  let best: MotorBranch | undefined, score = 0;
  for (const b of pool) { const s = shared(desc, b.motor.description); if (s > score) { best = b; score = s; } }
  if (best) return best;
  return NON_MOTOR_LOAD.test(desc) && !/\bmotor\b/i.test(desc) ? undefined : pool.find((b) => !linked.has(b.motor.tag));
}

export interface DeviceResult {
  components: DesignComponent[];
  ioWiring: IOWiring[];
  machine: MachineWiring;
  notes: string[];
  askUser: string[];
}

const REV = /\b(rev|reverse|backward)\b/i;
const ZONE_WORD = (z: string) => z.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !/^(zone|station)$/.test(w));

/** Zone a device belongs to: the zone sharing a word with its description (or "Zone 2" for "zone 2"), else the first zone. */
export function zoneOf(desc: string, zones: string[]): string {
  const d = desc.toLowerCase();
  const exact = zones.find((z) => d.includes(z.toLowerCase()));
  if (exact) return exact;
  return zones.find((z) => ZONE_WORD(z).some((w) => new RegExp(`\\b${w}`).test(d))) ?? zones[0];
}

/** Interposing / pilot / operator parts picked by words in the description. */
function pickPushbutton(pk: Picker, desc: string, nc: boolean): CatalogPart | null {
  const color = nc || /\bstop\b/i.test(desc) ? 'red' : /\b(start|run|on)\b/i.test(desc) ? 'green' : /\bjog|manual\b/i.test(desc) ? 'black' : /\b(ack|silence)\b/i.test(desc) ? 'yellow' : 'black';
  return pk.pick('pushbutton', (p) => String(p.ratings.color ?? '') === color && (nc ? /N\.C\./.test(String(p.ratings.contacts)) : /N\.O\./.test(String(p.ratings.contacts))))
    ?? pk.pick('pushbutton', (p) => (nc ? /N\.C\./ : /N\.O\./).test(String(p.ratings.contacts ?? '')));
}
function pickPilot(pk: Picker, desc: string): CatalogPart | null {
  const color = /\b(fault|alarm|trip|error|stop)/i.test(desc) ? 'red' : /\b(run|on|ok|ready|power)/i.test(desc) ? 'green' : /\b(warn|caution|manual|service)/i.test(desc) ? 'yellow' : 'blue';
  return pk.pick('pilotLight', (p) => String(p.ratings.color ?? '') === color && /24/.test(String(p.ratings.volts ?? ''))) ?? pk.pick('pilotLight', (p) => /24/.test(String(p.ratings.volts ?? '')));
}
function pickSensor(pk: Picker, desc: string, npn: boolean): { part: CatalogPart | null; prefix: string } {
  const out = npn ? 'NPN' : 'PNP';
  const photo = /\b(photo|eye|beam|part|present|detect|presence|carton|box|product|bottle|label)\b/i.test(desc) && !/\b(prox|inductive|extended|retracted|home|position|cylinder)\b/i.test(desc);
  const type = photo ? 'photoelectric' : 'inductive';
  return { part: pk.pick('sensor', (p) => String(p.ratings.output ?? '') === out && String(p.ratings.type ?? '').startsWith(type)), prefix: photo ? 'PE' : 'LS' };
}
function pickValve(pk: Picker, desc: string, double: boolean): CatalogPart | null {
  const three = /\b(dump|exhaust|3\/2|3-way|main air|air supply|vacuum|blow ?off)\b/i.test(desc);
  return pk.pick('solenoidValve', (p) => {
    const ports = String(p.ratings.ports ?? ''), action = String(p.ratings.action ?? '');
    if (!/24\s*V?DC/i.test(String(p.ratings.coilVoltage ?? ''))) return false;
    if (three) return /3-port/.test(ports) && /single/.test(action);
    if (double) return /5-port/.test(ports) && /double/.test(action) && num(p.ratings.positions) === 2;
    return /5-port/.test(ports) && /single/.test(action);
  });
}

const EXTEND = /\b(extend|advance|open|up|forward|clamp|in)\b/i;
const RETRACT = /\b(retract|return|close|down|back|unclamp|out)\b/i;
const strip = (s: string) => s.replace(EXTEND, '').replace(RETRACT, '').replace(/\b(solenoid|sol|valve|coil)\b/gi, '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Operator, safety and field devices and one ioWiring entry per discrete PLC point. `points` are the
 * project's discrete points with their PLC addresses, in I/O-list order.
 */
export function devicesAndWiring(pk: Picker, tags: Tags, model: MachineModel, branches: MotorBranch[], points: { point: IOPoint; address: string }[], proc?: ProcessResult): DeviceResult {
  const components: DesignComponent[] = [];
  const ioWiring: IOWiring[] = [];
  const notes: string[] = [];
  const askUser: string[] = [];
  const zones = model.zones.length ? model.zones : ['Machine'];
  const add = (c: DesignComponent) => { components.push(c); return c.tag; };
  const part = (cat: CatalogCategory, ok: (p: CatalogPart) => boolean = () => true) => pk.pick(cat, ok);

  // ---- safety relay + E-stops + safety reset
  const sr = part('safetyRelay', (p) => (num(p.ratings.channels) ?? 2) >= 2 && !/two-hand|light curtain/i.test(String(p.ratings.application ?? '')));
  const srTag = sr ? add(comp('SR1', sr.partNumber, 1, 'E-stop safety relay — dual channel, monitored manual reset, removes power from the motion outputs (24+S)')) : undefined;
  if (!sr) notes.push('No safety relay in the catalog: the E-stop circuit is drawn as a hardwired chain; select a safety relay.');
  const estopPart = part('estop');
  const secondNc = pk.byNumber('ECX1030-2');
  const legend = pk.byNumber('ECX1651');
  const estopIo = points.filter(({ point }) => point.type === 'input' && deviceTypeOf(point) === 'estop-contact');
  const nEstops = Math.max(model.safety.estops, estopIo.length, 1);
  const estopTags: string[] = [];
  for (let k = 0; k < nEstops; k++) {
    const t = tags.next('ES');
    estopTags.push(t);
    const where = k === 0 ? 'cabinet door' : `${zones[Math.min(k - 1, zones.length - 1)]} (field station)`;
    if (estopPart) add(comp(t, estopPart.partNumber, 1, `Emergency stop, ${where} — dual channel into ${srTag ?? 'the safety circuit'}`));
    if (secondNc) add(comp(`${t}C`, secondNc.partNumber, 1, `Second NC contact for dual-channel E-stop ${t}`));
    if (legend) add(comp(`${t}L`, legend.partNumber, 1, `EMERGENCY STOP legend plate for ${t}`));
  }
  if (nEstops > 1) askUser.push(`${nEstops - 1} field E-stop station(s) assumed: the push-button enclosure for each is a field item; confirm the locations.`);
  // Guard doors: a tongue interlock switch (+ its actuator) per door; its two N.C. safety contacts 11-12 / 21-22
  // are in series with the E-stops in both channels of SR1, its N.O. monitoring contact 33-34 tells the PLC "closed".
  const guardIo = points.filter(({ point }) => point.type === 'input' && GUARD_RE.test(point.description) && !/\b(safety relay|e-?stop|light curtain)\b/i.test(point.description));
  const guardZones = model.safety.guardDoors.length ? model.safety.guardDoors.map((g) => g.zone) : guardIo.length ? [zones[0]] : [];
  while (guardZones.length < guardIo.length) guardZones.push(guardZones[guardZones.length - 1]);
  const guardTags: string[] = [];
  const gsPart = guardZones.length ? pk.pick('sensor', (p) => /safety interlock switch/i.test(String(p.ratings.type ?? '')) && (num(p.ratings.nc) ?? 0) >= 2) : null;
  for (const zone of guardZones) {
    if (!gsPart) { askUser.push(`Guard door interlock (${zone}): no dual-channel safety interlock switch in the catalog — select one and wire it in series with the E-stop channels of ${srTag ?? 'the safety relay'} (S11-S12 / S21-S22).`); continue; }
    const t = add(comp(tags.next('GS'), gsPart.partNumber, 1, `Guard door interlock, ${zone} — N.C. 11-12 / 21-22 in series with the E-stop channels of ${srTag ?? 'the safety circuit'} (S11-S12 / S21-S22), N.O. 33-34 door closed`));
    guardTags.push(t);
    const act = gsPart.ratings.actuator ? pk.byNumber(String(gsPart.ratings.actuator)) : null;
    if (act) add(comp(`${t}A`, act.partNumber, 1, `Actuator (tongue) for ${t}, on the guard door`));
    else askUser.push(`${t}: select the actuator (tongue) for the ${gsPart.partNumber} interlock switch.`);
    askUser.push(`${t}: confirm the guard door (${zone}) and that opening it may stop the machine like an E-stop (stop category per the risk assessment); a door that must stay locked while the machine runs down needs a solenoid-locking switch.`);
  }
  let guardIdx = 0;
  // Light curtains: a type 4 curtain (sender + receiver, 2 cables) into its own OSSD safety relay, whose safety
  // output is in series with SR1's in the safety-switched supply (24+S); one of its outputs tells the PLC "clear".
  const lcInput = points.some(({ point }) => point.type === 'input' && LIGHT_CURTAIN_RE.test(point.description));
  const curtains = model.safety.lightCurtains.length ? model.safety.lightCurtains : lcInput ? [{ zone: zones[0] }] : [];
  let lcRelay: string | undefined;
  if (curtains.length) {
    const ossd = part('safetyRelay', (p) => /light curtain/i.test(String(p.ratings.application ?? '')));
    if (ossd) lcRelay = add(comp(tags.next('SR'), ossd.partNumber, 1, `Light-curtain safety relay — OSSD1/OSSD2 of ${curtains.length > 1 ? 'the curtains' : 'the curtain'}; its safety output in series with ${srTag ?? 'the safety circuit'} switches 24+S (a broken beam stops the motion like an E-stop)`));
    else notes.push('No light-curtain (OSSD) safety relay in the catalog: select one.');
    const lcFor = (heightMm = 300) => pk.pick('sensor', (p) => /light curtain/i.test(String(p.ratings.type ?? '')) && (num(p.ratings.protectiveHeightMm) ?? 0) >= heightMm, (p) => num(p.ratings.protectiveHeightMm) ?? 9999);
    const cable = pk.pick('other', (p) => num(p.ratings.qtyPerLightCurtain) !== undefined);
    for (const c of curtains) {
      const lc = lcFor('heightMm' in c ? c.heightMm : undefined);
      if (!lc) { notes.push(`Light curtain (${c.zone}): no safety light curtain in the catalog — select one.`); continue; }
      const t = add(comp(tags.next('LC'), lc.partNumber, 1, `Safety light curtain, ${c.zone} — type 4, ${num(lc.ratings.protectiveHeightMm)} mm protected height, ${num(lc.ratings.resolutionMm)} mm resolution, OSSD1/OSSD2 into ${lcRelay ?? 'the safety relay'}`));
      if (cable) add(comp(`${t}W`, cable.partNumber, num(cable.ratings.qtyPerLightCurtain) ?? 2, `Connection cables for ${t} (sender + receiver)`));
      askUser.push(`${t}: confirm the protected height (${num(lc.ratings.protectiveHeightMm)} mm${'heightMm' in c && c.heightMm ? '' : ' assumed'}) and the mounting distance from the hazard (ISO 13855: stopping time of the closing stroke + the curtain's ${num(lc.ratings.responseTimeMs)} ms response).`);
    }
  }
  // Two-hand control (ISO 13851 type IIIC): one station with both buttons into a two-hand safety relay; its
  // safety output is in series with the PLC output of the closing stroke, so the stroke only runs while both
  // hands stay on the buttons — the PLC's two-hand inputs are for the sequence only.
  let thRelay: string | undefined, thStation: string | undefined;
  if (model.safety.twoHand) {
    const rel = part('safetyRelay', (p) => /two-hand/i.test(String(p.ratings.application ?? '')));
    const st = pk.pick('pushbutton', (p) => /two-hand control station/i.test(p.description) && num(p.ratings.buttons) === 2);
    if (rel) thRelay = add(comp(tags.next('SR'), rel.partNumber, 1, `Two-hand safety relay (ISO 13851 type IIIC) — both buttons within 0.5 s; its safety output is in series with the closing-stroke output`));
    else notes.push('No two-hand safety relay in the catalog: select one (ISO 13851 type IIIC).');
    if (st) thStation = add(comp(tags.next('PB'), st.partNumber, 1, `Two-hand control station, ${model.safety.twoHand.zone} — both buttons (1 N.O. + 1 N.C. each) into ${thRelay ?? 'the two-hand relay'}`));
    else notes.push('No two-hand control station in the catalog: select one.');
    if (thStation) askUser.push(`${thStation}: each button's N.O. + N.C. go to ${thRelay ?? 'the two-hand relay'}; the PLC's two-hand inputs need an extra N.O. contact per button (or read the relay's monitoring output instead) — confirm with the station's contact blocks.`);
  }

  // ---- field and operator devices per discrete I/O point
  const linkedMotors = new Set<string>();
  const stack = { tag: '', buzzer: false, zone: '' };
  const valvePairs = new Map<string, string>(); // stripped description -> SOL tag (double solenoid)
  const outs = points.filter(({ point }) => point.type === 'output' && deviceTypeOf(point) === 'solenoid');
  const doubles = new Set<string>();
  for (const a of outs) for (const b of outs) {
    if (a === b) continue;
    if (EXTEND.test(a.point.description) && RETRACT.test(b.point.description) && strip(a.point.description) && strip(a.point.description) === strip(b.point.description)) { doubles.add(a.point.id); doubles.add(b.point.id); }
  }
  let estopIdx = 0;

  for (const { point: p, address } of points) {
    const desc = p.description || address;
    let type: FieldDeviceType = deviceTypeOf(p);
    let tag: string;
    let location = CABINET;
    const field = () => zoneOf(desc, zones);

    if (p.type === 'input') {
      if (LIGHT_CURTAIN_RE.test(desc) && !/\b(safety relay|e-?stop)\b/i.test(desc) && lcRelay) { tag = lcRelay; type = 'safety-relay-output'; }
      else if (TWO_HAND_RE.test(desc) && thStation) { tag = thStation; type = 'pushbutton-no'; location = model.safety.twoHand?.zone ?? field(); }
      else if (OVER_TEMP_RE.test(desc) && proc?.limit) { tag = proc.limit; type = 'other'; }
      else if (guardIo.some((g) => g.point === p) && guardTags.length) { tag = guardTags[Math.min(guardIdx++, guardTags.length - 1)]; type = 'limit-switch'; location = guardZones[Math.min(guardIdx - 1, guardZones.length - 1)]; }
      else if (type === 'safety-relay-output') { tag = srTag ?? 'SR1'; }
      else if (type === 'estop-contact') { tag = estopTags[Math.min(estopIdx++, estopTags.length - 1)]; location = tag === estopTags[0] ? DOOR : field(); }
      else if (type === 'pushbutton-no' || type === 'pushbutton-nc') {
        const pb = pickPushbutton(pk, desc, type === 'pushbutton-nc');
        tag = tags.next('PB');
        // Two-hand (palm) buttons are on the operator's station at the machine, never on the cabinet door.
        location = /\b(palm|two[- ]?hand|2[- ]?hand)\b/i.test(desc) ? field() : DOOR;
        if (pb) add(comp(tag, pb.partNumber, 1, desc.replace(/\s*\b(pb|push ?button|button)\b/gi, '').trim() || desc));
      } else if (type === 'selector') {
        const sel = part('selector');
        tag = tags.next('SS'); location = DOOR;
        if (sel) add(comp(tag, sel.partNumber, 1, desc.replace(/\s*\bselector\b/i, '').trim() || desc));
      } else if (type === 'vfd-input' || (/\b(vfd|drive)\b/i.test(desc) && /\b(fault|ready|running|at speed|alarm)\b/i.test(desc))) {
        const b = motorFor(desc, branches, linkedMotors, 'vfd');
        type = 'vfd-input';
        tag = b?.vfd ?? tags.next('VFD');
      } else if (/\boverload\b|\bol\b.*\b(trip|tripped|fault|ok)\b|\bmotor protector\b.*\b(trip|tripped|fault|ok)\b/i.test(desc)) {
        const b = motorFor(desc, branches, linkedMotors, 'contactor');
        type = 'other';
        tag = b?.overload ?? tags.next('OL');
      } else if (/\b(aux|running feedback|contactor (on|closed))\b/i.test(desc)) {
        const b = motorFor(desc, branches, linkedMotors, 'contactor');
        type = 'other';
        tag = b?.contactors[0] ?? tags.next('K');
      } else if (type === 'sensor-pnp' || type === 'sensor-npn') {
        const s = pickSensor(pk, desc, type === 'sensor-npn');
        tag = tags.next(s.prefix); location = field();
        if (s.part) add(comp(tag, s.part.partNumber, 1, desc));
      } else if (type === 'pressure-switch' || /\b(air|pneumatic|hydraulic|vacuum)?\s*pressure\s*(switch|ok|low|high)\b/i.test(desc)) {
        // A mechanical pressure switch: its dry SPDT contact (C-NO, closes on rising pressure) to the input.
        type = 'pressure-switch';
        tag = tags.next('PRS'); location = field();
        const ps = pk.pick('sensor', (q) => /pressure switch/i.test(String(q.ratings.type ?? '')) && q.ratings.kind === 'mechanical');
        if (ps) {
          add(comp(tag, ps.partNumber, 1, `${desc} — ${ps.ratings.contact ?? 'dry contact'}, N.O. closes on rising pressure`));
          askUser.push(`${tag}: set the switch point of ${ps.partNumber} (${ps.ratings.setpointPsig ? `${ps.ratings.setpointPsig} psig` : `${ps.ratings.rangeBar ?? ''} bar`} adjustable) for "${desc}".`);
        } else notes.push(`${tag} (${desc}): pressure switch to select (none in the catalog); wired as a dry contact to ${address}.`);
      } else {
        // limit / level switches and other contacts: field items without a catalog part
        const prefix = type === 'limit-switch' ? 'LS' : /\b(level|float)\b/i.test(desc) ? 'LSW' : /\b(flow)\b/i.test(desc) ? 'FS' : /\b(temp|thermostat)\b/i.test(desc) ? 'TS' : 'S';
        tag = tags.next(prefix); location = field();
        if (type === 'other') type = 'limit-switch';
        notes.push(`${tag} (${desc}): field device to select (not in the catalog); wired as a dry contact to ${address}.`);
      }
    } else {
      const heater = HEATER_RE.test(desc) ? proc?.heaters.find((h) => desc.toLowerCase().includes(h.heater.description.toLowerCase())) ?? proc?.heaters[0] : undefined;
      if (heater && (heater.ssr || heater.contactor)) {
        // The PLC switches the heater's SSR (time-proportioned), or its contactor when there is no SSR.
        tag = heater.ssr ?? heater.contactor!; type = heater.ssr ? 'relay-coil' : 'contactor-coil';
      } else if (type === 'contactor-coil' || type === 'vfd-input' || (type === 'relay-coil' && /\b(motor|pump|fan|conveyor|blower|mixer|agitator)\b/i.test(desc) && branches.length)) {
        const b = motorFor(desc, branches, linkedMotors, 'any');
        if (b) {
          linkedMotors.add(b.motor.tag);
          if (b.vfd) { type = 'vfd-input'; tag = b.vfd; }
          else { type = 'contactor-coil'; tag = REV.test(desc) && b.contactors[1] ? b.contactors[1] : b.contactors[0] ?? tags.next('K'); }
        } else {
          type = 'contactor-coil';
          const k = pk.pick('contactor', (q) => /24\s*V?DC/i.test(String(q.ratings.coilVoltage ?? '')), (q) => num(q.ratings.amps) ?? 0);
          tag = tags.next('K');
          if (k) add(comp(tag, k.partNumber, 1, desc));
          askUser.push(`${tag} (${desc}): the load it switches (heater, pump…) is not in the motor list — size its contactor and branch protection.`);
        }
      } else if (type === 'pilot-light') {
        const pl = pickPilot(pk, desc);
        tag = tags.next('PL'); location = DOOR;
        if (pl) add(comp(tag, pl.partNumber, 1, desc.replace(/\s*\b(light|lamp|pilot|indicator)\b/gi, '').trim() || desc));
      } else if (type === 'stack-light') {
        if (!stack.tag) { stack.tag = tags.next('STK'); stack.zone = DOOR; }
        if (/\b(horn|buzzer|audible)\b/i.test(desc)) stack.buzzer = true;
        tag = stack.tag; location = DOOR;
      } else if (type === 'solenoid') {
        const key = strip(desc);
        const dbl = doubles.has(p.id);
        if (dbl && valvePairs.has(key)) tag = valvePairs.get(key)!;
        else {
          tag = tags.next('SOL');
          const v = pickValve(pk, desc, dbl);
          const name = dbl ? `${desc.replace(EXTEND, '').replace(RETRACT, '').replace(/\s+/g, ' ').trim()} valve (double solenoid)` : desc.replace(/\bsolenoid\b/i, 'valve');
          if (v) add(comp(tag, v.partNumber, 1, name));
          if (dbl) valvePairs.set(key, tag);
        }
        location = field();
      } else {
        // Relay coils, handshakes to other machines, horns: interposing relay in the cabinet (dry contact out).
        type = 'relay-coil';
        const r = part('relay', (q) => /24/.test(String(q.ratings.coilVoltage ?? '')));
        tag = tags.next('CR');
        if (r) add(comp(tag, r.partNumber, 1, `Interposing relay: ${desc} — dry contact, no PLC output wired straight to another controller`));
        if (model.interfaces.includes(p.description)) askUser.push(`${tag} (${desc}): dry contact to the other machine's controller — confirm its input voltage and wiring.`);
      }
    }
    // Safety contacts in series with the output: the two-hand relay on the closing stroke; the over-temperature
    // limit on a heater contactor the PLC switches directly (with an SSR it holds the separate safety contactor).
    const heaterK = p.type === 'output' && type === 'contactor-coil' && proc?.limit && proc.heaters.some((h) => h.contactor === tag && !h.ssr);
    const safetyContact = thRelay && p.type === 'output' && type === 'solenoid' && CLOSING_RE.test(desc) ? thRelay : heaterK ? proc!.limit : undefined;
    ioWiring.push({ address, deviceTag: tag, deviceType: type, description: desc, location, ...(safetyContact ? { safetyContact } : {}) });
  }

  if (stack.tag) {
    const st = pk.pick('stackLight', (p) => (stack.buzzer ? /yes/i : /no/i).test(String(p.ratings.buzzer ?? 'no')) && /direct/i.test(String(p.ratings.mounting ?? 'direct')))
      ?? pk.pick('stackLight');
    if (st) add(comp(stack.tag, st.partNumber, 1, 'Stack light (top of the enclosure)'));
  }
  // Monitored manual reset of the safety relay: blue pushbutton on the door, numbered after the PLC's own buttons.
  const blue = sr ? pk.pick('pushbutton', (p) => String(p.ratings.color ?? '') === 'blue') : null;
  if (blue) add(comp(tags.next('PB'), blue.partNumber, 1, 'Safety reset — blue, monitored manual reset of SR1 (releasing an E-stop never restarts anything)'));
  if (!points.some(({ point }) => point.type === 'input' && deviceTypeOf(point) === 'safety-relay-output') && srTag) {
    askUser.push(`The I/O list has no "Safety OK" input: add one so the PLC sees ${srTag}'s status (an auxiliary output of the relay).`);
  }

  // ---- machine wiring: zones in model order that have devices or motors; JB per zone with ≥ 4 devices
  const fieldW = ioWiring.filter((w) => w.location && w.location !== CABINET && w.location !== DOOR);
  const motorLocations = Object.fromEntries(branches.map((b) => [b.motor.tag, b.motor.zone && zones.includes(b.motor.zone) ? b.motor.zone : zoneOf(b.motor.description, zones)]));
  const usedZones = zones.filter((z) => fieldW.some((w) => w.location === z) || Object.values(motorLocations).includes(z));
  const jbPart = pk.pick('enclosure', (p) => p.ratings.kind === 'enclosure' && !/stainless|fiberglass|polycarbonate/i.test(String(p.ratings.material ?? '')), (p) => (num(p.ratings.heightIn) ?? 99) * (num(p.ratings.widthIn) ?? 99));
  const junctionBoxes: MachineWiring['junctionBoxes'] = [];
  const routing: Record<string, string | null> = {};
  for (const z of usedZones) {
    const devs = [...new Set(fieldW.filter((w) => w.location === z).map((w) => w.deviceTag))];
    let jb: string | null = null;
    if (devs.length >= 4) { jb = `JB${junctionBoxes.length + 1}`; junctionBoxes.push({ tag: jb, location: z, partNumber: jbPart?.partNumber ?? null }); }
    for (const d of devs) routing[d] = jb;
  }
  return { components, ioWiring, machine: { zones: usedZones.length ? usedZones : zones.slice(0, 1), junctionBoxes, motorLocations, routing }, notes, askUser };
}
