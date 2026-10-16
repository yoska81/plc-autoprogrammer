/// <reference types="node" />
/**
 * Label layout tests. Run with:  npx tsx src/electrical/labels/layout.test.ts
 */
import assert from 'node:assert/strict';
import type { Label, LabelKind } from '../labels';
import { expandCopies, layoutLabel, PT, type Measure } from './layout';
import { DEFAULT_SETUP, SIZE_PRESETS, type LabelSetup } from './setup';
import { PRINTERS, SUPPLIES } from './printers';

// Helvetica-like widths: ~0.6 em bold, ~0.52 em regular.
const measure: Measure = (t, size, bold) => t.length * (bold ? 0.6 : 0.52) * size * PT;
const label = (code: string, description: string, kind: LabelKind = 'device'): Label => ({ kind, code, description, copies: 2, group: '' });

const samples = [
  label('101', 'Start pushbutton'), label('TB1-12', '24+ · SR1:A1 · Field'), label('K1', 'Conveyor motor contactor with overload relay and auxiliary contacts'),
  label('PB1', 'EMERGENCY STOP', 'legend'), label('W001', 'TB1-1..4 -> M1', 'cable'),
];

for (const size of SIZE_PRESETS) {
  for (const content of ['code', 'code+description'] as const) {
    for (const orientation of ['horizontal', 'vertical'] as const) {
      const setup: LabelSetup = { ...DEFAULT_SETUP, sizeId: size.id, content, orientation };
      for (const l of samples) {
        const lay = layoutLabel(l, setup, measure);
        const where = `${size.id} ${content} ${orientation} ${l.code}`;
        if (!size.tape && size.id !== 'custom') assert.deepEqual([lay.w, lay.h], [size.w, size.h], where);
        const bw = lay.rotate ? lay.h : lay.w, bh = lay.rotate ? lay.w : lay.h;
        assert.ok(lay.runs.length > 0, where);
        const boxes = lay.runs.map((r) => {
          const w = measure(r.text, r.size, r.bold);
          const x0 = r.align === 'center' ? r.x - w / 2 : r.x;
          return { x0, x1: x0 + w, y0: r.y - r.size * PT * 0.72, y1: r.y, r };
        });
        for (const b of boxes) {
          // Inside the label (text at the minimum size may only touch the edge).
          assert.ok(b.x0 >= -0.01 && b.x1 <= bw + 0.01 || b.r.size <= 3.5, `${where}: "${b.r.text}" outside horizontally`);
          assert.ok(b.y0 >= -0.01 && b.y1 <= bh + 0.01, `${where}: "${b.r.text}" outside vertically`);
        }
        // The number never overlaps the description.
        const main = boxes.filter((b) => b.r.bold), side = boxes.filter((b) => !b.r.bold);
        for (const a of main) for (const b of side) {
          const overlap = a.x0 < b.x1 - 0.01 && b.x0 < a.x1 - 0.01 && a.y0 < b.y1 - 0.01 && b.y0 < a.y1 - 0.01;
          assert.ok(!overlap, `${where}: number overlaps description`);
        }
      }
    }
  }
}

// Tape length follows the text.
const tape = { ...DEFAULT_SETUP, sizeId: 'tape12' };
assert.ok(layoutLabel(label('TB1-12', ''), tape, measure).w < layoutLabel(label('TB1-12', 'A long description of the terminal'), { ...tape, content: 'code+description' }, measure).w);
assert.equal(layoutLabel(label('1', ''), tape, measure).h, 12);

// Printer supplies: die-cut pages are the supply size; text stays in the printable area.
for (const sup of SUPPLIES) {
  assert.ok(sup.printers.length && sup.printers.every((id) => PRINTERS.some((p) => p.id === id)), `${sup.partNumber}: unknown printer`);
  assert.ok(/^https:\/\//.test(sup.source), `${sup.partNumber}: source URL`);
  for (const content of ['code', 'code+description'] as const) {
    for (const l of samples) {
      const lay = layoutLabel(l, { ...DEFAULT_SETUP, printerId: sup.printers[0], supply: sup.partNumber, content }, measure);
      const where = `${sup.partNumber} ${content} ${l.code}`;
      assert.equal(lay.h, sup.heightMm, where);
      if (!sup.continuous) assert.equal(lay.w, sup.widthMm, where);
      const pa = lay.printable ?? { x: 0, y: 0, w: lay.w, h: lay.h };
      for (const r of lay.runs) {
        assert.ok(r.y <= pa.y + pa.h + 0.01 && r.y - r.size * PT * 0.72 >= pa.y - 0.01, `${where}: "${r.text}" outside the printable area`);
      }
    }
  }
}

// Copies.
assert.equal(expandCopies(samples, true).length, samples.length * 2);
assert.equal(expandCopies(samples, false).length, samples.length);

console.log('label layout tests passed');
