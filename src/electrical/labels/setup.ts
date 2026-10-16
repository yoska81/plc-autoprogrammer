import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LabelContent, LabelKind } from '../labels';
import { supplyByPart } from './printers';

/**
 * Label stock and print setup. Sizes are in millimetres. A "tape" preset is
 * continuous tape: its height is the tape width and the length is worked out
 * from the text (or fixed when the user types a length).
 */

export interface LabelSize {
  id: string;
  name: string;
  /** Label width (along the text) in mm; 0 for continuous tape with automatic length. */
  w: number;
  /** Label height in mm (for tape: the tape width). */
  h: number;
  tape?: boolean;
  /** Printable area when smaller than the label, mm from the top-left corner. */
  printable?: { x: number; y: number; w: number; h: number };
  /** What it is typically used for / which printers take it. */
  use: string;
}

export const SIZE_PRESETS: LabelSize[] = [
  { id: '12x6', name: '12 x 6 mm', w: 12, h: 6, use: 'Generic size: small wire marker or terminal marker' },
  { id: '15x5', name: '15 x 5 mm', w: 15, h: 5, use: 'Generic size: terminal block marker (5 mm terminal pitch)' },
  { id: '25x10', name: '25 x 10 mm', w: 25, h: 10, use: 'Generic size: wire marker or small device tag' },
  { id: '38x12', name: '38 x 12 mm', w: 38, h: 12, use: 'Generic size: device tag on DIN-rail parts' },
  { id: '50x12', name: '50 x 12 mm', w: 50, h: 12, use: 'Generic size: device tag with description, cable tag' },
  { id: '60x25', name: '60 x 25 mm', w: 60, h: 25, use: 'Generic size: field device or junction box tag' },
  { id: '70x30', name: '70 x 30 mm', w: 70, h: 30, use: 'Generic size: door legend plate or equipment nameplate' },
  { id: 'tape12', name: '12 mm tape, auto length', w: 0, h: 12, tape: true, use: 'Generic 12 mm continuous tape; length follows the text' },
  { id: 'tape18', name: '18 mm tape, auto length', w: 0, h: 18, tape: true, use: 'Generic 18 mm continuous tape; length follows the text' },
  { id: 'tape24', name: '24 mm tape, auto length', w: 0, h: 24, tape: true, use: 'Generic 24 mm continuous tape; length follows the text' },
  { id: 'custom', name: 'Custom size…', w: 40, h: 15, use: 'Type the width and height of your label stock' },
];

/** Suggested stock for each kind of label (used when the user picks "Suggested sizes"). */
export const SUGGESTED_SIZE: Record<LabelKind, string> = {
  wire: '25x10', terminal: '12x6', device: '38x12', field: '60x25', cable: '50x12', legend: '70x30',
};

export type Orientation = 'horizontal' | 'vertical';
export type Units = 'mm' | 'in';
export type Paper = 'letter' | 'a4';

export interface LabelSetup {
  /** Chosen label printer ('' = none / generic sizes). */
  printerId: string;
  /** Chosen printer supply part number; when set it decides the label size. */
  supply: string;
  sizeId: string;
  /** Custom width / height in mm (used when sizeId is 'custom'). */
  customW: number;
  customH: number;
  /** Fixed tape length in mm; 0 = automatic. */
  tapeLength: number;
  units: Units;
  content: LabelContent;
  border: boolean;
  orientation: Orientation;
  /** Print each label as many times as its copies count. */
  useCopies: boolean;
  paper: Paper;
  /** Exports: one row per copy instead of one row with a count. */
  rowPerCopy: boolean;
  /** Label-printer PDF: one label per page, or a full liner row (N across) per page. */
  pageLayout: 'single' | 'roll';
}

export const DEFAULT_SETUP: LabelSetup = {
  printerId: '', supply: '', sizeId: '38x12', customW: 40, customH: 15, tapeLength: 0, units: 'mm',
  content: 'code', border: false, orientation: 'horizontal', useCopies: true, paper: 'letter', rowPerCopy: false, pageLayout: 'single',
};

interface SetupStore {
  /** Setup of each project, by project id. */
  byProject: Record<string, LabelSetup>;
  /** Last setup used anywhere: the starting point for a project without its own. */
  last: LabelSetup;
  set: (projectId: string | null, patch: Partial<LabelSetup>) => void;
}

/** Remembered per project; a new project starts with the printer and stock used last. */
export const useLabelSetupStore = create<SetupStore>()(
  persist(
    (set) => ({
      byProject: {},
      last: DEFAULT_SETUP,
      set: (projectId, patch) => set((s) => {
        const next = { ...(projectId ? s.byProject[projectId] ?? s.last : s.last), ...patch };
        return { last: next, byProject: projectId ? { ...s.byProject, [projectId]: next } : s.byProject };
      }),
    }),
    {
      name: 'isa-label-setup',
      version: 1,
      // Version 0 stored a single { setup }.
      migrate: (old, v) => (v === 0 ? { byProject: {}, last: { ...DEFAULT_SETUP, ...((old as { setup?: Partial<LabelSetup> })?.setup ?? {}) } } : old) as SetupStore,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SetupStore>;
        const fill = (x?: Partial<LabelSetup>) => ({ ...DEFAULT_SETUP, ...(x ?? {}) });
        return { ...current, last: fill(p.last), byProject: Object.fromEntries(Object.entries(p.byProject ?? {}).map(([k, v]) => [k, fill(v)])) };
      },
    },
  ),
);

/** Setup for a project (non-React callers, e.g. the ZIP). */
export function labelSetupFor(projectId: string | null): LabelSetup {
  const s = useLabelSetupStore.getState();
  return (projectId && s.byProject[projectId]) || s.last;
}

export const MM_PER_IN = 25.4;

export function sizeOf(setup: LabelSetup): LabelSize {
  const sup = setup.supply ? supplyByPart(setup.supply) : undefined;
  if (sup) {
    const base = { id: `supply:${sup.partNumber}`, name: sup.partNumber, h: sup.heightMm, use: `${sup.brand} ${sup.partNumber}: ${sup.material}, ${sup.color}` };
    if (sup.continuous) {
      const w = setup.tapeLength > 0 ? setup.tapeLength : 0;
      // Self-laminating tape: only the band is printed; w 0 here means "the whole length".
      return { ...base, w, tape: true, printable: sup.band ? { x: 0, y: sup.band.y, w: 0, h: sup.band.h } : undefined };
    }
    return { ...base, w: sup.widthMm, printable: sup.printable };
  }
  const p = SIZE_PRESETS.find((s) => s.id === setup.sizeId) ?? SIZE_PRESETS[0];
  if (p.id === 'custom') return { ...p, w: Math.max(3, setup.customW), h: Math.max(3, setup.customH) };
  if (p.tape && setup.tapeLength > 0) return { ...p, w: setup.tapeLength };
  return p;
}

/** Liner row for a "match the roll" PDF, or null when the supply has no confirmed liner data. */
export function rollOf(setup: LabelSetup): { across: number; widthMm: number; gapMm: number; marginMm: number } | null {
  const sup = setup.supply ? supplyByPart(setup.supply) : undefined;
  if (!sup?.liner || !sup.across || sup.across < 2 || sup.continuous) return null;
  return { across: sup.across, widthMm: sup.liner.widthMm, gapMm: sup.liner.gapMm, marginMm: sup.liner.marginMm };
}

/** "38 x 12 mm" or "1.50 x 0.47 in" */
export function fmtSize(w: number, h: number, units: Units): string {
  if (units === 'in') return `${(w / MM_PER_IN).toFixed(2)} x ${(h / MM_PER_IN).toFixed(2)} in`;
  return `${+w.toFixed(1)} x ${+h.toFixed(1)} mm`;
}
