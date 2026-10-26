/**
 * Notes the user adds to the cable schedule and the wire list. Kept in the hand-edit store by cable
 * tag / wire number and ends (stable while the design is regenerated), written into the CSV and
 * Excel files next to the generated columns.
 */
import { buildModel, cableScheduleCsv, wireListCsv, type Cable, type DrawingContext, type WireRecord } from '../electrical/derive';
import { currentEdits } from './useEditsStore';

export const cableKey = (c: Pick<Cable, 'tag'>) => `cable:${c.tag}`;
export const wireKey = (w: Pick<WireRecord, 'wire' | 'from' | 'to'>, n = 1) => `wire:${w.wire}|${w.from}|${w.to}${n > 1 ? `#${n}` : ''}`;

/** Keys of a wire list in order: a wire listed twice with the same ends gets "#2". */
export function wireKeys(wires: Pick<WireRecord, 'wire' | 'from' | 'to'>[]): string[] {
  const seen = new Map<string, number>();
  return wires.map((w) => {
    const k = wireKey(w);
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    return wireKey(w, n);
  });
}

/**
 * Note keys of the design's wire list, row for row: by the app's wire numbers and pins (X001, PLC:X001) also when the
 * list shows the PLC's own (I0.0 on an S7), so a note stays with its wire when the CPU changes.
 */
export const wireNoteKeys = (ctx: DrawingContext): string[] => wireKeys(buildModel(ctx).wires);

/** The user's note for a key ('' = none). */
export const noteOf = (key: string, notes: Record<string, string> = currentEdits().notes): string => notes[key] ?? '';

const cell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Add a "Note" column to a generated CSV: `noteFor` gets the row's cells and data row number (header excluded). */
function withNotes(csv: string, noteFor: (cells: string[], row: number) => string): string {
  const lines = csv.replace(/\r\n$/, '').split('\r\n');
  return lines.map((l, i) => `${l},${i === 0 ? 'Note' : cell(noteFor(parseRow(l), i - 1))}`).join('\r\n') + '\r\n';
}

/** One CSV row → cells (handles quoted cells). */
export function parseRow(line: string): string[] {
  const out: string[] = [];
  let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Cable schedule CSV with the user's notes (one per cable, on each of its core rows). */
export function cableScheduleCsvWithNotes(ctx: DrawingContext, notes: Record<string, string> = currentEdits().notes): string {
  return withNotes(cableScheduleCsv(ctx), (c) => noteOf(`cable:${c[0]}`, notes));
}

/** Wire list CSV with the user's notes. */
export function wireListCsvWithNotes(ctx: DrawingContext, notes: Record<string, string> = currentEdits().notes): string {
  // The CSV has one row per wire record, in the same order.
  const keys = wireNoteKeys(ctx);
  return withNotes(wireListCsv(ctx), (_c, i) => noteOf(keys[i] ?? '', notes));
}
