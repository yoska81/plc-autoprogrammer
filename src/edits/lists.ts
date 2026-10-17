/**
 * Notes the user adds to the cable schedule and the wire list. Kept in the hand-edit store by cable
 * tag / wire number and ends (stable while the design is regenerated), written into the CSV and
 * Excel files next to the generated columns.
 */
import { cableScheduleCsv, wireListCsv, type Cable, type DrawingContext, type WireRecord } from '../electrical/derive';
import { currentEdits } from './useEditsStore';

export const cableKey = (c: Pick<Cable, 'tag'>) => `cable:${c.tag}`;
export const wireKey = (w: Pick<WireRecord, 'wire' | 'from' | 'to'>) => `wire:${w.wire}|${w.from}|${w.to}`;

/** The user's note for a key ('' = none). */
export const noteOf = (key: string, notes: Record<string, string> = currentEdits().notes): string => notes[key] ?? '';

const cell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Add a "Note" column to a generated CSV: `noteFor` gets the row's cells (header excluded). */
function withNotes(csv: string, noteFor: (cells: string[]) => string): string {
  const lines = csv.replace(/\r\n$/, '').split('\r\n');
  return lines.map((l, i) => `${l},${i === 0 ? 'Note' : cell(noteFor(parseRow(l)))}`).join('\r\n') + '\r\n';
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
  return withNotes(wireListCsv(ctx), (c) => noteOf(wireKey({ wire: c[0], from: c[1], to: c[2] }), notes));
}
