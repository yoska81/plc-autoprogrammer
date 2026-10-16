import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { EMPTY_PROGRAM, type LadderProgram } from '../plc/ladder';

export interface ProgramVersion {
  id: string;
  at: string;
  label: string;
  program: LadderProgram;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  at: string;
  /** Outcome of an AI proposal shown under the assistant message. */
  outcome?: 'applied' | 'rejected' | 'no-change';
}

export interface Proposal {
  program: LadderProgram;
  explanation: string;
  reasoning: string | null;
  /** Made to follow a spec/I/O/HMI change; approving it brings the program up to date. */
  specUpdate?: boolean;
}

const MAX_VERSIONS = 50;
const now = () => new Date().toISOString();

interface ProgramStore {
  projectName: string;
  setProjectName: (name: string) => void;
  userPrompt: string;
  setUserPrompt: (prompt: string) => void;
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
  lastGeneratedAt: string | null;

  // ── Structured Text (text-language PLCs) ──
  generatedCode: string;
  reasoning: string | null;
  setGeneratedResult: (code: string, reasoning: string | null) => void;
  updateCode: (code: string) => void;
  clearProgram: () => void;

  // ── Ladder (CLICK and other ladder PLCs) ──
  ladder: LadderProgram;
  /** Snapshots taken before every AI change and on request; newest last. */
  versions: ProgramVersion[];
  chat: ChatMessage[];
  proposal: Proposal | null;
  /** Replace the program with a fresh AI generation. */
  setGeneratedLadder: (program: LadderProgram, explanation: string, reasoning: string | null) => void;
  /** Manual edit from the ladder editor. */
  editLadder: (program: LadderProgram) => void;
  saveVersion: (label: string) => void;
  restoreVersion: (id: string) => void;
  addChat: (msg: Omit<ChatMessage, 'at'>) => void;
  setProposal: (p: Proposal | null) => void;
  applyProposal: () => void;
  rejectProposal: () => void;
  clearLadder: () => void;
}

function snapshot(versions: ProgramVersion[], program: LadderProgram, label: string): ProgramVersion[] {
  if (!program.rungs.length) return versions;
  const v = { id: `v_${Date.now().toString(36)}`, at: now(), label, program };
  return [...versions, v].slice(-MAX_VERSIONS);
}

function markLastAssistant(chat: ChatMessage[], outcome: ChatMessage['outcome']): ChatMessage[] {
  const i = chat.map((m) => m.role).lastIndexOf('assistant');
  return i < 0 ? chat : chat.map((m, j) => (j === i ? { ...m, outcome } : m));
}

export const useProgramStore = create<ProgramStore>()(
  persist(
    (set) => ({
      projectName: 'My PLC Project',
      setProjectName: (projectName) => set({ projectName }),
      userPrompt: '',
      setUserPrompt: (userPrompt) => set({ userPrompt }),
      isGenerating: false,
      setIsGenerating: (isGenerating) => set({ isGenerating }),
      lastGeneratedAt: null,

      generatedCode: '',
      reasoning: null,
      setGeneratedResult: (generatedCode, reasoning) => set({ generatedCode, reasoning, lastGeneratedAt: now() }),
      updateCode: (generatedCode) => set({ generatedCode }),
      clearProgram: () => set({ generatedCode: '', reasoning: null, lastGeneratedAt: null }),

      ladder: EMPTY_PROGRAM,
      versions: [],
      chat: [],
      proposal: null,
      setGeneratedLadder: (program, explanation, reasoning) =>
        set((s) => ({
          versions: snapshot(s.versions, s.ladder, 'Before new generation'),
          ladder: program,
          reasoning,
          proposal: null,
          lastGeneratedAt: now(),
          // A new generation starts a new fix-it conversation.
          chat: [{ role: 'assistant', text: explanation, at: now(), outcome: 'applied' }],
        })),
      editLadder: (ladder) => set({ ladder }),
      saveVersion: (label) => set((s) => ({ versions: snapshot(s.versions, s.ladder, label) })),
      restoreVersion: (id) =>
        set((s) => {
          const v = s.versions.find((x) => x.id === id);
          if (!v) return {};
          return { versions: snapshot(s.versions, s.ladder, 'Before restore'), ladder: v.program, proposal: null };
        }),
      addChat: (msg) => set((s) => ({ chat: [...s.chat, { ...msg, at: now() }] })),
      setProposal: (proposal) => set({ proposal }),
      applyProposal: () =>
        set((s) => {
          if (!s.proposal) return {};
          return {
            versions: snapshot(s.versions, s.ladder, 'Before AI change'),
            ladder: s.proposal.program,
            reasoning: s.proposal.reasoning,
            proposal: null,
            chat: markLastAssistant(s.chat, 'applied'),
          };
        }),
      rejectProposal: () => set((s) => ({ proposal: null, chat: markLastAssistant(s.chat, 'rejected') })),
      clearLadder: () =>
        set((s) => ({ versions: snapshot(s.versions, s.ladder, 'Before clear'), ladder: EMPTY_PROGRAM, chat: [], proposal: null })),
    }),
    {
      name: 'plc-program-store',
      // A generation in flight can't survive a reload; don't persist the flag.
      partialize: (s) => ({
        projectName: s.projectName,
        userPrompt: s.userPrompt,
        lastGeneratedAt: s.lastGeneratedAt,
        generatedCode: s.generatedCode,
        reasoning: s.reasoning,
        ladder: s.ladder,
        versions: s.versions,
        chat: s.chat,
        proposal: s.proposal,
      }),
    }
  )
);
