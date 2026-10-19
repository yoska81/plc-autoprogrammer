import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { appPersistStorage } from '../lib/appStorage';

/**
 * Values the user typed over generated ones ("edited by you"). Part of the project data (saved per
 * project, in backups and in .isap files). Every entry is keyed by something that stays the same when
 * the design is generated again (part number, label id, cable tag, finding id, rung id …), so a
 * regeneration keeps the user's values; "back to generated" deletes the entry.
 */

/** Order-list line typed over by the user; keyed by the generated part number. */
export interface BomEdit {
  partNumber?: string;
  description?: string;
  /** Selling units to order. */
  qty?: number;
  /** Unit price (USD). */
  price?: number;
}

/** Label text typed over by the user; keyed by the label id (src/electrical/labels/list.ts). */
export interface LabelEdit {
  code?: string;
  description?: string;
}

/** A generated text the user rewrote: what they typed and what was generated when they first changed it. */
export interface TextEdit {
  value: string;
  generated: string;
  at: string;
}

interface EditsStore {
  bom: Record<string, BomEdit>;
  labels: Record<string, LabelEdit>;
  /** Notes the user added to generated rows: 'cable:W001', 'wire:…', 'review:<finding id>'. */
  notes: Record<string, string>;
  /** Generated texts the user rewrote: 'machineSpec', 'rung:<id>', 'io:<id>'. */
  texts: Record<string, TextEdit>;
  setBom: (partNumber: string, patch: BomEdit) => void;
  /** Back to the generated value: one field, or the whole line. */
  resetBom: (partNumber: string, field?: keyof BomEdit) => void;
  setLabel: (id: string, patch: LabelEdit) => void;
  resetLabel: (id: string, field?: keyof LabelEdit) => void;
  setNote: (key: string, note: string) => void;
  /** Record a rewritten text; typing the generated text again removes the edit. */
  setText: (key: string, value: string, generated: string) => void;
  resetText: (key: string) => void;
  /** Drop every text edit whose key starts with `prefix` (e.g. a list that was replaced). */
  clearTexts: (prefix: string) => void;
}

const without = <T,>(rec: Record<string, T>, key: string): Record<string, T> => {
  if (!(key in rec)) return rec;
  const out = { ...rec };
  delete out[key];
  return out;
};

/** Drop undefined / empty fields; null when nothing is left. */
function tidy<T extends object>(o: T): T | null {
  const out = Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && !(typeof v === 'number' && !Number.isFinite(v)))) as T;
  return Object.keys(out).length ? out : null;
}

export const useEditsStore = create<EditsStore>()(
  persist(
    (set) => ({
      bom: {},
      labels: {},
      notes: {},
      texts: {},
      setBom: (pn, patch) => set((s) => {
        const next = tidy({ ...s.bom[pn], ...patch });
        return { bom: next ? { ...s.bom, [pn]: next } : without(s.bom, pn) };
      }),
      resetBom: (pn, field) => set((s) => {
        if (!field) return { bom: without(s.bom, pn) };
        const next = tidy({ ...s.bom[pn], [field]: undefined });
        return { bom: next ? { ...s.bom, [pn]: next } : without(s.bom, pn) };
      }),
      setLabel: (id, patch) => set((s) => {
        const next = tidy({ ...s.labels[id], ...patch });
        return { labels: next ? { ...s.labels, [id]: next } : without(s.labels, id) };
      }),
      resetLabel: (id, field) => set((s) => {
        if (!field) return { labels: without(s.labels, id) };
        const next = tidy({ ...s.labels[id], [field]: undefined });
        return { labels: next ? { ...s.labels, [id]: next } : without(s.labels, id) };
      }),
      setNote: (key, note) => set((s) => ({ notes: note.trim() ? { ...s.notes, [key]: note } : without(s.notes, key) })),
      setText: (key, value, generated) => set((s) => {
        const was = s.texts[key];
        const gen = was ? was.generated : generated;
        if (value === gen) return { texts: without(s.texts, key) };
        return { texts: { ...s.texts, [key]: { value, generated: gen, at: new Date().toISOString() } } };
      }),
      resetText: (key) => set((s) => ({ texts: without(s.texts, key) })),
      clearTexts: (prefix) => set((s) => {
        const keys = Object.keys(s.texts).filter((k) => k.startsWith(prefix));
        if (!keys.length) return {};
        const texts = { ...s.texts };
        for (const k of keys) delete texts[k];
        return { texts };
      }),
    }),
    { name: 'plc-edits-store', storage: appPersistStorage(), partialize: (s) => ({ bom: s.bom, labels: s.labels, notes: s.notes, texts: s.texts }) },
  ),
);

/** Key of the full machine specification text (Deliverables page). */
export const MACHINE_SPEC_KEY = 'machineSpec';

/** The user's text when they rewrote it, else the generated one. */
export function textOr(key: string, generated: string): string {
  return useEditsStore.getState().texts[key]?.value ?? generated;
}

/** All hand edits of the open project (for non-React callers: exports, the order list). */
export function currentEdits(): Pick<EditsStore, 'bom' | 'labels' | 'notes' | 'texts'> {
  const { bom, labels, notes, texts } = useEditsStore.getState();
  return { bom, labels, notes, texts };
}
