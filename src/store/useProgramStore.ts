import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProgramStore {
  projectName: string;
  setProjectName: (name: string) => void;
  generatedCode: string;
  setGeneratedCode: (code: string) => void;
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
      setProjectName: (name) => set({ projectName: name }),
      generatedCode: '',
      setGeneratedCode: (code) =>
        set({ generatedCode: code, lastGeneratedAt: new Date().toISOString() }),
      userPrompt: '',
      setUserPrompt: (prompt) => set({ userPrompt: prompt }),
      isGenerating: false,
      setIsGenerating: (v) => set({ isGenerating: v }),
      lastGeneratedAt: null,
      clearProgram: () => set({ generatedCode: '', lastGeneratedAt: null }),
    }),
    { name: 'plc-program-store' }
  )
);
