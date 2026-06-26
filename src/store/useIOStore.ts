import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IOPoint, IOCategory, TemplatePoint } from '../types/io';

interface IOStore {
  projectIO: IOPoint[];
  addBlankInput: () => void;
  addBlankOutput: () => void;
  importFromTemplate: (templates: TemplatePoint[]) => void;
  updateDescription: (id: string, description: string) => void;
  updateCategory: (id: string, category: IOCategory) => void;
  deletePoint: (id: string) => void;
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
              { id, description: t.description, type: t.type, category: t.category },
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

      deletePoint: (id: string) => {
        set((s) => ({ projectIO: s.projectIO.filter((p) => p.id !== id) }));
      },
    }),
    { name: 'plc-io-store' }
  )
);
