import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProgramStore {
  projectName: string;
  setProjectName: (name: string) => void;
  generatedCode: string;
  /** Store a fresh AI result (stamps the generation time). */
  setGeneratedResult: (code: string, reasoning: string | null) => void;
  /** Manual edits in the editor (does not change the generation time). */
  updateCode: (code: string) => void;
  reasoning: string | null;
  userPrompt: string;
  setUserPrompt: (prompt: string) => void;
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
  lastGeneratedAt: string | null;
  clearProgram: () => void;
}

export const useProgramStore = create<ProgramStore>()(
  persist(
    (set) => ({
      projectName: 'My PLC Project',
      setProjectName: (projectName) => set({ projectName }),
      generatedCode: '',
      setGeneratedResult: (generatedCode, reasoning) =>
        set({ generatedCode, reasoning, lastGeneratedAt: new Date().toISOString() }),
      updateCode: (generatedCode) => set({ generatedCode }),
      reasoning: null,
      userPrompt: '',
      setUserPrompt: (userPrompt) => set({ userPrompt }),
      isGenerating: false,
      setIsGenerating: (isGenerating) => set({ isGenerating }),
      lastGeneratedAt: null,
      clearProgram: () => set({ generatedCode: '', reasoning: null, lastGeneratedAt: null }),
    }),
    {
      name: 'plc-program-store',
      // A generation in flight can't survive a reload; don't persist the flag.
      partialize: (s) => ({
        projectName: s.projectName,
        generatedCode: s.generatedCode,
        reasoning: s.reasoning,
        userPrompt: s.userPrompt,
        lastGeneratedAt: s.lastGeneratedAt,
      }),
    }
  )
);
