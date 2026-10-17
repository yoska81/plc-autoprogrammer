import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AnalogSpec, IOPoint, IOCategory, TemplatePoint } from '../types/io';
import { useEditsStore } from '../edits/useEditsStore';

interface IOStore {
  projectIO: IOPoint[];
  addBlankInput: () => void;
  addBlankOutput: () => void;
  importFromTemplate: (templates: TemplatePoint[]) => void;
  updateDescription: (id: string, description: string) => void;
  updateCategory: (id: string, category: IOCategory) => void;
  deletePoint: (id: string) => void;
  /** Manual PLC address override; empty string = automatic. */
  setPlcAddress: (id: string, address: string) => void;
  /** Make a point analog (with its range and scaling) or discrete again (null). */
  setAnalog: (id: string, analog: AnalogSpec | null) => void;
  /** Add points read from an existing machine; replace=true clears the list first. */
  importPoints: (points: Omit<IOPoint, 'id'>[], replace: boolean) => void;
  /** Apply a reviewed AI I/O update: update kept points, add new ones, remove dropped ones. */
  applyIOUpdate: (kept: Pick<IOPoint, 'id' | 'category' | 'deviceType' | 'signal' | 'analog'>[], added: Omit<IOPoint, 'id'>[], removedIds: string[]) => void;
}

function nextInputId(existing: IOPoint[]): string {
  const usedNums = existing
    .filter((p) => p.type === 'input')
    .map((p) => parseInt(p.id.slice(1), 10))
    .filter((n) => !isNaN(n));
  let n = 1;
  while (usedNums.includes(n)) n++;
  return `I${String(n).padStart(3, '0')}`;
}

function nextOutputId(existing: IOPoint[]): string {
  const usedNums = existing
    .filter((p) => p.type === 'output')
    .map((p) => parseInt(p.id.slice(1), 10))
    .filter((n) => !isNaN(n));
  let n = 1;
  while (usedNums.includes(n)) n++;
  return `Q${String(n).padStart(3, '0')}`;
}

export const useIOStore = create<IOStore>()(
  persist(
    (set, get) => ({
      projectIO: [],

      addBlankInput: () => {
        const id = nextInputId(get().projectIO);
        set((s) => ({
          projectIO: [
            ...s.projectIO,
            { id, description: '', type: 'input', category: 'Spare' },
          ],
        }));
      },

      addBlankOutput: () => {
        const id = nextOutputId(get().projectIO);
        set((s) => ({
          projectIO: [
            ...s.projectIO,
            { id, description: '', type: 'output', category: 'Spare' },
          ],
        }));
      },

      importFromTemplate: (templates: TemplatePoint[]) => {
        set((s) => {
          let current = [...s.projectIO];
          for (const t of templates) {
            const id =
              t.type === 'input' ? nextInputId(current) : nextOutputId(current);
            current = [
              ...current,
              { id, description: t.description, type: t.type, category: t.category, templateId: t.templateId },
            ];
          }
          return { projectIO: current };
        });
      },

      updateDescription: (id: string, description: string) => {
        set((s) => ({
          projectIO: s.projectIO.map((p) =>
            p.id === id ? { ...p, description } : p
          ),
        }));
      },

      updateCategory: (id: string, category: IOCategory) => {
        set((s) => ({
          projectIO: s.projectIO.map((p) =>
            p.id === id ? { ...p, category } : p
          ),
        }));
      },

      setAnalog: (id, analog) => set((s) => ({
        projectIO: s.projectIO.map((p) => {
          if (p.id !== id) return p;
          if (!analog) { const { analog: _a, signal: _s, ...rest } = p; void _a; void _s; return rest; }
          return { ...p, signal: 'analog' as const, analog, plcAddress: p.plcAddress?.toUpperCase().startsWith('DF') ? p.plcAddress : undefined };
        }),
      })),

      setPlcAddress: (id: string, address: string) => {
        const plcAddress = address.trim().toUpperCase();
        set((s) => ({
          projectIO: s.projectIO.map((p) => (p.id === id ? { ...p, plcAddress } : p)),
        }));
      },

      importPoints: (points, replace) => {
        // A new list: description edits of the old points no longer apply.
        if (replace) useEditsStore.getState().clearTexts('io:');
        set((s) => {
          let current = replace ? [] : [...s.projectIO];
          for (const p of points) {
            const id = p.type === 'input' ? nextInputId(current) : nextOutputId(current);
            current = [...current, { ...p, id }];
          }
          return { projectIO: current };
        });
      },

      applyIOUpdate: (kept, added, removedIds) => {
        // Kept points keep their (hand-edited) descriptions; dropped points drop their edits.
        for (const id of removedIds) useEditsStore.getState().resetText(`io:${id}`);
        set((s) => {
          const keptById = new Map(kept.map((k) => [k.id, k]));
          const removed = new Set(removedIds);
          let current = s.projectIO
            .filter((p) => !removed.has(p.id))
            .map((p) => (keptById.has(p.id) ? { ...p, ...keptById.get(p.id) } : p));
          for (const p of added) {
            const id = p.type === 'input' ? nextInputId(current) : nextOutputId(current);
            current = [...current, { ...p, id }];
          }
          return { projectIO: current };
        });
      },

      deletePoint: (id: string) => {
        useEditsStore.getState().resetText(`io:${id}`);
        set((s) => ({ projectIO: s.projectIO.filter((p) => p.id !== id) }));
      },
    }),
    { name: 'plc-io-store' }
  )
);
