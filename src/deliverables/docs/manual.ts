import type { ProjectSnapshot } from '../collect';
import { SPEC_SECTIONS } from '../../spec/types';
import { buildModel, billOfMaterials, designWarnings } from '../../electrical/derive';
import { getHmi } from '../../hmi/hmiCatalog';
import { alarmRows, programInfo, type ProgramInfo } from './program';
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
  const doorDevices = (p.electrical?.ioWiring ?? []).filter((w) => /door/i.test(w.location ?? '') || ['pushbutton-no', 'pushbutton-nc', 'selector', 'estop-contact', 'pilot-light'].includes(w.deviceType));
  out.push({ title: '3. Controls on the cabinet', paragraphs: [
    ...(m?.disconnect ? [`${m.disconnect.tag}: main disconnect switch (ON / OFF, lockable in OFF).`] : []),
    ...(doorDevices.length ? doorDevices.map((w) => `${w.deviceTag}: ${w.description}`) : spec('operator')),
    ...(m?.safety.estops.filter((t) => !doorDevices.some((w) => w.deviceTag === t)).map((t) => `${t}: emergency stop (push to stop, twist to release).`) ?? []),
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
    'Press Start (cabinet pushbutton or HMI).',
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
    'If the machine stops unexpectedly, read the alarm on the HMI before resetting.',
  ] });
  return out.filter((s) => s.paragraphs.length);
}

export function bomTable(p: ProjectSnapshot): DocTable {
  const rows: DocRow[] = [];
  if (p.drawingCtx) {
    for (const g of billOfMaterials(p.drawingCtx)) {
      rows.push({ group: g.title });
      for (const l of g.lines) rows.push([l.note ? '' : String(l.item), String(l.qty), l.partNumber || '(select)', l.manufacturer, l.description, l.tags.join(', ')]);
    }
  }
  if (p.hmi) {
    rows.push({ group: 'HMI' });
    rows.push(['', '1', p.hmi.hmiPartNumber, 'AutomationDirect', getHmi(p.hmi.hmiPartNumber)?.description ?? 'Operator touch panel', 'HMI1']);
  }
  return makeTable([['Item', 6, 'center'], ['Qty', 6, 'center'], ['Part number', 20], ['Manufacturer', 16], ['Description', 64], ['Tags', 20]], rows);
}

export function designReviewTable(p: ProjectSnapshot): DocTable {
  const rows = p.drawingCtx ? designWarnings(p.drawingCtx).map((w, i) => [`DR-${String(i + 1).padStart(2, '0')}`, w, '', '']) : [];
  return makeTable([['ID', 8], ['Item to check', 90], ['Resolution', 26], ['By / date', 14]], rows, 8);
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
