import type Anthropic from '@anthropic-ai/sdk';
import type { Effort } from '../../store/useSettingsStore';
import type { CatalogCategory } from '../../electrical/types';
import { callClaude } from '../../lib/ai/anthropic';
import { fileToBlock, type Confidence } from '../../lib/ai/importAI';

/**
 * Cabinet photos → what is in the cabinet. One AI call reads every photo (door open, several angles,
 * close-ups of terminal strips and nameplates) and reports each device with the box it was seen in,
 * its nameplate, its place on a DIN rail and the wire numbers it can read. Several photos of the same
 * cabinet show the same device more than once: the AI is asked to report it once with every sighting,
 * and ./merge does the same deterministically as a safety net.
 */

/** Where a device was seen: photo index (0-based, in upload order) and a box as fractions of the photo. */
export interface Sighting { photo: number; x: number; y: number; w: number; h: number }

export interface PhotoDevice {
  /** Device tag as labelled in the cabinet ("K1", "CB2", "-Q1"); '' when no label is visible. */
  tag: string;
  category: CatalogCategory;
  manufacturer: string;
  /** Nameplate part number exactly as printed; '' when unreadable. */
  partNumber: string;
  /** Ratings read from the nameplate ("24 VDC coil, 9 A AC-3", "C10, 1-pole"). */
  ratings: string;
  /** DIN rail the device sits on, counted from the top (1 = top rail); 0 when not on a rail (door, enclosure wall). */
  rail: number;
  /** Position on its rail counted from the left (1 = leftmost). */
  order: number;
  confidence: Confidence;
  seen: Sighting[];
  /** Wire numbers / ferrule labels read at this device's terminals. */
  wires: { terminal: string; wire: string }[];
}

export interface TerminalStrip {
  tag: string;
  rail: number;
  order: number;
  terminals: { terminal: string; wire: string }[];
  confidence: Confidence;
  seen: Sighting[];
}

export interface PhotoReading {
  summary: string;
  rails: { rail: number; seen: Sighting[] }[];
  ducts: number;
  devices: PhotoDevice[];
  strips: TerminalStrip[];
  /** What can't be seen or read (hidden wiring, covered nameplates): asked on the Machine description page. */
  unseen: string[];
}

const CATEGORIES: CatalogCategory[] = ['enclosure', 'disconnect', 'breaker', 'fuse', 'powerSupply', 'contactor', 'overload', 'motorProtector', 'vfd', 'relay', 'safetyRelay', 'terminal', 'terminalAccessory', 'pushbutton', 'estop', 'pilotLight', 'selector', 'stackLight', 'plc', 'plcModule', 'hmi', 'sensor', 'solenoidValve', 'dinRail', 'wireDuct', 'groundBar', 'fan', 'other'];

const str = { type: 'string' } as const;
const int = { type: 'integer' } as const;
const num = { type: 'number' } as const;
const en = (values: string[]) => ({ type: 'string', enum: values });
const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const arr = (items: unknown) => ({ type: 'array', items });
const sighting = obj({ photo: int, x: num, y: num, w: num, h: num });
const wire = obj({ terminal: str, wire: str });
const confidence = en(['high', 'medium', 'low']);

export const PHOTO_SCHEMA = obj({
  summary: str,
  rails: arr(obj({ rail: int, seen: arr(sighting) })),
  ducts: int,
  devices: arr(obj({ tag: str, category: en(CATEGORIES), manufacturer: str, partNumber: str, ratings: str, rail: int, order: int, confidence, seen: arr(sighting), wires: arr(wire) })),
  strips: arr(obj({ tag: str, rail: int, order: int, terminals: arr(wire), confidence, seen: arr(sighting) })),
  unseen: arr(str),
});

export const PHOTO_SYSTEM = `You are a senior panel builder documenting an existing control cabinet from photos so it can be redrawn as-built. The photos show the SAME cabinet (door open, several angles, close-ups of nameplates and terminal strips).

Report:
- devices: every breaker, fuse, disconnect, contactor, overload, motor protector, relay, safety relay, PLC CPU and I/O module, VFD, servo drive (category "other"), power supply, door device and fan you can see. A device seen in several photos is ONE device: report it once and list every photo it appears in under "seen" (photo index from 0 in the order attached; box x, y, w, h as fractions 0-1 of that photo, top-left origin).
- tag: the device label in the cabinet (e.g. K1, CB2, -Q1); "" if none is visible. partNumber: exactly as printed on the nameplate; "" if unreadable (never guess). manufacturer and ratings from the nameplate.
- rail: DIN rails counted from the top of the back panel (1 = top); order: position on that rail from the left (1 = leftmost). Door and wall devices: rail 0.
- wires: wire numbers / ferrule labels you can read at the device's terminals.
- strips: terminal strips with their tag and each terminal's wire number you can read.
- rails: each DIN rail with where it is seen; ducts: number of horizontal wire ducts.
- confidence: high = clearly read; medium = readable but inferred; low = guessed from a partial view.
- unseen: what cannot be seen and must be asked (wiring behind ducts, covered nameplates, devices outside the photos), one short question each.
Never invent part numbers, tags or wire numbers. "summary": one or two sentences on the cabinet.`;

export interface RecogniseOptions {
  apiKey: string; model: string; effort: Effort; signal?: AbortSignal; photos: File[]; note: string;
  /** Photo → AI content block (default: the import path's downscaled JPEG); replaced in tests. */
  toBlock?: (f: File) => Promise<Anthropic.Beta.Messages.BetaContentBlockParam>;
}

/** Read the photos with the AI. */
export async function recogniseCabinet(o: RecogniseOptions): Promise<{ reading: PhotoReading; reasoning: string | null }> {
  if (!o.photos.length) throw new Error('Add at least one photo of the cabinet.');
  const blocks = await Promise.all(o.photos.map(o.toBlock ?? fileToBlock));
  const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = [
    ...blocks.flatMap((b, i) => [{ type: 'text' as const, text: `Photo ${i} (${o.photos[i].name}):` }, b]),
    { type: 'text', text: `${o.note.trim() ? `Notes from the engineer:\n${o.note.trim()}\n\n` : ''}Document this cabinet as-built.` },
  ];
  const { text, reasoning } = await callClaude({ apiKey: o.apiKey, model: o.model, effort: o.effort, signal: o.signal, task: 'import', system: PHOTO_SYSTEM, messages: [{ role: 'user', content }], schema: PHOTO_SCHEMA });
  let reading: PhotoReading;
  try { reading = JSON.parse(text) as PhotoReading; } catch (err) { throw new Error('The AI returned a result the app could not read. Please try again.', { cause: err }); }
  return { reading: clampReading(reading, o.photos.length), reasoning };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
/** Boxes inside their photo, photo indices that exist. */
export function clampReading(r: PhotoReading, photos: number): PhotoReading {
  const fix = (s: Sighting[]) => s.filter((x) => Number.isInteger(x.photo) && x.photo >= 0 && x.photo < photos).map((x) => {
    const X = clamp01(x.x), Y = clamp01(x.y);
    return { photo: x.photo, x: X, y: Y, w: Math.min(clamp01(x.w), 1 - X), h: Math.min(clamp01(x.h), 1 - Y) };
  });
  return {
    ...r,
    rails: r.rails.map((x) => ({ ...x, seen: fix(x.seen) })),
    devices: r.devices.map((d) => ({ ...d, tag: d.tag.trim(), partNumber: d.partNumber.trim(), seen: fix(d.seen) })),
    strips: r.strips.map((s) => ({ ...s, tag: s.tag.trim(), seen: fix(s.seen) })),
  };
}
