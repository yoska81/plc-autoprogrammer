import type { ProjectSnapshot } from '../deliverables/collect';
import { simpleDoc } from '../deliverables/programListingPdf';
import { makeTable, type DocRow } from '../deliverables/docs/table';
import { naturalCompare } from '../electrical/derive';
import { MUTED } from '../deliverables/docs/pdfWriter';
import type { CheckoutEntry } from './useCheckoutStore';

export interface CheckoutRow {
  id: string;
  address: string;
  description: string;
  type: 'input' | 'output';
  entry?: CheckoutEntry;
}

/** I/O points in check-out order: inputs then outputs, by address. */
export function checkoutRows(p: ProjectSnapshot, entries: Record<string, CheckoutEntry>): CheckoutRow[] {
  return p.io
    .map((x) => ({ id: x.id, address: p.addresses.get(x.id) ?? '', description: x.description, type: x.type, entry: entries[x.id] }))
    .sort((a, b) => (a.type === b.type ? naturalCompare(a.address, b.address) : a.type === 'input' ? -1 : 1));
}

export function checkoutSummary(rows: CheckoutRow[]): { verified: number; total: number; last: string | null } {
  const done = rows.filter((r) => r.entry?.verified);
  const dates = done.map((r) => r.entry!.date).sort();
  return { verified: done.length, total: rows.length, last: dates[dates.length - 1] ?? null };
}

/** Printable I/O check-out sheet (blank columns for hand-written sign-off when not verified in the app). */
export async function buildCheckoutPdf(p: ProjectSnapshot, entries: Record<string, CheckoutEntry>): Promise<Blob> {
  const rows = checkoutRows(p, entries);
  const s = checkoutSummary(rows);
  return simpleDoc(p, 'I/O check-out sheet', `${s.verified} of ${s.total} points verified${s.last ? ` · last ${s.last}` : ''} · ${p.profile.name} ${p.cpu.id}`, (w) => {
    w.text('For each point: inputs — operate the field device and confirm the PLC input changes; outputs — force or run the output from the PLC and confirm the field device responds. Tick and sign each line.', { size: 8, color: MUTED });
    const body: DocRow[] = [];
    let last = '';
    for (const r of rows) {
      const g = r.type === 'input' ? 'Inputs' : 'Outputs';
      if (g !== last) { body.push({ group: g }); last = g; }
      const e = r.entry;
      body.push([r.address || '—', r.description, e?.verified ? 'OK' : '[ ]', e?.observed ?? '', e?.verified ? e.by : '', e?.verified ? e.date : '', e?.note ?? '']);
    }
    w.table(makeTable([['Address', 9], ['Description', 40], ['OK', 5, 'center'], ['PLC value', 9, 'center'], ['By', 10], ['Date', 14], ['Note', 30]], body, 6), { fontSize: 7.6 });
  });
}
