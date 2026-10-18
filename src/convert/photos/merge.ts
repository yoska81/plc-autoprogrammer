import type { Confidence } from '../../lib/ai/importAI';
import type { PhotoDevice, PhotoReading, Sighting, TerminalStrip } from './recognise';

/**
 * Several photos of one cabinet show the same device more than once (an overview and a close-up of
 * its nameplate). The AI is asked to report it once; this merges what it still reported twice:
 * - two different tags, or two different readable part numbers, are never the same device;
 * - the same tag is the same device;
 * - the same part number on the same rail next to each other (one of them untagged) is the same device;
 * - a device of the same kind at the same rail position, seen once without a label or a readable
 *   nameplate, is the same device (unless the two manufacturers differ).
 */

const RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
const norm = (s: string) => s.toUpperCase().replace(/[\s_]+/g, '').replace(/^-/, '');
const best = (a: Confidence, b: Confidence): Confidence => (RANK[a] >= RANK[b] ? a : b);

function sameDevice(a: PhotoDevice, b: PhotoDevice): boolean {
  const ta = norm(a.tag), tb = norm(b.tag), pa = norm(a.partNumber), pb = norm(b.partNumber);
  if (ta && tb && ta !== tb) return false;
  if (pa && pb && pa !== pb) return false;
  if (ta && ta === tb) return true;
  const near = a.rail === b.rail && Math.abs(a.order - b.order) <= 1;
  if (pa && pa === pb) return near;
  if (a.manufacturer && b.manufacturer && norm(a.manufacturer) !== norm(b.manufacturer)) return false;
  // An overview sighting with no label and no readable nameplate is the close-up of the same kind of device at that spot.
  return (!ta || !tb) && (!pa || !pb) && a.category === b.category && a.rail === b.rail && a.order === b.order;
}

const sameSighting = (a: Sighting, b: Sighting) => a.photo === b.photo && Math.abs(a.x - b.x) < 0.02 && Math.abs(a.y - b.y) < 0.02;
const unionSeen = (a: Sighting[], b: Sighting[]) => [...a, ...b.filter((s) => !a.some((x) => sameSighting(x, s)))];
const unionWires = (a: { terminal: string; wire: string }[], b: { terminal: string; wire: string }[]) =>
  [...a, ...b.filter((w) => !a.some((x) => x.terminal === w.terminal && x.wire === w.wire))];

/** One device from two sightings: the surer reading of each field, every photo it was seen in. */
function combine(a: PhotoDevice, b: PhotoDevice): PhotoDevice {
  const [hi, lo] = RANK[b.confidence] > RANK[a.confidence] ? [b, a] : [a, b];
  return {
    tag: hi.tag || lo.tag,
    category: hi.category !== 'other' ? hi.category : lo.category,
    manufacturer: hi.manufacturer || lo.manufacturer,
    partNumber: hi.partNumber || lo.partNumber,
    ratings: hi.ratings.length >= lo.ratings.length ? hi.ratings : lo.ratings,
    rail: hi.rail || lo.rail,
    order: hi.rail ? hi.order : lo.order,
    confidence: best(a.confidence, b.confidence),
    seen: unionSeen(a.seen, b.seen),
    wires: unionWires(a.wires, b.wires),
  };
}

export function mergeDevices(list: PhotoDevice[]): PhotoDevice[] {
  const out: PhotoDevice[] = [];
  for (const d of list) {
    const i = out.findIndex((x) => sameDevice(x, d));
    if (i < 0) out.push({ ...d, seen: [...d.seen], wires: [...d.wires] });
    else out[i] = combine(out[i], d);
  }
  // Rail order: top rail first, left to right; door / wall devices (rail 0) last.
  return out.sort((a, b) => (a.rail || 99) - (b.rail || 99) || a.order - b.order);
}

export function mergeStrips(list: TerminalStrip[]): TerminalStrip[] {
  const out: TerminalStrip[] = [];
  for (const s of list) {
    const i = out.findIndex((x) => (norm(x.tag) && norm(x.tag) === norm(s.tag)) || (!norm(x.tag) && !norm(s.tag) && x.rail === s.rail && x.order === s.order));
    if (i < 0) { out.push({ ...s, terminals: [...s.terminals], seen: [...s.seen] }); continue; }
    const x = out[i];
    out[i] = { ...x, tag: x.tag || s.tag, confidence: best(x.confidence, s.confidence), seen: unionSeen(x.seen, s.seen), terminals: unionWires(x.terminals, s.terminals) };
  }
  return out;
}

/** The reading with every device and terminal strip once. */
export function mergeReading(r: PhotoReading): PhotoReading {
  return { ...r, devices: mergeDevices(r.devices), strips: mergeStrips(r.strips), unseen: [...new Set(r.unseen.map((u) => u.trim()).filter(Boolean))] };
}
