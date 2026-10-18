/**
 * "Function kept": after the redesign, check that the new design still does everything the old machine
 * did. Every original I/O point (by function), motor (power, reversing, drive), interlock and safety
 * function must be present; what is missing or can't be confirmed is listed (and becomes a Design
 * review finding).
 */
import type { ProjectSnapshot } from '../deliverables/collect';
import { buildModel } from '../electrical/derive';
import type { Finding } from '../review/types';
import { driveCommands, ioOnlyDevices, type Conversion } from './convert';
import type { ImportedIO } from '../lib/ai/importAI';
import type { ExistingMachine } from './types';

export type KeptStatus = 'kept' | 'missing' | 'check';

export interface KeptItem {
  kind: 'io' | 'motor' | 'axis' | 'interlock' | 'circuit' | 'safety';
  /** What the old machine had, e.g. "X1 Start (启动)". */
  original: string;
  /** Where it is in the new design, e.g. "X002 Start (启动)". */
  now: string;
  status: KeptStatus;
  note: string;
  /** Safety functions: kept by the redesign, but to be re-validated (never certified by the conversion). */
  revalidate?: boolean;
}

/** Devices a PLC output switches (a relay coil becomes program logic instead). */
const FIELD_OUTPUTS = new Set(['contactor', 'solenoidValve', 'pilotLight', 'stackLight']);

const words = (s: string) => new Set(s.toLowerCase().replace(/\(.*?\)/g, ' ').split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !['the', 'and', 'for', 'with', 'contactor', 'lamp'].includes(w)));
/** Drive / controller terminals named in a text (MI2, DO3, DI1, RB-RC). */
const codes = (s: string): string[] => s.match(/\b(?:MI|DI|DO|AI|AO|CN)\d+(?:-\d+)?\b|\b[RA][A-C]-R[A-C]\b/g) ?? [];

/** How alike two I/O descriptions are (shared words over the smaller set). */
export function similarity(a: string, b: string): number {
  const x = words(a), y = words(b);
  if (!x.size || !y.size) return a.trim().toLowerCase() === b.trim().toLowerCase() ? 1 : 0;
  let common = 0;
  for (const w of x) if (y.has(w)) common++;
  return common / Math.min(x.size, y.size);
}

/** Every original function, and where it is in the new design. */
export function functionKept(m: ExistingMachine, conv: Conversion, p: ProjectSnapshot): KeptItem[] {
  const out: KeptItem[] = [];
  // I/O points: same direction and function
  const used = new Set<string>();
  const ioKept = new Map<ImportedIO, KeptItem>();
  // relay logic kept: no PLC, the field devices stay on their circuits (checked with the circuits below)
  const originals = conv.logic === 'keep-relays' ? [] : conv.io;
  // the same function word for word first, so a lost "Shear down valve" isn't matched to "Shear up valve" before that one is
  const exact = new Map<ImportedIO, (typeof p.io)[number]>();
  for (const o of originals) {
    const n = p.io.find((x) => x.type === o.type && !used.has(x.id) && x.description.trim().toLowerCase() === o.description.trim().toLowerCase());
    if (n) { exact.set(o, n); used.add(n.id); }
  }
  for (const o of originals) {
    let best: { id: string; description: string; score: number } | null = exact.has(o) ? { id: exact.get(o)!.id, description: exact.get(o)!.description, score: 1 } : null;
    if (!best) for (const n of p.io) {
      if (n.type !== o.type || used.has(n.id)) continue;
      // terminals named in the function (U1 MI2, U2 DO3) must match exactly: "jog" alone doesn't make MI3 the reverse input
      if (codes(o.description).some((x) => !codes(n.description).includes(x))) continue;
      const score = similarity(o.description, n.description);
      if (score >= 0.5 && (!best || score > best.score)) best = { id: n.id, description: n.description, score };
    }
    if (best) used.add(best.id);
    const addr = best ? p.addresses.get(best.id) ?? '' : '';
    const item: KeptItem = {
      kind: 'io', original: `${o.address} ${o.description}`, now: best ? `${addr || '(no address)'} ${best.description}` : '—',
      status: !best ? 'missing' : addr ? 'kept' : 'check',
      note: !best ? `No ${o.type} for this function in the new I/O list.` : addr ? '' : 'In the I/O list but without an address on the new PLC (not enough I/O?).',
    };
    ioKept.set(o, item);
    out.push(item);
  }
  // motors: same tag, at least the converted power, reversing and drive kept
  const model = p.drawingCtx ? buildModel(p.drawingCtx) : null;
  const panelMotors = m.motors.filter((x) => x.kind !== 'servo');
  for (const [i, om] of panelMotors.entries()) {
    const want = conv.motors[i];
    const nm = p.electrical?.inputs.motors.find((x) => x.tag === want?.tag);
    const circuit = model?.motors.find((x) => x.motor.tag === want?.tag);
    const problems: string[] = [];
    if (nm && want && nm.hp < want.hp) problems.push(`${nm.hp} HP is less than the ${want.hp} HP the ${om.kw ?? '?'} kW motor needs`);
    // a drive reverses itself; a contactor starter needs a reversing pair
    if (nm && om.reversing && !nm.reversing && nm.starter !== 'vfd') problems.push('no longer reversing');
    if (nm && om.starter === 'vfd' && nm.starter !== 'vfd') problems.push('was on a drive, now across the line');
    if (nm && circuit && om.reversing && nm.starter !== 'vfd' && circuit.contactors.length < 2) problems.push('reversing starter has one contactor');
    out.push({
      kind: 'motor', original: `${om.tag} ${om.description}${om.kw ? `, ${om.kw} kW` : ''}${om.reversing ? ', reversing' : ''}`,
      now: nm ? `${nm.tag} ${nm.hp} HP ${nm.starter === 'vfd' ? 'VFD' : nm.reversing ? 'reversing starter' : 'starter'}${circuit ? ` (${[...circuit.contactors.map((c) => c.tag), circuit.overload?.tag, circuit.vfd?.tag].filter(Boolean).join(', ')})` : ''}` : '—',
      status: !nm ? 'missing' : problems.length ? 'missing' : circuit || !p.drawingCtx ? 'kept' : 'check',
      note: !nm ? 'Motor is not in the new design.' : problems.join('; ') || (circuit ? '' : 'Not drawn yet: build the electrical design.'),
    });
  }
  // servo axes: the new design has the axis (its I/O and the motion description)
  const specText = Object.values(p.spec).join('\n');
  for (const a of m.axes) {
    const axisIo = p.io.filter((x) => x.category === 'Servo/Axis');
    const described = new RegExp(`servo|${a.description.split(/[\s(,]/)[0]}`, 'i').test(specText);
    out.push({
      kind: 'axis', original: `${a.tag} ${a.description}: drive ${a.driveTag}, ${a.motorKw ?? '?'} kW servo${a.encoder ? `, ${a.encoder}` : ''}${a.brakingResistor ? `, braking resistor` : ''}`,
      now: axisIo.length ? `Servo axis with ${axisIo.length} I/O (${axisIo.slice(0, 3).map((x) => x.description).join(', ')}${axisIo.length > 3 ? '…' : ''})` : described ? 'In the description (motion)' : '—',
      status: axisIo.length ? 'kept' : described ? 'check' : 'missing',
      note: axisIo.length ? '' : described ? 'Described, but the new design has no servo axis I/O yet: check the motion design.' : 'The servo axis is not in the new design.',
    });
  }
  // interlocks: their devices exist in the new design and the interlock is in the description (for the program)
  const spec = Object.values(p.spec).join('\n').toLowerCase();
  const newTags = new Set([...(p.electrical?.components ?? []).map((c) => c.tag), ...(p.electrical?.ioWiring ?? []).map((w) => w.deviceTag), ...(p.electrical?.inputs.motors ?? []).map((x) => x.tag)]);
  for (const il of m.interlocks) {
    const mapped = il.devices.map((d) => conv.tags.get(d) ?? d);
    const ioFor = (d: string) => m.io.find((x) => x.deviceTag === d);
    // a device is there when the design names it, or a kept I/O point is (or drives) it, e.g. "Cutter down via relay KA1 to valve YV1"
    const named = (d: string) => new RegExp(`\\b${d}\\b`);
    const present = il.devices.map((d, k) => newTags.has(mapped[k]) || out.some((x) => x.kind === 'io' && x.status === 'kept' && ((ioFor(d) && x.original.startsWith(`${ioFor(d)!.address} `)) || named(d).test(x.original))));
    const reversing = il.devices.length === 2 && il.devices.every((d) => m.components.find((c) => c.tag === d)?.category === 'contactor')
      && (p.electrical?.inputs.motors ?? []).some((x) => x.reversing);
    const inSpec = spec.includes(il.description.toLowerCase().slice(0, 40));
    const missing = il.devices.filter((_, k) => !present[k]);
    out.push({
      kind: 'interlock', original: il.description, now: missing.length ? '—' : reversing ? 'Reversing starter: mechanical and electrical interlock in the design' : inSpec ? `In the description for the program (${mapped.join(', ')})` : mapped.join(', '),
      status: missing.length ? 'missing' : reversing || inSpec ? 'kept' : 'check',
      note: missing.length ? `${missing.join(', ')} not in the new design.` : reversing || inSpec ? '' : 'The devices are there; add the interlock to the description so the program keeps it.',
    });
  }
  // control circuits: each function is in the new design where the conversion put it (PLC program, relays, the drive)
  const devices = [...m.components, ...ioOnlyDevices(m)];
  const isDriveTag = (t: string) => m.components.some((c) => c.tag === t && c.category === 'vfd') || m.axes.some((a) => a.driveTag === t);
  for (const c of conv.circuits) {
    const inSpec = spec.includes(c.text.toLowerCase().slice(0, 40));
    const parts = c.circuit.devices.map((d) => conv.parts.find((x) => x.oldTag === d)).filter((x) => x !== undefined);
    let now: string, status: KeptStatus = 'kept';
    const notes: string[] = [];
    if (c.becomes === 'program') {
      // its field devices are I/O of the new PLC; its relays and timers are program logic
      // a drive's points count only when the circuit uses that terminal (losing U1 MI2 doesn't touch the other U1 circuits)
      const named = `${c.circuit.conditions.join(' ')} ${(c.circuit.path ?? []).flatMap((e) => (e.t === 'branch' ? e.paths.flat() : [e])).map((e) => e.terms ?? '').join(' ')}`;
      const uses = (x: ImportedIO) => !isDriveTag(x.deviceTag!) || codes(x.address).some((t) => named.includes(t));
      const lost = conv.io.filter((x) => x.deviceTag && c.circuit.devices.includes(x.deviceTag) && uses(x) && ioKept.get(x)?.status === 'missing').map((x) => `${x.deviceTag}${isDriveTag(x.deviceTag!) ? ` ${x.address.split(/\s/).slice(1).join(' ')}` : ''}`);
      if (lost.length) { status = 'missing'; notes.push(`${[...new Set(lost)].join(', ')}: no I/O in the new design.`); }
      // what it switched must have a PLC output: its coil (contactor, valve, lamp) and the drive inputs its relay contacts drove
      const coil = c.circuit.output.split(/\s/)[0];
      const coilDev = devices.find((d) => d.tag === coil);
      const coilCat = coilDev && !/main|总|主接触/i.test(coilDev.description) ? coilDev.category : undefined; // a main contactor goes to the safety circuit
      if (coilCat && FIELD_OUTPUTS.has(coilCat) && !conv.io.some((x) => x.type === 'output' && x.deviceTag === coil)) { status = 'missing'; notes.push(`No PLC output drives ${conv.tags.get(coil) ?? coil}.`); }
      now = `PLC program${inSpec ? ' (in the description for the program)' : ''}`;
    } else if (c.becomes === 'relays') {
      const toSelect = parts.filter((x) => x.status === 'to-select').map((x) => x.newTag);
      if (toSelect.length) { status = 'check'; notes.push(`Pick a part for ${toSelect.join(', ')}.`); }
      now = `Relay circuit ${parts.map((x) => x.newTag).join(', ')}`;
    } else {
      const drive = parts.find((x) => x.from.category === 'vfd' || m.axes.some((a) => a.driveTag === x.oldTag) || (x.from.category === 'other' && /drive|驱动/i.test(x.from.description)));
      if (!drive) { status = 'missing'; notes.push('The drive is not in the new design.'); }
      now = drive ? `In ${drive.newTag}'s own logic` : '—';
      if (drive) notes.push('Set the new drive\'s parameters as the old one (terminal functions, speeds, positions).');
    }
    // with the relays in a PLC, the drive inputs they switched are PLC outputs (forward / reverse / jog, servo ON, CAM)
    if (conv.logic === 'plc') {
      for (const d of driveCommands({ ...m, circuits: [c.circuit] })) {
        const point = conv.io.find((x) => x.type === 'output' && x.address === d.address);
        if (!point || ioKept.get(point)?.status === 'missing') { status = 'missing'; notes.push(`No PLC output for ${d.description}.`); }
      }
    }
    if (c.hardwired.length) {
      notes.push(`${c.hardwired.join(', ')} stays hardwired in the coil circuit (safety: re-validate).`);
      if (status === 'kept' && !spec.includes('not through the plc')) { status = 'check'; notes.push('Write the hardwired safety contact into the description.'); }
    }
    if (status === 'kept' && !inSpec) { status = 'check'; notes.push('Write the circuit into the description so the new design keeps it.'); }
    out.push({ kind: 'circuit', ...(c.hardwired.length ? { revalidate: true } : {}), original: `${c.circuit.output}: ${c.circuit.function}${c.circuit.setting && !c.circuit.function.includes(c.circuit.setting) ? ` (${c.circuit.setting})` : ''}`, now, status, note: notes.join(' ') });
  }
  // safety: every E-stop and guard still stops the machine, through a monitored safety relay
  const safety = model?.safety;
  for (const e of m.safety.estops) {
    const newTag = conv.tags.get(e) ?? e;
    const io = p.io.find((x) => x.deviceType === 'estop-contact' || x.deviceType === 'safety-relay-output');
    const inChain = safety ? safety.estops.length > 0 : Boolean(io);
    out.push({
      kind: 'safety', revalidate: true, original: `E-stop ${e}${m.safety.safetyRelay ? ` on ${m.safety.safetyRelay}` : m.safety.kind === 'control-only' ? ' (only a drive input: not a safety circuit)' : ' (single channel)'}`,
      now: inChain ? `${safety?.estops.join(', ') || newTag}${safety?.relay ? ` on safety relay ${safety.relay.tag}` : ''}` : '—',
      status: !inChain ? 'missing' : safety?.relay || !p.drawingCtx ? 'kept' : 'check',
      note: [m.safety.kind === 'control-only' ? 'Was not a safety circuit (the E-stop only signalled a drive or controller).' : '', !inChain ? 'No E-stop in the new design.' : safety?.relay ? '' : p.drawingCtx ? 'E-stop without a monitored safety relay.' : 'Build the electrical design to confirm the safety circuit.'].filter(Boolean).join(' '),
    });
  }
  for (const g of m.safety.guards) {
    const inChain = Boolean(safety?.guards.length) || p.io.some((x) => x.category === 'Safety' && /guard|door|gate|curtain/i.test(x.description));
    out.push({ kind: 'safety', revalidate: true, original: `Guard ${g}`, now: inChain ? (safety?.guards.join(', ') || 'Safety input') : '—', status: inChain ? 'kept' : 'missing', note: inChain ? '' : 'The guard does not stop the machine in the new design.' });
  }
  return out;
}

/** Design review findings for what the new design no longer does. */
export function functionKeptFindings(items: KeptItem[]): Finding[] {
  return items.filter((i) => i.status === 'missing').map((i) => ({
    id: `convert:kept:${i.kind}:${i.original.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}`,
    source: 'check' as const,
    severity: i.kind === 'safety' ? 'critical' as const : 'major' as const,
    area: i.kind === 'safety' ? 'safety' as const : i.kind === 'io' ? 'io' as const : i.kind === 'axis' ? 'equipment' as const : i.kind === 'circuit' ? 'program' as const : 'electrical' as const,
    title: `Converted machine: ${i.kind === 'io' ? 'I/O' : i.kind} "${i.original.slice(0, 60)}" is not in the new design`,
    detail: `${i.note} The existing machine has it (read from its drawings); the redesign must keep every function.`,
    fix: i.kind === 'io' ? 'Add the point back to the I/O list.' : i.kind === 'motor' ? 'Correct the motor in the electrical design inputs.' : i.kind === 'interlock' ? 'Add the devices and write the interlock into the description.' : i.kind === 'circuit' ? 'Add the circuit\'s devices back and keep the circuit in the description.' : 'Wire the device into the safety relay channel.',
    page: i.kind === 'io' ? 'io' as const : i.kind === 'interlock' || i.kind === 'circuit' ? 'spec' as const : 'electrical' as const,
    item: '',
  }));
}
