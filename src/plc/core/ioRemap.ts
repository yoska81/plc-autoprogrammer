/**
 * What an I/O list change did to the PLC addresses. Addresses are handed out in list order, so deleting,
 * inserting or moving a point shifts the points after it: X003 becomes X002 while X002 becomes X001. The
 * program and the HMI rewrite their operands through `moved` in ONE pass (each operand looked up in the
 * old → new table, never one replace after another, so swaps and chains come out right), and flag anything on
 * a `gone` address: it is never silently pointed at whatever input took that address.
 */
export interface IoRemap {
  /** Same I/O point, new address (old → new). */
  moved: Map<string, string>;
  /** The point was deleted: its old address → its I/O id. Whatever now sits at that address is another point. */
  gone: Map<string, string>;
  /** Points that are new in the list: I/O id → address. */
  added: Map<string, string>;
}

const norm = (a: string | undefined) => (a ?? '').trim().toUpperCase();

/** Compare the I/O addresses (I/O id → address, as resolveAddresses gives them) before and after a change. */
export function ioRemap(prev: Map<string, string>, next: Map<string, string>): IoRemap {
  const moved = new Map<string, string>(), gone = new Map<string, string>(), added = new Map<string, string>();
  for (const [id, before] of prev) {
    const a = norm(before);
    if (!a) continue;
    if (!next.has(id)) { gone.set(a, id); continue; }
    const b = norm(next.get(id));
    if (b && b !== a) moved.set(a, b);
  }
  for (const [id, after] of next) if (!prev.has(id) && norm(after)) added.set(id, norm(after));
  return { moved, gone, added };
}

/** True when the change touched no address (nothing to rewrite or flag). */
export const remapIsEmpty = (r: IoRemap) => !r.moved.size && !r.gone.size;

/**
 * One operand through the table: its new address, or itself when it did not move. Callers map each operand
 * once (never chain calls), which keeps swaps and chains simultaneous.
 */
export function remapAddress(address: string, r: IoRemap): string {
  return r.moved.get(norm(address)) ?? address;
}
