import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { EMPTY_SECTIONS, type SpecDocument, type SpecSectionId, type SpecSections } from '../spec/types';

interface SpecStore {
  sections: SpecSections;
  setSection: (id: SpecSectionId, text: string) => void;
  setSections: (sections: SpecSections) => void;
  /** Uploaded spec documents (names only; contents are processed into sections). */
  documents: SpecDocument[];
  addDocument: (name: string) => void;
  /** Open questions the AI found missing from the spec. */
  questions: string[];
  setQuestions: (q: string[]) => void;
}

export const useSpecStore = create<SpecStore>()(
  persist(
    (set) => ({
      sections: EMPTY_SECTIONS,
      setSection: (id, text) => set((s) => ({ sections: { ...s.sections, [id]: text } })),
      setSections: (sections) => set({ sections: { ...EMPTY_SECTIONS, ...sections } }),
      documents: [],
      addDocument: (name) => set((s) => ({ documents: [...s.documents, { name, addedAt: new Date().toISOString() }] })),
      questions: [],
      setQuestions: (questions) => set({ questions }),
    }),
    { name: 'plc-spec-store' }
  )
);
