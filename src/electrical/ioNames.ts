/**
 * The PLC's own I/O names on the drawings. The app numbers I/O as CLICK terminals (X001, Y001, DF1); a Siemens
 * electrician looks for %I0.0 / %Q0.0, a Micro800 one for _IO_EM_DI_00, a Unitronics one for I0 / O0. For a PLC that
 * names its I/O differently, the PLC terminal rows show the native name and the I/O wires are numbered after it
 * (I0.0, Q0.0A behind a safety contact, IW64+ for an analog loop): wire list, terminal plan, cable schedule and
 * wire markers alike. CLICK keeps its addresses.
 */
import { PLC_PROFILES } from '../plc/core/profiles';
import { moduleSlots } from '../plc/core/modules';
import { rackTerminals } from '../plc/core/addressCheck';

export interface IoNames {
  /** App address → the PLC's own name (X001 → %I0.0). */
  native: Map<string, string>;
  /** App address → its wire number (X001 → I0.0). */
  wire: Map<string, string>;
}

const EMPTY: IoNames = { native: new Map(), wire: new Map() };

/** A native name as a wire number: no "%", no vendor prefix, no spaces; null when it is no good as one. */
export function wireOfNative(n: string): string | null {
  const w = n.replace(/^%/, '').replace(/^_IO_EM_/i, '').replace(/^on-board\s*/i, '').replace(/[\s_]+/g, '');
  return w && w.length <= 10 && /^[A-Z0-9.]+$/i.test(w) ? w.toUpperCase() : null;
}

/**
 * The I/O names of a PLC (CPU part number) with these modules (part numbers, slot order): every discrete terminal the
 * CPU and modules have (spares are drawn too) and the analog addresses given (DF1…). An address the hardware does not
 * have (a stale X001 on a CPU without on-board inputs) keeps its app address; so does every address when two would
 * get the same name.
 */
export function ioNames(cpuPartNumber: string, modules: string[], addresses: string[]): IoNames {
  const profile = PLC_PROFILES.find((p) => p.cpuModels.some((c) => c.id === cpuPartNumber));
  const cpu = profile?.cpuModels.find((c) => c.id === cpuPartNumber);
  if (!profile?.ioTag || !cpu) return EMPTY;
  const slots = moduleSlots(modules);
  const rack = { profile, cpu, modules: slots };
  const terminals = [...rackTerminals(rack, 'input'), ...rackTerminals(rack, 'output')];
  const native = new Map<string, string>(), wire = new Map<string, string>();
  for (const a of new Set([...terminals, ...addresses.filter((x) => /^DF\d+$/i.test(x))])) {
    // a UniStream CPU's own I/O ("on-board input 0") is marked I0 / O0 on its terminals
    const t = profile.ioTag(a, slots, cpuPartNumber)?.replace(/^on-board\s+(input|output)\s+(\d+)$/i, (_x, k: string, n: string) => `${/^i/i.test(k) ? 'I' : 'O'}${n}`);
    if (!t || t.toUpperCase() === a.toUpperCase()) continue;
    // only a name that also works as a wire number: drawings, wire list and markers then always agree (a UniStream
    // slot input "slot 1 UID-1600 I0" stays X101); the label drops an "on-board" prefix
    const w = wireOfNative(t);
    if (!w) continue;
    native.set(a, t.replace(/^on-board\s*/i, ''));
    wire.set(a, w);
  }
  // one name per address: two terminals on one wire number would join two circuits
  const unique = (m: Map<string, string>) => new Set([...m.values()].map((v) => v.toUpperCase())).size === m.size;
  return native.size && unique(native) && unique(wire) ? { native, wire } : EMPTY;
}

/** An I/O wire number in the PLC's naming: X001 → I0.0, Y001A → Q0.0A, DF1+ → IW64+ (others unchanged). */
export function renameWire(names: IoNames, w: string): string {
  if (!names.wire.size) return w;
  const m = /^([XY]\d{3}|DF\d+)([A-Z]|\+|-|SH)?$/.exec(w);
  const to = m ? names.wire.get(m[1]) : undefined;
  return to ? `${to}${m![2] ?? ''}` : w;
}

/** A device pin on a PLC I/O terminal in the PLC's naming: "PLC:X001" → "PLC:I0.0" (others unchanged). */
export function renamePin(names: IoNames, end: string): string {
  if (!names.wire.size) return end;
  const m = /^([^:\s]+):([XY]\d{3})$/.exec(end);
  const to = m ? names.wire.get(m[2]) : undefined;
  return to ? `${m![1]}:${to}` : end;
}

/** I/O addresses in a document's text in the PLC's own naming: "Start button (X002)" → "Start button (%I0.1)". */
export function renameAddressText(names: IoNames, text: string): string {
  if (!names.native.size) return text;
  return text.replace(/(?<![\w%.])([XY]\d{3}|DF\d+)(?![\w])/g, (a) => names.native.get(a) ?? a);
}

/** An I/O address as the PLC names it, for drawing text: X001 → %I0.0 on an S7, X001 on a CLICK. */
export function ioLabel(names: IoNames, address: string): string {
  return names.native.get(address) ?? address;
}
