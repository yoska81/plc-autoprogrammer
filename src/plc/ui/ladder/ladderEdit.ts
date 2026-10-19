/**
 * Pure, immutable edit helpers for the ladder editor, plus layout constants
 * shared by the drawing components.
 */
import { newRungId } from '../../core/ladder';
import type { LadderElement, LadderOutput, LadderProgram, Rung } from '../../core/ladder';

// ---------------------------------------------------------------- geometry
/** Width of one input (contact) cell. */
export const CELL_W = 116;
/** Height of one input row (branch). */
export const ROW_H = 72;
/** Top of the symbol inside a cell (address text sits above). */
export const SYM_TOP = 20;
/** Height of the symbol band. */
export const SYM_H = 28;
/** Y of the horizontal wire inside a row. */
export const WIRE_Y = SYM_TOP + SYM_H / 2;
/** Width of an output instruction (coil or box). */
export const OUT_W = 210;
/** Gap between the input join and the output column's vertical wire. */
export const JOIN_GAP = 28;
/** Wire stub between the output vertical and the instruction, and after it. */
export const OUT_STUB = 16;
/** Minimum number of input columns (keeps short rungs looking like ladders). */
export const MIN_COLS = 3;
export const BOX_TOP = WIRE_Y - 11;
export const BOX_HEADER = 22;
export const BOX_LINE = 15;

export type OutputType = LadderOutput['type'];
export type ElementType = LadderElement['type'];

/** Parameter lines shown inside an instruction box. */
export function boxLines(o: LadderOutput): string[] {
  switch (o.type) {
    case 'TMR':
      return [
        o.mode === 'ON_DELAY' ? 'On-delay' : 'Off-delay',
        `Setpoint ${o.preset || '?'} ${o.unit}`,
        ...(o.accumulate ? ['Retentive'] : []),
        ...(o.resetAddress ? [`Reset ${o.resetAddress}`] : []),
      ];
    case 'CNT':
      return [
        o.direction === 'UP' ? 'Count up' : 'Count down',
        `Setpoint ${o.preset || '?'}`,
        ...(o.resetAddress ? [`Reset ${o.resetAddress}`] : []),
      ];
    case 'COPY':
      return [`Src  ${o.source || '?'}`, `Dest ${o.dest || '?'}`];
    case 'MATH':
      return [`${o.dest || '?'} =`, o.expression || '?'];
    case 'RAW':
      return rawLines(o.text);
    default:
      return [];
  }
}

export function isBox(o: LadderOutput): boolean {
  return o.type !== 'OUT' && o.type !== 'SET' && o.type !== 'RST';
}

export function boxHeight(o: LadderOutput): number {
  return BOX_HEADER + boxLines(o).length * BOX_LINE + 6;
}

/** Height of an output row. */
export function outputRowHeight(o: LadderOutput): number {
  return isBox(o) ? BOX_TOP + boxHeight(o) + 20 : ROW_H;
}

/** Main address of an output (shown above coils / in box headers). */
export function outputAddress(o: LadderOutput): string {
  switch (o.type) {
    case 'COPY': return o.dest;
    case 'MATH': return o.dest;
    case 'RAW': return '';
    default: return o.address;
  }
}

// ---------------------------------------------------------------- normalize
export const normAddr = (s: string) => s.toUpperCase().trim();

// ---------------------------------------------------------------- defaults
export function defaultElement(type: ElementType, prev?: LadderElement): LadderElement {
  const addr = !prev || prev.type === 'RAW' ? '' : prev.type === 'CMP' ? prev.left : prev.address;
  if (type === 'RAW') return prev?.type === 'RAW' ? prev : { type, vendor: '', text: '' };
  if (type === 'CMP') return { type: 'CMP', left: addr, op: '>=', right: prev?.type === 'CMP' ? prev.right : '' };
  return { type, address: addr };
}

export function defaultOutput(type: OutputType, prev?: LadderOutput): LadderOutput {
  const addr = prev ? outputAddress(prev) : '';
  switch (type) {
    case 'OUT': case 'SET': case 'RST':
      return { type, address: addr };
    case 'TMR':
      return { type, address: addr, mode: 'ON_DELAY', preset: '', unit: 'sec', accumulate: false, resetAddress: null };
    case 'CNT':
      return { type, address: addr, direction: 'UP', preset: '', resetAddress: null };
    case 'COPY':
      return { type, source: '', dest: addr };
    case 'MATH':
      return { type, dest: addr, expression: '' };
    case 'RAW':
      return prev?.type === 'RAW' ? prev : { type, vendor: '', text: '' };
  }
}

/** An imported instruction's text in box lines (at most 4). */
export function rawLines(text: string, width = 22): string[] {
  const lines: string[] = [];
  for (let s = text.trim(); s && lines.length < 4; s = s.slice(width)) lines.push(s.length > width && lines.length === 3 ? `${s.slice(0, width - 1)}…` : s.slice(0, width));
  return lines.length ? lines : ['?'];
}

// ---------------------------------------------------------------- program edits
export function updateRung(p: LadderProgram, id: string, fn: (r: Rung) => Rung): LadderProgram {
  return { ...p, rungs: p.rungs.map((r) => (r.id === id ? fn(r) : r)) };
}

export function setElement(r: Rung, b: number, i: number, el: LadderElement): Rung {
  return { ...r, branches: r.branches.map((br, bi) => (bi === b ? br.map((e, ei) => (ei === i ? el : e)) : br)) };
}

export function deleteElement(r: Rung, b: number, i: number): Rung {
  const branches = r.branches
    .map((br, bi) => (bi === b ? br.filter((_, ei) => ei !== i) : br))
    .filter((br) => br.length > 0);
  return { ...r, branches };
}

export function addContact(r: Rung, b: number): Rung {
  const el: LadderElement = { type: 'NO', address: '' };
  if (r.branches.length === 0) return { ...r, branches: [[el]] };
  return { ...r, branches: r.branches.map((br, bi) => (bi === b ? [...br, el] : br)) };
}

export function addBranch(r: Rung): Rung {
  return { ...r, branches: [...r.branches, [{ type: 'NO', address: '' }]] };
}

export function setOutput(r: Rung, i: number, o: LadderOutput): Rung {
  return { ...r, outputs: r.outputs.map((x, xi) => (xi === i ? o : x)) };
}

export function deleteOutput(r: Rung, i: number): Rung {
  return { ...r, outputs: r.outputs.filter((_, xi) => xi !== i) };
}

export function addOutput(r: Rung, type: OutputType): Rung {
  return { ...r, outputs: [...r.outputs, defaultOutput(type)] };
}

export function moveRung(p: LadderProgram, id: string, delta: number): LadderProgram {
  const i = p.rungs.findIndex((r) => r.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= p.rungs.length) return p;
  const rungs = [...p.rungs];
  [rungs[i], rungs[j]] = [rungs[j], rungs[i]];
  return { ...p, rungs };
}

export function duplicateRung(p: LadderProgram, id: string): LadderProgram {
  const i = p.rungs.findIndex((r) => r.id === id);
  if (i < 0) return p;
  const copy: Rung = structuredClone(p.rungs[i]);
  copy.id = newRungId();
  return { ...p, rungs: [...p.rungs.slice(0, i + 1), copy, ...p.rungs.slice(i + 1)] };
}

export function deleteRung(p: LadderProgram, id: string): LadderProgram {
  return { ...p, rungs: p.rungs.filter((r) => r.id !== id) };
}

export function newRung(): Rung {
  return {
    id: newRungId(),
    comment: '',
    branches: [[{ type: 'NO', address: '' }]],
    outputs: [{ type: 'OUT', address: '' }],
  };
}

/** A new empty rung just above or below `id` (at the end when `id` is not found); returns the program and the new rung's id. */
export function insertRung(p: LadderProgram, id: string | null, where: 'above' | 'below'): { program: LadderProgram; id: string } {
  const r = newRung();
  const i = id ? p.rungs.findIndex((x) => x.id === id) : -1;
  // A rung inserted beside another joins its block.
  if (i >= 0 && p.rungs[i].block) r.block = p.rungs[i].block;
  const at = i < 0 ? p.rungs.length : where === 'above' ? i : i + 1;
  return { program: { ...p, rungs: [...p.rungs.slice(0, at), r, ...p.rungs.slice(at)] }, id: r.id };
}

/** A contact of `type` placed right after contact `i` of branch `b` (at the branch's end when `i` is null). */
export function insertContact(r: Rung, b: number, i: number | null, type: 'NO' | 'NC'): Rung {
  const el: LadderElement = { type, address: '' };
  if (r.branches.length === 0) return { ...r, branches: [[el]] };
  return { ...r, branches: r.branches.map((br, bi) => (bi === b ? (i === null ? [...br, el] : [...br.slice(0, i + 1), el, ...br.slice(i + 1)]) : br)) };
}
