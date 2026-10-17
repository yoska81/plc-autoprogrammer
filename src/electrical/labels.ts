import {
  buildModel, cableSchedule, naturalCompare, panelLayout, resolveComponents, terminalPlan, wireNumbers,
  type DrawingContext,
} from './derive';

/** What a label marks. */
export type LabelKind = 'wire' | 'terminal' | 'device' | 'field' | 'cable' | 'legend';

export const LABEL_KINDS: { kind: LabelKind; title: string; hint: string }[] = [
  { kind: 'wire', title: 'Wire markers', hint: 'One per wire end (two per wire)' },
  { kind: 'terminal', title: 'Terminal markers', hint: 'One per terminal, plus a strip header' },
  { kind: 'device', title: 'Cabinet device tags', hint: 'Breakers, contactors, PLC, power supplies…' },
  { kind: 'field', title: 'Field device tags', hint: 'Sensors, valves, motors, junction boxes on the machine' },
  { kind: 'cable', title: 'Cable tags', hint: 'One at each end of every field cable' },
  { kind: 'legend', title: 'Door legend plates', hint: 'Engraved text under operators on the door' },
];

export interface Label {
  kind: LabelKind;
  /** The number / tag printed large: "101", "TB2-4", "K1", "W003". */
  code: string;
  /** Plain description printed beside the code when chosen. */
  description: string;
  /** How many identical labels to print. */
  copies: number;
  /** Sort / group key, e.g. terminal strip. */
  group: string;
}

/** Categories that are not marked with a device tag (accessories, rails, ducts, cartridges). */
const NO_TAG = new Set(['dinRail', 'wireDuct', 'terminalAccessory', 'terminal', 'groundBar']);

/** Every label the panel and the machine need, from the electrical design. */
export function buildLabels(ctx: DrawingContext): Label[] {
  const out: Label[] = [];

  // Wire markers: each wire number appears on every conductor of that potential, marked at both ends.
  const wires = new Map<string, { n: number; fn: string; from: string; to: string }>();
  for (const w of wireNumbers(ctx)) {
    if (!w.wire) continue;
    const cur = wires.get(w.wire);
    if (cur) cur.n += 1;
    else wires.set(w.wire, { n: 1, fn: w.function, from: w.from, to: w.to });
  }
  for (const [wire, w] of [...wires].sort((a, b) => naturalCompare(a[0], b[0]))) {
    out.push({ kind: 'wire', code: wire, description: w.fn || `${w.from} → ${w.to}`, copies: w.n * 2, group: 'Wires' });
  }

  // Terminal markers: a header per strip, then each terminal number.
  for (const strip of terminalPlan(ctx)) {
    out.push({ kind: 'terminal', code: strip.tag, description: strip.title, copies: 1, group: strip.tag });
    for (const t of strip.terminals) {
      out.push({
        kind: 'terminal', code: t.label || `${strip.tag}-${t.number}`,
        description: t.kind === 'spare' ? 'Spare' : [t.wire, t.external].filter(Boolean).join(' · ') || t.group,
        copies: 1, group: strip.tag,
      });
    }
  }

  // Cabinet device tags (back panel and door devices are both tagged inside the cabinet).
  for (const rc of resolveComponents(ctx).sort((a, b) => naturalCompare(a.tag, b.tag))) {
    if (!rc.tag || NO_TAG.has(rc.category) || rc.mount === 'field') continue;
    out.push({ kind: 'device', code: rc.tag, description: rc.comp.function || rc.part?.description || rc.partNumber, copies: 1, group: rc.category });
  }

  // Field devices and junction boxes on the machine.
  const machine = buildModel(ctx).machine;
  for (const d of [...machine.devices].sort((a, b) => naturalCompare(a.tag, b.tag))) {
    out.push({ kind: 'field', code: d.tag, description: d.description, copies: 1, group: d.zone });
  }
  for (const jb of machine.jbs) {
    out.push({ kind: 'field', code: jb.tag, description: `Junction box — ${jb.zone}`, copies: 1, group: jb.zone });
  }

  // Cable tags at both ends.
  for (const c of cableSchedule(ctx)) {
    out.push({ kind: 'cable', code: c.tag, description: `${c.from} → ${c.to}`, copies: 2, group: c.zone });
  }

  // Door legend plates: engraved text for each operator.
  for (const it of panelLayout(ctx).door.items) {
    if (it.kind === 'hmi' || it.kind === 'other') continue;
    out.push({ kind: 'legend', code: it.tag, description: it.legend.join(' ') || it.tag, copies: 1, group: 'Door' });
  }
  return out;
}

export type LabelContent = 'code' | 'code+description';

/** The text printed on a label for the chosen content. */
export function labelText(l: Label, content: LabelContent): { main: string; side: string } {
  // A legend plate's useful text is the legend itself.
  if (l.kind === 'legend') return { main: l.description.toUpperCase(), side: content === 'code+description' ? l.code : '' };
  return { main: l.code, side: content === 'code+description' ? l.description : '' };
}

/** CSV for label-printer software (Brady Workstation, Brother P-touch Editor, M-Print, Phoenix Contact). */
export function labelsCsv(labels: Label[], content: LabelContent, expandCopies: boolean): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [['Type', 'Group', 'Number', 'Description', 'Text', 'Copies'].map(esc).join(',')];
  for (const l of labels) {
    const t = labelText(l, content);
    const text = t.side ? `${t.main} ${t.side}` : t.main;
    const kind = LABEL_KINDS.find((k) => k.kind === l.kind)?.title ?? l.kind;
    const line = [kind, l.group, l.code, l.description, text, expandCopies ? 1 : l.copies].map(esc).join(',');
    for (let i = 0; i < (expandCopies ? l.copies : 1); i++) rows.push(line);
  }
  return rows.join('\r\n') + '\r\n';
}
