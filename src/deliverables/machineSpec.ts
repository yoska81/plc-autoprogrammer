/**
 * The full machine specification as one plain-text (Markdown) document the user can copy:
 * project data, the machine description and answered questions, control equipment, power and
 * motors, the I/O list, the electrical components, HMI screens and alarms, and the PLC program
 * structure. Built only from the project's data (no AI), so it always matches what was designed.
 */
import { OPERATOR_STATION_HEAD, operatorInterfaceText, operatorStationRows } from './docs/operatorStation';
import { SPEC_SECTIONS } from '../spec/types';
import { regionSpec, SUPPLY_INFO } from '../standards/regions';
import { currentRevision } from '../store/useProjectStore';
import { getPart } from '../electrical/catalog';
import { answerText } from '../components/questions/qa';
import type { ProjectSnapshot } from './collect';
import { getHmi } from '../hmi/hmiCatalog';
import { billOfMaterials } from '../electrical/derive';

const hmiText = (pn: string) => {
  const m = getHmi(pn);
  return getPart(pn)?.description ?? (m ? `${m.manufacturer ?? 'AutomationDirect'} ${m.family} ${m.sizeIn}" touch panel, ${m.widthPx}×${m.heightPx}` : '');
};
const cell = (s: unknown) => String(s ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
const table = (head: string[], rows: unknown[][]) =>
  rows.length ? [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n') : '_None._';

export function machineSpecText(p: ProjectSnapshot): string {
  const out: string[] = [];
  const rev = currentRevision(p.info);
  const region = regionSpec(p.info.region);
  const h = (n: number, t: string) => out.push('', `${'#'.repeat(n)} ${t}`, '');

  out.push(`# ${p.projectName} — Machine specification`);
  out.push('');
  out.push(table(['Item', 'Value'], [
    ['Customer', p.info.customer], ['Site', p.info.site], ['Project no.', p.info.projectNumber],
    ['Prepared by', p.info.preparedBy || p.info.company], ['Revision', `${rev.rev} · ${rev.date} · ${rev.description}`],
    ['Region / standards', `${region.label} — ${region.hint}`],
  ].filter((r) => cell(r[1]))));

  // Section numbers: next() gives 1, 2, 3 …
  let count = 0;
  const next = () => ++count;
  h(2, `${next()}. Machine description`);
  for (const s of SPEC_SECTIONS) {
    const t = (p.spec as Record<string, string>)[s.id]?.trim();
    // Bullet lists start on their own line under the bold title.
    if (t) out.push(/^\s*[-*•]/.test(t) || t.includes('\n') ? `**${s.title}**\n\n${t}` : `**${s.title}.** ${t}`, '');
  }
  const answered = p.questions.filter((q) => q.status !== 'open');
  const open = p.questions.filter((q) => q.status === 'open');
  if (answered.length || open.length) {
    h(2, `${next()}. Questions and answers`);
    for (const q of answered) out.push(`- **Q:** ${q.text}`, `  **A:** ${answerText(q)}`);
    if (open.length) out.push('', '_Still open:_', ...open.map((q) => `- ${q.text}`));
  }

  h(2, `${next()}. Control equipment`);
  out.push(table(['Item', 'Part number', 'Description'], [
    ['PLC CPU', p.cpu.id, `${p.profile.vendor} ${p.profile.name} · ${p.cpu.label}`],
    ...p.modules.map((m, i) => [`I/O module, slot ${i + 1}`, m, getPart(m)?.description ?? '']),
    ...(p.hmi ? [['Operator panel (HMI)', p.hmi.hmiPartNumber, hmiText(p.hmi.hmiPartNumber)]] : []),
    ...(!p.hmi && p.noHmi ? [['Operator interface', '—', 'Operator station: pushbuttons, selector and lamps (no touch panel)']] : []),
  ]));
  if (p.equipment?.why) out.push('', `Why: ${p.equipment.why}`);

  const d = p.electrical;
  if (d) {
    h(2, `${next()}. Power and motors`);
    const sup = SUPPLY_INFO[d.inputs.supply];
    out.push(table(['Item', 'Value'], [
      ['Supply', sup ? sup.text : d.inputs.supply], ['Enclosure rating', d.inputs.enclosureRating], ['Requirements', d.inputs.notes],
    ].filter((r) => cell(r[1]))));
    out.push('');
    out.push(table(['Tag', 'Motor', 'Power', 'Voltage', 'Starter', 'Reversing'],
      d.inputs.motors.map((m) => [m.tag, m.description, `${m.hp} HP`, m.voltage, m.starter, m.reversing ? 'yes' : 'no'])));
  }

  const wiring = new Map((p.electrical?.ioWiring ?? []).map((w) => [w.address, w]));
  h(2, `${next()}. I/O list (${p.io.length} points)`);
  out.push(table(['Address', 'Type', 'Description', 'Category', 'Device / signal'],
    p.io.map((x) => [p.addresses.get(x.id) ?? '', x.type, x.description, x.category,
      x.signal === 'analog' && x.analog ? `analog ${x.analog.range} ${x.analog.min}–${x.analog.max} ${x.analog.units}`
        : (() => { const w = wiring.get(p.addresses.get(x.id) ?? ''); return w ? `${w.deviceTag} (${w.deviceType})` : x.deviceType ?? ''; })()])));

  if (d) {
    // The bill of materials as ordered (quantities include what the terminal plan and accessories need).
    const groups = p.drawingCtx ? billOfMaterials(p.drawingCtx) : [];
    const lines = groups.flatMap((g) => g.lines.filter((l) => !l.note));
    h(2, `${next()}. Electrical components (${lines.length || d.components.length})`);
    out.push(lines.length
      ? table(['Item', 'Qty', 'Part number', 'Manufacturer', 'Description', 'Tags'], lines.map((l) => [l.item, l.qty, l.partNumber, l.manufacturer, l.description, l.tags.join(', ')]))
      : table(['Tag', 'Part number', 'Qty', 'Description', 'Function'], d.components.map((c) => [c.tag, c.partNumber, c.quantity, getPart(c.partNumber)?.description ?? '', c.function])));
    const notes = [...(d.notes ?? [])].filter((t) => t.trim());
    if (notes.length) out.push('', '**Design notes**', ...notes.map((t) => `- ${t}`));
  }

  if (p.hmi) {
    h(2, `${next()}. Operator screens (HMI ${p.hmi.hmiPartNumber})`);
    out.push(table(['Screen', 'Purpose', 'Access', 'Elements'],
      p.hmi.screens.map((s) => [s.name, s.purpose, s.level ?? 'operator', s.elements.length])));
    if (p.hmi.alarms.length) {
      out.push('', '**Alarms**');
      out.push(table(['Address', 'Message', 'Severity'], p.hmi.alarms.map((a) => [a.address, a.message, a.severity])));
    }
  }

  if (!p.hmi && p.noHmi) {
    h(2, `${next()}. Operator station (no touch panel)`);
    out.push(operatorInterfaceText(p));
    const rows = operatorStationRows(p);
    if (rows.length) out.push('', table(OPERATOR_STATION_HEAD, rows));
  }

  if (p.ladder.rungs.length) {
    h(2, `${next()}. PLC program (${p.ladder.rungs.length} rungs)`);
    const blocks = p.ladder.blocks?.length ? p.ladder.blocks : [{ id: '', name: 'Program', description: '' }];
    for (const b of blocks) {
      const rungs = p.ladder.rungs.filter((r) => (r.block ?? '') === b.id || (!b.id && !r.block));
      if (!rungs.length) continue;
      out.push(`**${b.name}** (${rungs.length} rungs)${b.description ? ` — ${b.description}` : ''}`);
      out.push(...rungs.map((r) => `- ${r.comment || '(no comment)'}`), '');
    }
  } else if (p.stCode?.trim()) {
    h(2, `${next()}. PLC program`);
    out.push('Structured Text program generated (see the program files).');
  }

  out.push('', '---', `_Generated by ISA Auto Programmer from the project data. AI-assisted design: to be checked and approved by a qualified engineer._`);
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
