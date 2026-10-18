/**
 * Relay logic kept on the converted machine, as ladder rungs for the drawings (NFPA 79 ladder sheets drawn
 * by the electrical engine from ElectricalInputs.relayLogic): each circuit read from the old drawings,
 * with the new tags. Circuits that stay in a drive's own logic are not rungs (they stay in the description).
 */
import { ioOnlyDevices, type Conversion } from './convert';
import type { DrawnComponent, ExistingMachine, PathContact, PathEl } from './types';

// The shape agreed with the electrical engine (src/electrical/types.ts RelayLogic).
export type RelayContact = { t: 'contact'; tag: string; nc: boolean; terms?: string; kind?: PathContact['kind'] };
export type RelayEl =
  | RelayContact
  | { t: 'coil'; tag: string; kind: Extract<PathEl, { t: 'coil' }>['kind']; preset?: string; terms?: string }
  | { t: 'branch'; paths: RelayEl[][] };
export interface RelayRung { id: string; description?: string; path: RelayEl[] }
/** A device in the rungs, with the part the conversion chose (null: the design picks it by category). */
export interface RelayDevice { tag: string; oldTag: string; category: DrawnComponent['category']; description: string; partNumber: string | null; manufacturer: string | null }
export interface RelayLogic { supply: '24VDC' | '120VAC'; rungs: RelayRung[]; devices: RelayDevice[] }

/** The rungs for the circuits kept as relays (none when the logic moves into a PLC), and the circuits that could not be drawn. */
export function toRelayLogic(m: ExistingMachine, conv: Conversion): { logic: RelayLogic | null; notDrawn: string[] } {
  if (conv.logic !== 'keep-relays') return { logic: null, notDrawn: [] };
  const tag = (t: string) => conv.tags.get(t) ?? t;
  const contact = (c: PathContact): RelayContact => ({ t: 'contact', tag: tag(c.tag), nc: c.nc, ...(c.terms ? { terms: c.terms } : {}), kind: c.kind });
  const el = (e: PathEl): RelayEl => (e.t === 'branch' ? { t: 'branch', paths: e.paths.map((p) => p.map(contact)) }
    : e.t === 'coil' ? { t: 'coil', tag: tag(e.tag), kind: e.kind, ...(e.preset ? { preset: e.preset } : {}), ...(e.terms ? { terms: e.terms } : {}) }
      : contact(e));
  const rungs: RelayRung[] = [];
  const notDrawn: string[] = [];
  conv.circuits.forEach((c) => {
    if (c.becomes !== 'relays') return;
    const path = c.circuit.path ?? [];
    if (!path.some((e) => e.t === 'coil')) { notDrawn.push(c.text); return; }
    rungs.push({ id: c.id, description: c.circuit.function.split(/[:;,(]/)[0].trim().toUpperCase().slice(0, 40), path: path.map(el) });
  });
  // every device in the rungs, with its part: the matched equivalent, else none (the design picks one)
  const used = new Set<string>();
  const walk = (es: RelayEl[]) => es.forEach((e) => (e.t === 'branch' ? e.paths.forEach(walk) : used.add(e.tag)));
  rungs.forEach((r) => walk(r.path));
  const all = [...m.components, ...ioOnlyDevices(m)];
  const devices = all.filter((c) => used.has(tag(c.tag))).map((c): RelayDevice => {
    const p = conv.parts.find((x) => x.oldTag === c.tag);
    return { tag: tag(c.tag), oldTag: c.tag, category: c.category, description: c.description, partNumber: p?.to?.partNumber ?? null, manufacturer: p?.to?.manufacturer ?? null };
  });
  return { logic: { supply: conv.target.controlVolts, rungs, devices }, notDrawn };
}
