import { powerText } from '../../standards/regions';
import { operatorInterfaceText } from './operatorStation';
import type { ProjectSnapshot } from '../collect';
import { buildModel, naturalCompare, resolveComponents, supplyText } from '../../electrical/derive';
import { getHmi, hmiMakerOf } from '../../hmi/hmiCatalog';
import { hmiText } from './meta';
import { makeTable, specLines, type DocRow, type DocTable } from './table';

/** Functional design specification content: system description, equipment, sequence, I/O, HMI. */

const DEVICE_TEXT: Record<string, string> = {
  'pushbutton-no': 'Pushbutton (NO)', 'pushbutton-nc': 'Pushbutton (NC)', selector: 'Selector switch', 'estop-contact': 'E-stop contact',
  'sensor-pnp': 'Sensor, PNP 24 VDC', 'sensor-npn': 'Sensor, NPN 24 VDC', 'limit-switch': 'Limit switch', 'pressure-switch': 'Pressure switch',
  'safety-relay-output': 'Safety relay status contact', 'contactor-coil': 'Contactor coil 24 VDC', 'relay-coil': 'Relay coil 24 VDC',
  solenoid: 'Solenoid valve coil 24 VDC', 'pilot-light': 'Pilot light 24 VDC', 'stack-light': 'Stack light 24 VDC', 'vfd-input': 'VFD digital input', other: 'Other',
};

const MOUNT_TEXT: Record<string, string> = { backplate: 'Panel (back plate)', door: 'Panel door', field: 'Machine (field)' };

export function systemDescription(p: ProjectSnapshot): string[] {
  const out = [...specLines(p.spec.overview)];
  const nIn = p.io.filter((x) => x.type === 'input').length, nOut = p.io.filter((x) => x.type === 'output').length;
  const d = p.electrical;
  const parts: string[] = [];
  parts.push(`The machine is controlled by a ${p.profile.vendor} ${p.profile.name} PLC, CPU ${p.cpu.label.startsWith(p.cpu.id) ? p.cpu.label : `${p.cpu.id} (${p.cpu.label})`}${p.equipment?.modules.length ? ` with expansion modules ${p.equipment.modules.join(', ')}` : ''}, handling ${nIn} discrete inputs and ${nOut} discrete outputs.`);
  if (p.hmi) parts.push(`The operator uses a ${hmiText(p.hmi.hmiPartNumber)} touch panel on the control panel door, connected to the PLC over Ethernet, with ${p.hmi.screens.length} screens.`);
  else if (p.noHmi) parts.push(operatorInterfaceText(p));
  if (d) {
    parts.push(`The control panel is fed from ${supplyText(d.inputs.supply)} through a lockable main disconnect, in a ${d.inputs.enclosureRating} enclosure, with 24 VDC control power.`);
    if (d.inputs.motors.length) parts.push(`Motors: ${d.inputs.motors.map((m) => `${m.tag} ${m.description || ''} (${powerText(m.hp, p.info.region)}, ${m.voltage}, ${m.starter === 'vfd' ? 'VFD' : m.starter === 'motor-protector' ? 'motor protector + contactor' : 'contactor and overload'}${m.reversing ? ', reversing' : ''})`).join('; ')}.`);
    const m = p.drawingCtx ? buildModel(p.drawingCtx) : null;
    if (m?.safety.relay) parts.push(`Emergency stop is hardwired through safety relay ${m.safety.relay.tag}${m.safety.outputSupply === '24+S' ? ', which removes the 24 VDC supply (24+S) from the PLC outputs' : ''}. The PLC only monitors the safety status; it does not perform safety functions.`);
  }
  if (p.equipment?.why) parts.push(`Controller selection: ${p.equipment.why}`);
  return [...out, ...parts];
}

export function equipmentTable(p: ProjectSnapshot): DocTable {
  const rows: DocRow[] = [];
  if (p.drawingCtx) {
    const rc = resolveComponents(p.drawingCtx).sort((a, b) => naturalCompare(a.tag, b.tag));
    for (const mount of ['backplate', 'door', 'field'] as const) {
      const list = rc.filter((c) => c.mount === mount);
      if (!list.length) continue;
      rows.push({ group: MOUNT_TEXT[mount] });
      for (const c of list) rows.push([c.tag, c.partNumber || '—', c.part?.manufacturer ?? '', c.part?.description ?? 'Part not found in catalog — verify', `${c.comp.function}${c.comp.quantity > 1 ? ` (qty ${c.comp.quantity})` : ''}`]);
      if (mount === 'door' && p.hmi && !rc.some((c) => c.partNumber === p.hmi!.hmiPartNumber)) {
        rows.push(['HMI1', p.hmi.hmiPartNumber, hmiMakerOf(p.hmi.hmiPartNumber), getHmi(p.hmi.hmiPartNumber)?.description ?? '', 'Operator touch panel']);
      }
    }
    const motors = p.electrical?.inputs.motors ?? [];
    if (motors.length) {
      rows.push({ group: 'Motors (field, supplied with the machine)' });
      for (const m of motors) rows.push([m.tag, '—', '', `${powerText(m.hp, p.info.region)}, ${m.voltage} motor (nameplate data to be confirmed)`, m.description]);
    }
  } else {
    rows.push(['PLC', p.cpu.id, p.profile.vendor, p.cpu.label, 'Controller']);
    if (p.hmi) rows.push(['HMI1', p.hmi.hmiPartNumber, hmiMakerOf(p.hmi.hmiPartNumber), getHmi(p.hmi.hmiPartNumber)?.description ?? '', 'Operator touch panel']);
  }
  return makeTable([['Tag', 9], ['Part number', 20], ['Manufacturer', 16], ['Description', 58], ['Function', 36]], rows);
}

export function operatingModes(p: ProjectSnapshot): { modes: string[]; startup: string[] } {
  const modes = specLines(p.spec.modes);
  return {
    modes: modes.length ? modes : ['Automatic mode only (no other modes specified).'],
    startup: specLines(p.spec.homing),
  };
}

export function sequenceTable(p: ProjectSnapshot): DocTable {
  const steps = specLines(p.spec.sequence);
  return makeTable([['Step', 7, 'center'], ['Description', 110]], steps.map((s, i) => [String(i + 1), s]));
}

export function ioListTable(p: ProjectSnapshot): DocTable {
  const rows: DocRow[] = [];
  const m = p.drawingCtx ? buildModel(p.drawingCtx) : null;
  const byAddr = new Map((m?.io ?? []).map((x) => [x.address.toUpperCase(), x] as const));
  const pts = p.io.map((x) => ({ x, a: p.addresses.get(x.id) ?? '' })).sort((a, b) => (a.x.type === b.x.type ? naturalCompare(a.a, b.a) : a.x.type === 'input' ? -1 : 1));
  let last = '';
  for (const { x, a } of pts) {
    const t = x.type === 'input' ? 'Discrete inputs (24 VDC)' : 'Discrete outputs (24 VDC)';
    if (t !== last) { rows.push({ group: t }); last = t; }
    const io = byAddr.get(a.toUpperCase());
    const where = io ? (io.location === 'door' ? 'Panel door' : io.location === 'internal' ? 'Panel' : io.zone || 'Field') : '';
    rows.push([a || 'unassigned', io?.deviceTag ?? '', x.description, x.type === 'input' ? 'DI' : 'DO', DEVICE_TEXT[io?.deviceType ?? x.deviceType ?? ''] ?? (x.deviceType ?? ''), where, io?.signalTerminal ?? (io?.location === 'internal' || io?.location === 'door' ? 'direct' : ''), x.category]);
  }
  return makeTable([['Address', 9], ['Tag', 8], ['Description', 40], ['Type', 6, 'center'], ['Device', 24], ['Location', 16], ['Terminal', 10], ['Category', 16]], rows);
}

export function hmiScreenTable(p: ProjectSnapshot): DocTable {
  return makeTable([['#', 5, 'center'], ['Screen', 18], ['Purpose', 50], ['Buttons', 8, 'center'], ['Indicators', 9, 'center'], ['Values', 8, 'center'], ['Navigation', 30]],
    (p.hmi?.screens ?? []).map((s, i) => {
      const k = (kind: string) => s.elements.filter((e) => e.kind === kind).length;
      const nav = s.elements.filter((e) => e.kind === 'nav').map((e) => p.hmi!.screens.find((x) => x.id === e.targetScreenId)?.name ?? e.label);
      return [String(i + 1), s.name, s.purpose, String(k('button')), String(k('indicator')), String(k('numeric') + k('numeric-entry') + k('bar')), nav.join(', ') || '—'];
    }));
}

const KIND_TEXT: Record<string, string> = { button: 'Button', nav: 'Navigation', indicator: 'Indicator', numeric: 'Numeric display', 'numeric-entry': 'Numeric entry', text: 'Text', 'alarm-banner': 'Alarm banner', bar: 'Bar graph' };

/** Elements of every HMI screen (skips static text and repeated nav). */
export function hmiElementTable(p: ProjectSnapshot): DocTable {
  const rows: DocRow[] = [];
  for (const s of p.hmi?.screens ?? []) {
    rows.push({ group: `${s.name} — ${s.purpose}` });
    for (const e of s.elements) {
      if (e.kind === 'text' || e.kind === 'nav') continue;
      const func = e.kind === 'button' ? `${e.action ?? 'momentary'}${e.note ? `; ${e.note}` : ''}` : e.kind === 'indicator' ? [e.onText && `ON: ${e.onText}`, e.offText && `OFF: ${e.offText}`, e.style !== 'normal' ? `style ${e.style}` : ''].filter(Boolean).join(', ') : [e.units, e.min !== null && e.max !== null ? `${e.min}–${e.max}` : '', e.note].filter(Boolean).join(', ');
      rows.push([e.label, KIND_TEXT[e.kind] ?? `${e.kind.charAt(0).toUpperCase()}${e.kind.slice(1).replace(/-/g, ' ')}`, e.address ?? '—', func || '—']);
    }
    const nav = s.elements.filter((e) => e.kind === 'nav').map((e) => e.label);
    if (nav.length) rows.push([`Navigation: ${nav.join(' / ')}`, 'Navigation', '—', 'Screen change']);
  }
  return makeTable([['Element', 40], ['Kind', 18], ['PLC address', 12], ['Function / notes', 50]], rows);
}

export function hmiTagTable(p: ProjectSnapshot): DocTable {
  return makeTable([['Tag name', 22], ['Address', 10], ['Data type', 10], ['Access', 12], ['Description', 60]],
    (p.hmi?.tags ?? []).map((t) => [t.name, t.address, t.dataType, t.access, t.description]));
}
