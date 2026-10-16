import type { ProjectSnapshot } from './collect';
import { getPart } from '../electrical/catalog';
import { getHmi } from '../hmi/hmiCatalog';
import { awgFor, motorFla } from '../electrical/derive';
import { SPEC_SECTIONS } from '../spec/types';
import { describeOutput } from '../plc/clickExport';
import type { CatalogCategory } from '../electrical/types';

/**
 * The engineering package a controls engineer hands over: calculations,
 * factory acceptance test checklist and operator manual. Everything is
 * computed from project data; values not published for a part are typical
 * figures and are labelled "estimate".
 */

export interface CalcLine { item: string; value: string; basis: string; estimate: boolean }
export interface CalcSection { title: string; lines: CalcLine[]; result: string; ok: boolean }

// Typical values used when the catalog doesn't publish one (labelled as estimates).
const DC_LOAD_A: Partial<Record<CatalogCategory, number>> = {
  plc: 0.3, plcModule: 0.05, safetyRelay: 0.1, relay: 0.03, pilotLight: 0.02, stackLight: 0.1, sensor: 0.03, contactor: 0.1,
};
const HEAT_W: Partial<Record<CatalogCategory, number>> = {
  plc: 5, plcModule: 2, safetyRelay: 2, relay: 0.6, contactor: 2.5, overload: 2, motorProtector: 3, breaker: 1.5, terminal: 0.1,
};

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : null;
}

export function calculations(p: ProjectSnapshot): CalcSection[] {
  const d = p.electrical;
  if (!d) return [];
  const sections: CalcSection[] = [];
  const parts = d.components.map((c) => ({ c, part: getPart(c.partNumber) }));

  // 1. 24 VDC power supply load
  const lines: CalcLine[] = [];
  let loadA = 0;
  for (const { c, part } of parts) {
    if (!part) continue;
    let a: number | null = null;
    let basis = '';
    if (part.category === 'solenoidValve' && num(part.ratings.watts)) {
      a = (num(part.ratings.watts)! / 24) * c.quantity;
      basis = `${part.ratings.watts} W coil (catalog)`;
    } else if (part.category === 'contactor' && !String(part.ratings.coilVoltage ?? part.ratings.coil ?? '').includes('24')) {
      continue; // AC coil, not on the 24 VDC supply
    } else if (DC_LOAD_A[part.category] !== undefined) {
      a = DC_LOAD_A[part.category]! * c.quantity;
      basis = `${DC_LOAD_A[part.category]} A each (typical)`;
    }
    if (a === null) continue;
    loadA += a;
    lines.push({ item: `${c.tag} ${part.partNumber}${c.quantity > 1 ? ` ×${c.quantity}` : ''}`, value: `${a.toFixed(2)} A`, basis, estimate: !basis.includes('catalog') });
  }
  const hmi = p.hmi ? getHmi(p.hmi.hmiPartNumber) : undefined;
  if (hmi) {
    const a = hmi.sizeIn >= 10 ? 1.0 : 0.6;
    loadA += a;
    lines.push({ item: `HMI ${hmi.partNumber}`, value: `${a.toFixed(2)} A`, basis: 'typical for this screen size', estimate: true });
  }
  const supplies = parts.filter(({ part }) => part?.category === 'powerSupply');
  const capA = supplies.reduce((s, { c, part }) => s + (num(part!.ratings.outputAmps) ?? 0) * c.quantity, 0);
  const needA = loadA * 1.25;
  sections.push({
    title: '24 VDC power supply sizing',
    lines,
    result: `Load ${loadA.toFixed(2)} A + 25% margin = ${needA.toFixed(2)} A; supply rated ${capA.toFixed(1)} A (${supplies.map(({ part }) => part!.partNumber).join(', ') || 'none'}).`,
    ok: capA >= needA,
  });

  // 2. Motor branch circuits
  for (const m of d.inputs.motors) {
    const fla = motorFla(m.hp, m.voltage);
    const mine = parts.filter(({ c }) => c.motorTag === m.tag);
    const prot = mine.find(({ part }) => part && ['breaker', 'motorProtector', 'fuse'].includes(part.category));
    const ol = mine.find(({ part }) => part?.category === 'overload');
    const protA = prot?.part ? num(prot.part.ratings.amps ?? prot.part.ratings.maxAmps) : null;
    const olMin = ol?.part ? num(ol.part.ratings.minAmps) : null;
    const olMax = ol?.part ? num(ol.part.ratings.maxAmps) : null;
    const olOk = olMin !== null && olMax !== null ? fla >= olMin && fla <= olMax : true;
    sections.push({
      title: `Motor ${m.tag} — ${m.description || 'motor'} (${m.hp} HP, ${m.voltage})`,
      lines: [
        { item: 'Full-load current', value: `${fla} A`, basis: 'NEC Table 430.250 / 430.248', estimate: false },
        { item: 'Conductors (125% FLA, NEC 430.22)', value: awgFor(fla * 1.25), basis: `${(fla * 1.25).toFixed(1)} A`, estimate: false },
        { item: 'Branch protection', value: prot?.part ? `${prot.part.partNumber}${protA ? ` (${protA} A)` : ''}` : 'not assigned', basis: 'NEC 430.52 limits', estimate: false },
        { item: 'Overload setting', value: ol?.part ? `${ol.part.partNumber}, set to ${fla} A` : m.starter === 'vfd' ? 'VFD electronic overload, set to FLA' : 'not assigned', basis: olMin !== null ? `range ${olMin}–${olMax} A` : '', estimate: false },
      ],
      result: olOk ? 'Overload range covers the motor FLA.' : `Overload range ${olMin}–${olMax} A does not include FLA ${fla} A.`,
      ok: olOk && Boolean(prot) ,
    });
  }

  // 3. Cabinet heat
  const heatLines: CalcLine[] = [];
  let heat = 0;
  for (const { c, part } of parts) {
    if (!part || part.mount !== 'backplate') continue;
    let w: number | null = null;
    let basis = '';
    if (part.category === 'powerSupply' && num(part.ratings.watts)) { w = num(part.ratings.watts)! * 0.12; basis = '~12% loss of rated output'; }
    else if (part.category === 'vfd') { const hp = num(part.ratings.hp480 ?? part.ratings.hp230 ?? part.ratings.hp) ?? 1; w = hp * 746 * 0.04; basis = '~4% of drive rating'; }
    else if (part.ratings.kind === 'transformer' && num(part.ratings.va)) { w = num(part.ratings.va)! * 0.05; basis = '~5% of VA'; }
    else if (HEAT_W[part.category] !== undefined) { w = HEAT_W[part.category]!; basis = 'typical'; }
    if (w === null) continue;
    w *= c.quantity;
    heat += w;
    heatLines.push({ item: `${c.tag} ${part.partNumber}${c.quantity > 1 ? ` ×${c.quantity}` : ''}`, value: `${w.toFixed(1)} W`, basis, estimate: true });
  }
  const enc = parts.find(({ part }) => part?.category === 'enclosure' && part.ratings.kind === 'enclosure')?.part;
  if (enc) {
    const h = (num(enc.ratings.heightIn) ?? 24) * 0.0254, w = (num(enc.ratings.widthIn) ?? 20) * 0.0254, dd = (num(enc.ratings.depthIn) ?? 8) * 0.0254;
    // Wall-mounted: back not counted (IEC/TR 60890 style effective area, simplified).
    const area = h * w + 2 * h * dd + 2 * w * dd;
    const rise = heat / (5.5 * area);
    sections.push({
      title: 'Cabinet temperature rise',
      lines: [...heatLines, { item: 'Effective surface area', value: `${area.toFixed(2)} m²`, basis: `${enc.partNumber}, wall mounted`, estimate: false }],
      result: `${heat.toFixed(0)} W in ${area.toFixed(2)} m² → about ${rise.toFixed(1)} °C above room temperature (painted steel, k ≈ 5.5 W/m²K). ${rise > 15 ? 'Above 15 °C: add a filter fan or a larger enclosure.' : 'Natural cooling is enough at normal room temperatures (≤ 40 °C).'}`,
      ok: rise <= 15,
    });
  }

  sections.push({
    title: 'Short-circuit current rating (SCCR)',
    lines: [],
    result: 'Determine the panel SCCR per UL 508A Supplement SB from the component ratings and the available fault current at the site; mark it on the panel nameplate.',
    ok: true,
  });
  return sections;
}

export interface TestStep { section: string; step: string; expected: string }

/** Factory acceptance test checklist, one line per thing to prove. */
export function fatChecklist(p: ProjectSnapshot): TestStep[] {
  const steps: TestStep[] = [];
  const add = (section: string, step: string, expected: string) => steps.push({ section, step, expected });
  add('Pre-power', 'Check every wire against the wire list and every terminal for tightness.', 'No loose or mislabeled wires.');
  add('Pre-power', 'Check protective earth continuity from the ground bar to the door, back panel and every PE terminal.', '< 0.1 Ω.');
  add('Pre-power', 'Megger the incoming power circuits with all loads disconnected.', '> 1 MΩ.');
  add('Power-up', 'Close the main disconnect and each branch breaker in turn.', 'Correct voltage at each branch; 24 VDC supply reads 24 V ±5%.');
  add('Power-up', 'Download the PLC program and the HMI project.', 'PLC in RUN, no error lamp; HMI communicates (no comm error).');
  for (const x of p.io.filter((i) => i.type === 'input')) {
    add('Inputs', `Actuate ${p.addresses.get(x.id) || x.id} — ${x.description}.`, 'PLC input lamp and HMI I/O screen turn ON; OFF when released.');
  }
  for (const y of p.io.filter((i) => i.type === 'output')) {
    add('Outputs', `Force ${p.addresses.get(y.id) || y.id} — ${y.description} (motion area clear).`, 'Device operates; output lamp ON.');
  }
  const safety = p.spec.safety?.trim();
  add('Safety', 'Press each E-stop during automatic operation.', 'All motion stops immediately; machine cannot restart until the E-stop is released and reset.');
  if (safety) add('Safety', 'Verify every safety function listed in the specification (doors, light curtains, stop categories).', safety.split('\n').map((l) => l.replace(/^-\s*/, '')).join('; '));
  for (const a of p.hmi?.alarms ?? []) add('Alarms', `Create the condition for: ${a.message}.`, `HMI shows "${a.message}" (${a.address}); reset clears it once the cause is removed.`);
  for (const s of p.hmi?.screens ?? []) add('HMI', `Open the ${s.name} screen and press every button.`, `${s.purpose} All buttons respond and lamps reflect the machine state.`);
  const seq = p.spec.sequence?.trim();
  if (seq) seq.split('\n').filter((l) => l.trim()).forEach((l) => add('Sequence', `Automatic cycle: ${l.replace(/^-\s*/, '')}`, 'Happens as described, with no faults.'));
  const homing = p.spec.homing?.trim();
  if (homing) add('Start-up', `Homing / start-up: ${homing.replace(/\n-?\s*/g, ' ')}`, 'Completes in the specified order; Auto only possible afterwards.');
  add('Run test', 'Run the machine in automatic for at least 30 minutes (or the agreed number of cycles).', 'No faults; record cycle time and throughput.');
  return steps;
}

export interface ManualSection { title: string; paragraphs: string[] }

/** Operator manual assembled from the spec, operator devices, HMI and alarms. */
export function operatorManual(p: ProjectSnapshot): ManualSection[] {
  const spec = (id: (typeof SPEC_SECTIONS)[number]['id']) => p.spec[id]?.trim() ?? '';
  const lines = (t: string) => t.split('\n').map((l) => l.replace(/^-\s*/, '').trim()).filter(Boolean);
  const out: ManualSection[] = [];
  out.push({ title: '1. About this machine', paragraphs: lines(spec('overview')).length ? lines(spec('overview')) : ['See the machine specification.'] });
  out.push({ title: '2. Safety', paragraphs: [
    'Only trained operators may run this machine. Never reach into the machine while it can move.',
    ...lines(spec('safety')), ...lines(spec('guarding')),
    'Before maintenance: switch the main disconnect OFF and lock it out (lockout/tagout).',
  ] });
  const doorDevices = (p.electrical?.ioWiring ?? []).filter((w) => /door/i.test(w.location ?? '') || ['pushbutton-no', 'pushbutton-nc', 'selector', 'estop-contact', 'pilot-light'].includes(w.deviceType));
  out.push({ title: '3. Controls on the cabinet', paragraphs: doorDevices.length
    ? doorDevices.map((w) => `${w.deviceTag}: ${w.description}`)
    : lines(spec('operator')) });
  if (p.hmi) {
    out.push({ title: '4. Operator panel screens', paragraphs: p.hmi.screens.map((s) => {
      const buttons = s.elements.filter((e) => e.kind === 'button').map((e) => e.label);
      return `${s.name}: ${s.purpose}${buttons.length ? ` Buttons: ${buttons.join(', ')}.` : ''}`;
    }) });
  }
  out.push({ title: '5. Starting the machine', paragraphs: [
    'Check that guards are closed, air is on, and nobody is inside the machine.',
    ...lines(spec('homing')),
    ...lines(spec('modes')),
  ] });
  out.push({ title: '6. Normal operation', paragraphs: lines(spec('sequence')) });
  const alarms = p.hmi?.alarms ?? [];
  out.push({ title: '7. Alarms and what to do', paragraphs: [
    ...alarms.map((a) => `${a.message} — find and remove the cause, then press Reset.`),
    ...lines(spec('alarms')),
  ] });
  out.push({ title: '8. Stopping and shutting down', paragraphs: ['Press Stop to end the cycle. For an emergency, press the E-stop.', 'At the end of the shift: Stop, then switch the main disconnect OFF.'] });
  return out.filter((s) => s.paragraphs.length);
}

/** Everything above plus equipment reasons and the program summary, as one PDF. */
export async function buildEngineeringPdf(p: ProjectSnapshot, equipment: { cpu: string; why: string; modules: string[]; hmi: string | null } | null): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const W = 215.9, M = 18, maxW = W - 2 * M;
  let y = M;
  const page = () => { doc.addPage(); y = M; };
  const need = (h: number) => { if (y + h > 279.4 - M) page(); };
  // The built-in PDF font covers WinAnsi only; swap the few symbols it can't draw.
  const pdfSafe = (t: string) => t.replace(/☐/g, '[ ]').replace(/→/g, '->').replace(/≈/g, '~').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/Ω/g, ' ohm').replace(/[^\x20-\xff\n—–’‘“”•…]/g, '?');
  const text = (raw: string, size = 10, bold = false, color: [number, number, number] = [30, 35, 39]) => {
    const t = pdfSafe(raw);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    for (const line of doc.splitTextToSize(t, maxW) as string[]) {
      need(size * 0.45);
      doc.text(line, M, y);
      y += size * 0.45;
    }
    y += 1.5;
  };
  const h1 = (t: string) => { need(14); y += 3; text(t, 15, true, [0, 92, 96]); };
  const h2 = (t: string) => { need(10); y += 1; text(t, 11.5, true); };

  // Cover
  text('ENGINEERING PACKAGE', 10, true, [0, 140, 143]);
  text(p.projectName, 22, true);
  text(`${p.profile.vendor} ${p.profile.name} ${p.cpu.id}${p.hmi ? ` · HMI ${p.hmi.hmiPartNumber}` : ''}`, 11);
  text(`Prepared ${new Date().toLocaleDateString()} by PLC Autoprogrammer (AI-generated). To be checked and approved by a qualified engineer before purchase, build or use.`, 9, false, [107, 124, 133]);
  y += 4;
  text('Contents: 1 Equipment selection · 2 Calculations · 3 Factory acceptance test · 4 Operator manual · 5 Program summary', 9);

  h1('1. Equipment selection');
  if (equipment) {
    text(`PLC: ${equipment.cpu}`, 10, true);
    if (equipment.why) text(equipment.why);
    if (equipment.modules.length) text(`Expansion modules (slot order): ${equipment.modules.join(', ')}`);
    if (equipment.hmi) text(`Operator panel: ${equipment.hmi}`);
  } else text('Chosen manually.');

  h1('2. Calculations');
  for (const s of calculations(p)) {
    h2(s.title);
    for (const l of s.lines) text(`• ${l.item}: ${l.value}${l.basis ? ` (${l.basis}${l.estimate ? ', estimate' : ''})` : ''}`, 9);
    text(`${s.ok ? 'OK' : 'CHECK'} — ${s.result}`, 9.5, true, s.ok ? [0, 92, 96] : [176, 0, 0]);
  }

  page();
  h1('3. Factory acceptance test');
  text('Tick each line, record the result, sign and date at the end.', 9);
  let section = '';
  for (const t of fatChecklist(p)) {
    if (t.section !== section) { section = t.section; h2(section); }
    text(`☐ ${t.step}  →  ${t.expected}`, 9);
  }
  y += 6;
  text('Tested by: ____________________   Date: __________   Customer witness: ____________________', 9);

  page();
  h1('4. Operator manual');
  for (const s of operatorManual(p)) {
    h2(s.title);
    for (const para of s.paragraphs) text(para, 9.5);
  }

  if (p.profile.language === 'ladder' && p.ladder.rungs.length) {
    page();
    h1('5. Program summary');
    const label = (a: string) => (p.labels.get(a) ? ` (${p.labels.get(a)})` : '');
    p.ladder.rungs.forEach((r, i) => text(`Rung ${i + 1}: ${r.comment} → ${r.outputs.map((o) => describeOutput(o, label)).join('; ')}`, 9));
  }

  // Page footers
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(138, 154, 162);
    doc.text(`${p.projectName} — engineering package — page ${i} of ${pages}`, M, 279.4 - 8);
  }
  return doc.output('blob');
}
