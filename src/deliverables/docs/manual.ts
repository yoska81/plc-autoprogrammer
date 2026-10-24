import type { ProjectSnapshot } from '../collect';
import { SPEC_SECTIONS } from '../../spec/types';
import { buildModel, billOfMaterials } from '../../electrical/derive';
import { reviewRows } from '../../review/report';
import { getHmi, hmiMakerOf } from '../../hmi/hmiCatalog';
import { alarmRows, programInfo, type ProgramInfo } from './program';
import { operatorDevices } from './operatorStation';
import { makeTable, specLines, type DocRow, type DocTable } from './table';

export interface ManualSection { title: string; paragraphs: string[] }

/** Operator manual assembled from the spec, operator devices, HMI and alarms. */
export function operatorManual(p: ProjectSnapshot, info: ProgramInfo = programInfo(p)): ManualSection[] {
  const spec = (id: (typeof SPEC_SECTIONS)[number]['id']) => specLines(p.spec[id]);
  const out: ManualSection[] = [];
  out.push({ title: '1. About this machine', paragraphs: spec('overview').length ? spec('overview') : ['See the machine specification.'] });
  const m = p.drawingCtx ? buildModel(p.drawingCtx) : null;
  out.push({ title: '2. Safety', paragraphs: [
    'Only trained and authorized operators may run this machine. Never reach into the machine while it can move.',
    ...(m?.safety.estops.length ? [`Emergency stop: press ${m.safety.estops.join(' or ')} to stop all motion immediately. To restart, remove the cause, twist the E-stop to release it, reset the safety circuit${m.safety.reset ? ` with ${m.safety.reset}` : ''}, then press Start.`] : []),
    ...spec('safety'), ...spec('guarding'),
    'Never bypass guards, interlocks or the E-stop.',
    'Before cleaning, clearing a jam or maintenance: stop the machine, switch the main disconnect OFF and lock it out (lockout/tagout), and release stored air pressure.',
  ] });
  const devices = operatorDevices(p);
  out.push({ title: p.noHmi ? '3. Operator station (pushbuttons, selector and lamps)' : '3. Controls on the cabinet', paragraphs: [
    ...(p.noHmi ? ['This machine has no touch panel: you run it with the pushbuttons, the selector switch and the lamps below. A lit fault lamp means a fault: remove the cause, then press Reset.'] : []),
    ...(m?.disconnect ? [`${m.disconnect.tag}: main disconnect switch (ON / OFF, lockable in OFF).`] : []),
    ...(devices.length ? devices.map((d) => `${d.tag}: ${d.description}${/door/i.test(d.location) ? '' : ` (${d.location})`}`) : spec('operator')),
  ] });
  if (p.hmi) {
    const model = getHmi(p.hmi.hmiPartNumber);
    out.push({ title: '4. Operator panel screens', paragraphs: [
      `The ${model ? `${model.sizeIn}-inch ` : ''}touch panel (${p.hmi.hmiPartNumber}) has ${p.hmi.screens.length} screens. Use the buttons at the bottom of each screen to move between them. Active alarms show in the banner at the top.`,
      ...p.hmi.screens.map((s) => {
        const buttons = s.elements.filter((e) => e.kind === 'button').map((e) => `${e.label}${e.note ? ` (${e.note.toLowerCase()})` : ''}`);
        const lamps = s.elements.filter((e) => e.kind === 'indicator').map((e) => e.label);
        return `${s.name}: ${s.purpose}${buttons.length ? ` Buttons: ${buttons.join(', ')}.` : ''}${lamps.length ? ` Lamps: ${lamps.slice(0, 8).join(', ')}${lamps.length > 8 ? ', …' : '.'}` : ''}`;
      }),
    ] });
  }
  out.push({ title: '5. Starting the machine', paragraphs: [
    'Check that guards are closed, air is on, the area is clear and nobody is inside the machine.',
    'Switch the main disconnect ON. Release any pressed E-stop and reset the safety circuit.',
    ...spec('homing'),
    ...spec('modes'),
    p.hmi ? 'Press Start (cabinet pushbutton or HMI).' : 'Press the Start pushbutton.',
  ] });
  out.push({ title: '6. Normal operation', paragraphs: spec('sequence') });
  const alarms = alarmRows(p, info);
  out.push({ title: '7. Alarms and what to do', paragraphs: [
    ...alarms.map((a) => `${a.message} (${a.id}) — ${a.action}`),
    ...spec('alarms'),
  ] });
  out.push({ title: '8. Stopping and shutting down', paragraphs: [
    'Press Stop to end the cycle. In an emergency, press the E-stop.',
    'At the end of the shift: Stop, then switch the main disconnect OFF.',
    p.hmi ? 'If the machine stops unexpectedly, read the alarm on the HMI before resetting.' : 'If the machine stops unexpectedly, check the fault lamp and find the cause (see Alarms) before pressing Reset.',
  ] });
  // Number the sections that are there (no gap where the touch panel section is left out).
  return out.filter((s) => s.paragraphs.length).map((s, i) => ({ ...s, title: s.title.replace(/^\d+\. /, `${i + 1}. `) }));
}

export function bomTable(p: ProjectSnapshot): DocTable {
  const rows: DocRow[] = [];
  if (p.drawingCtx) {
    for (const g of billOfMaterials(p.drawingCtx)) {
      rows.push({ group: g.title });
      for (const l of g.lines) rows.push([l.note ? '' : String(l.item), String(l.qty), l.partNumber || '(select)', l.manufacturer, l.description, l.tags.join(', ')]);
    }
  }
  if (p.hmi && !p.drawingCtx) { // with a design, billOfMaterials already lists the HMI
    rows.push({ group: 'HMI' });
    rows.push(['', '1', p.hmi.hmiPartNumber, hmiMakerOf(p.hmi.hmiPartNumber), getHmi(p.hmi.hmiPartNumber)?.description ?? 'Operator touch panel', 'HMI1']);
  }
  return makeTable([['Item', 6, 'center'], ['Qty', 6, 'center'], ['Part number', 20], ['Manufacturer', 16], ['Description', 64], ['Tags', 20]], rows);
}

export function designReviewTable(p: ProjectSnapshot): DocTable {
  // Design review findings (src/review): consistency checks, electrical design warnings, calculations and the AI review.
  const rows = reviewRows(p).map((r) => [r.id, `${r.severity}`, `${r.title} — ${r.fix} (${r.area}, ${r.source})`, [r.status === 'open' ? '' : `${r.status === 'resolved' ? 'Resolved' : 'Accepted'}: ${r.reason}`, r.note && `Note: ${r.note}`].filter(Boolean).join(' — '), r.date]);
  return makeTable([['ID', 8], ['Severity', 12], ['Item to check — recommended fix', 78], ['Resolution', 28], ['Date', 12]], rows, 8);
}

/** Assumptions: designer notes plus the estimates this package uses. */
export function assumptionsTable(p: ProjectSnapshot): DocTable {
  const rows: string[][] = [];
  let n = 0;
  const add = (src: string, t: string) => rows.push([`AS-${String(++n).padStart(2, '0')}`, t, src]);
  for (const t of p.electrical?.notes ?? []) add('Electrical design', t);
  for (const t of p.hmi?.notes ?? []) add('HMI design', t);
  add('This document', 'Motor full-load currents are taken from the code tables (NEC 430.250 / CEC Table 44), not the motor nameplate. Confirm against the nameplate.');
  add('This document', '24 VDC loads and heat losses marked "estimate" are typical values for the device type; the catalog does not publish them.');
  add('This document', 'Ambient temperature 0–40 °C, indoor, non-condensing.');
  add('This document', 'Cable lengths are not known ("BY SITE"); the voltage-drop table gives the maximum length for the stated limit.');
  add('This document', 'Available fault current at the installation is not known; the SCCR table gives the preliminary panel rating only.');
  add('This document', 'Maintenance intervals are typical starting points; adjust to the manufacturers’ manuals and site experience.');
  return makeTable([['ID', 8], ['Assumption to confirm', 96], ['Source', 22]], rows);
}
