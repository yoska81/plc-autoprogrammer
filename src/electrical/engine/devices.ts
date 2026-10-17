/**
 * Safety circuit, operator devices, field devices and the I/O wiring of the rule-based design, plus
 * the machine (field) wiring: zones, a junction box per zone with 4 or more field devices, routing.
 */
import type { IOPoint } from '../../types/io';
import type { CatalogCategory, CatalogPart, DesignComponent, FieldDeviceType, IOWiring, MachineWiring } from '../types';
import { deviceTypeOf, type MachineModel } from './machineModel';
import { comp, type MotorBranch, type Tags } from './power';
import { num, type Picker } from './select';

export const CABINET = 'Cabinet';
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

/** The motor an I/O point belongs to: most shared words with its description, else the next one not yet linked. */
export function motorFor(desc: string, branches: MotorBranch[], linked: Set<string>, kind: 'vfd' | 'contactor' | 'any'): MotorBranch | undefined {
  const pool = branches.filter((b) => kind === 'any' || (kind === 'vfd' ? !!b.vfd : !b.vfd));
  const m = /\b(m|vfd|k)\s*-?(\d+)\b/i.exec(desc);
  if (m) {
    const byTag = pool.find((b) => b.motor.tag.toUpperCase() === `M${m[2]}` || b.vfd?.toUpperCase() === `VFD${m[2]}` || b.contactors.some((k) => k.toUpperCase() === `K${m[2]}`));
    if (byTag) return byTag;
  }
  let best: MotorBranch | undefined, score = 0;
  for (const b of pool) { const s = shared(desc, b.motor.description); if (s > score) { best = b; score = s; } }
  return best ?? pool.find((b) => !linked.has(b.motor.tag)) ?? pool[0];
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
  const color = nc || /\bstop\b/i.test(desc) ? 'red' : /\bstart|run|on\b/i.test(desc) ? 'green' : /\bjog|manual\b/i.test(desc) ? 'black' : /\b(ack|silence)\b/i.test(desc) ? 'yellow' : 'black';
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
export function devicesAndWiring(pk: Picker, tags: Tags, model: MachineModel, branches: MotorBranch[], points: { point: IOPoint; address: string }[]): DeviceResult {
  const components: DesignComponent[] = [];
  const ioWiring: IOWiring[] = [];
  const notes: string[] = [];
  const askUser: string[] = [];
  const zones = model.zones.length ? model.zones : ['Machine'];
  const add = (c: DesignComponent) => { components.push(c); return c.tag; };
  const part = (cat: CatalogCategory, ok: (p: CatalogPart) => boolean = () => true) => pk.pick(cat, ok);

  // ---- safety relay + E-stops + safety reset
  const sr = part('safetyRelay', (p) => (num(p.ratings.channels) ?? 2) >= 2);
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
  for (const g of model.safety.guardDoors) notes.push(`Guard door interlock (${g.zone}): dual-channel safety switch into ${srTag ?? 'the safety circuit'} in series with the E-stops — the switch is a field item to select.`);
  for (const l of model.safety.lightCurtains) notes.push(`Light curtain (${l.zone}): both OSSD outputs into ${srTag ?? 'the safety circuit'} (24 V type 4 curtain) — the light curtain is a field item to select.`);

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
      if (type === 'safety-relay-output') { tag = srTag ?? 'SR1'; }
      else if (type === 'estop-contact') { tag = estopTags[Math.min(estopIdx++, estopTags.length - 1)]; location = tag === estopTags[0] ? DOOR : field(); }
      else if (type === 'pushbutton-no' || type === 'pushbutton-nc') {
        const pb = pickPushbutton(pk, desc, type === 'pushbutton-nc');
        tag = tags.next('PB'); location = DOOR;
        if (pb) add(comp(tag, pb.partNumber, 1, desc.replace(/\s*\b(pb|push ?button|button)\b/gi, '').trim() || desc));
      } else if (type === 'selector') {
        const sel = part('selector');
        tag = tags.next('SS'); location = DOOR;
        if (sel) add(comp(tag, sel.partNumber, 1, desc.replace(/\s*\bselector\b/i, '').trim() || desc));
      } else if (type === 'vfd-input' || (/\b(vfd|drive)\b/i.test(desc) && /\b(fault|ready|running|at speed|alarm)\b/i.test(desc))) {
        const b = motorFor(desc, branches, linkedMotors, 'vfd');
        type = 'vfd-input';
        tag = b?.vfd ?? tags.next('VFD');
      } else if (/\b(overload|ol)\b.*\b(trip|tripped|fault|ok)\b|\b(trip|tripped)\b.*\boverload\b/i.test(desc)) {
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
      } else {
        // limit / pressure / level switches and other contacts: field items without a catalog part
        const prefix = type === 'pressure-switch' ? 'PRS' : type === 'limit-switch' ? 'LS' : /\b(level|float)\b/i.test(desc) ? 'LSW' : /\b(flow)\b/i.test(desc) ? 'FS' : /\b(temp|thermostat)\b/i.test(desc) ? 'TS' : 'S';
        tag = tags.next(prefix); location = field();
        if (type === 'other') type = 'limit-switch';
        notes.push(`${tag} (${desc}): field device to select (not in the catalog); wired as a dry contact to ${address}.`);
      }
    } else {
      if (type === 'contactor-coil' || type === 'vfd-input' || (type === 'relay-coil' && /\b(motor|pump|fan|conveyor|blower|mixer|agitator)\b/i.test(desc) && branches.length)) {
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
    ioWiring.push({ address, deviceTag: tag, deviceType: type, description: desc, location });
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
  const jbPart = pk.pick('enclosure', (p) => p.ratings.kind === 'enclosure', (p) => (num(p.ratings.heightIn) ?? 99) * (num(p.ratings.widthIn) ?? 99));
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
