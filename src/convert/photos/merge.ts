import type { Confidence } from '../../lib/ai/importAI';
import type { PhotoDevice, PhotoReading, Sighting, TerminalStrip } from './recognise';

/**
 * Several photos of one cabinet show the same device more than once (an overview and a close-up of
 * its nameplate). The AI is asked to report it once; this merges what it still reported twice, and
 * never merges two real devices (a row of ten identical relays KA1-KA10 stays ten):
 * - two sightings in the same photo with different boxes are two devices;
 * - two different tags, two different readable part numbers or two different makers are two devices;
 * - the same tag is the same device;
 * - otherwise (one or both unlabelled) only the same kind at the same rail position is the same device.
 */

const RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
const norm = (s: string) => s.toUpperCase().replace(/[\s_]+/g, '').replace(/^-/, '');
const best = (a: Confidence, b: Confidence): Confidence => (RANK[a] >= RANK[b] ? a : b);

/** Boxes in the same photo that are not the same box (centres apart by more than half a box). */
const apartInOnePhoto = (a: Sighting[], b: Sighting[]) => a.some((x) => b.some((y) => x.photo === y.photo
  && (Math.abs(x.x + x.w / 2 - (y.x + y.w / 2)) > Math.max(x.w, y.w) / 2 || Math.abs(x.y + x.h / 2 - (y.y + y.h / 2)) > Math.max(x.h, y.h) / 2)));

function sameDevice(a: PhotoDevice, b: PhotoDevice): boolean {
  if (apartInOnePhoto(a.seen, b.seen)) return false;
  const ta = norm(a.tag), tb = norm(b.tag), pa = norm(a.partNumber), pb = norm(b.partNumber);
  if (ta && tb) return ta === tb && (!pa || !pb || pa === pb);
  if (pa && pb && pa !== pb) return false;
  if (a.manufacturer && b.manufacturer && norm(a.manufacturer) !== norm(b.manufacturer)) return false;
  // One or both unlabelled: the same kind at the same place on the same rail (an overview and its close-up).
  return a.category === b.category && a.rail === b.rail && a.order === b.order;
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
    const i = out.findIndex((x) => !apartInOnePhoto(x.seen, s.seen) && ((norm(x.tag) && norm(x.tag) === norm(s.tag)) || ((!norm(x.tag) || !norm(s.tag)) && x.rail === s.rail && x.order === s.order)));
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
