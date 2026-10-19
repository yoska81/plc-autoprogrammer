/**
 * The HMI side of an I/O list change (src/plc/core/ioRemap.ts): every binding moves with its I/O point in one
 * pass; an element bound to a deleted point is unbound and marked (a layout error until it is bound again or
 * deleted), never left on an address that now belongs to another input. Tags and alarms on a deleted point go.
 */
import type { HmiDesign, HmiElement } from './types';
import { remapAddress, remapIsEmpty, type IoRemap } from '../plc/core/ioRemap';

export function remapHmiDesign(design: HmiDesign, r: IoRemap, describe: (ioId: string) => string = () => ''): { design: HmiDesign; notes: string[] } {
  if (remapIsEmpty(r)) return { design, notes: [] };
  const notes: string[] = [];
  const gone = (a?: string | null) => (a ? r.gone.get(a.trim().toUpperCase()) : undefined);
  const lost = (a: string, id: string) => `${a.trim().toUpperCase()}${describe(id) ? ` ${describe(id)}` : ''}`;
  const move = (a: string) => remapAddress(a, r);
  // Descriptions name the I/O they act on ("PLC runs Y001 while …"): the roles are read from them, so they move too
  // (one pass: every address in the text looked up once).
  const moveInText = (text: string) => text.replace(/\b[XY]\d+\b/gi, (a) => move(a));
  // Labels and alarm texts the operator reads ("X001 E-stop OK", "Start PB (X002)"): the address moves with its
  // point in the same one pass, and a deleted point's address is dropped with its brackets or separator.
  const moveInLabel = (text: string) => {
    let dropped = false;
    const out = text.replace(/\s*\(\s*([XY]\d+)\s*\)|\b([XY]\d+)\b(\s*[:\u2013\u2014-]\s+|\s+)?/gi, (m, inParens: string | undefined, bare: string | undefined, sep: string | undefined) => {
      const a = (inParens ?? bare)!;
      if (gone(a)) { dropped = true; return ''; }
      return inParens ? m.replace(a, move(a)) : move(a) + (sep ?? '');
    });
    return dropped ? out.replace(/[ \t]{2,}/g, ' ').trim() : out;
  };
  // A label that was only the deleted address ("X002") would be blank: it names the old point instead.
  const relabel = (label: string, address?: string | null) => {
    const out = moveInLabel(label);
    if (out.trim() || !label.trim()) return out;
    const g = gone(address);
    return (g && describe(g)) || '(unbound)';
  };
  const el = (e: HmiElement): HmiElement => {
    const g = gone(e.address);
    const next: HmiElement = { ...e, label: e.label ? relabel(e.label, e.address) : e.label };
    if (g) { next.address = ''; next.lostIo = lost(e.address!, g); } else if (e.address) next.address = move(e.address);
    if (e.interlock) {
      const gi = gone(e.interlock);
      if (gi) { next.interlock = null; next.lostIo = next.lostIo ?? lost(e.interlock, gi); } else next.interlock = move(e.interlock);
    }
    if (e.symbols) next.symbols = e.symbols.map((s) => {
      const label = s.label ? relabel(s.label, s.address) : s.label;
      return gone(s.address) ? { ...s, label, address: '' } : s.address ? { ...s, label, address: move(s.address) } : { ...s, label };
    });
    return next;
  };
  const tags = design.tags.filter((t) => {
    const g = gone(t.address);
    if (g) notes.push(`Removed the HMI tag ${t.name} (${lost(t.address, g)}): its I/O point was deleted.`);
    return !g;
  }).map((t) => ({ ...t, address: move(t.address), description: moveInText(t.description) }));
  const alarms = design.alarms.filter((a) => {
    const g = gone(a.address);
    if (g) notes.push(`Removed the alarm "${a.message}" (${lost(a.address, g)}): its I/O point was deleted.`);
    return !g;
  }).map((a) => ({ ...a, address: move(a.address), message: moveInLabel(a.message) }));
  const screens = design.screens.map((s) => ({ ...s, elements: s.elements.map(el) }));
  const unbound = screens.flatMap((s) => s.elements.filter((e) => e.lostIo && !design.screens.find((o) => o.id === s.id)?.elements.find((o) => o.id === e.id)?.lostIo).map((e) => `“${e.label || e.id}” on ${s.name}`));
  if (unbound.length) notes.push(`Unbound ${unbound.length} element(s) whose I/O point was deleted or lost its address: ${unbound.slice(0, 5).join(', ')}${unbound.length > 5 ? '…' : ''}. Bind them again or delete them.`);
  return { design: { ...design, screens, tags, alarms }, notes };
}

const KIND: Partial<Record<HmiElement['kind'], string>> = { indicator: 'lamp', button: 'button', numeric: 'value', 'numeric-entry': 'entry', nav: 'navigation button', multistate: 'state display', bar: 'bar graph', trend: 'trend', machine: 'machine picture' };

/** What on the HMI uses an address, in short words ("Screen Main: lamp 'Running'"), for "delete this I/O point?". */
export function hmiUsesOf(design: HmiDesign | null | undefined, address: string): string[] {
  if (!design) return [];
  const a = address.trim().toUpperCase();
  const is = (x?: string | null) => Boolean(x) && x!.trim().toUpperCase() === a;
  const out: string[] = [];
  for (const s of design.screens) {
    for (const e of s.elements) {
      const what = KIND[e.kind] ?? e.kind;
      if (is(e.address)) out.push(`Screen ${s.name}: ${what} '${e.label || e.id}'`);
      else if (is(e.interlock)) out.push(`Screen ${s.name}: ${what} '${e.label || e.id}' (its permissive)`);
      for (const sym of e.symbols ?? []) if (is(sym.address)) out.push(`Screen ${s.name}: machine symbol '${sym.label || sym.kind}'`);
    }
  }
  for (const al of design.alarms) if (is(al.address)) out.push(`Alarm: '${al.message}'`);
  return out;
}
