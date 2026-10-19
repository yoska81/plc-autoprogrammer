import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { EMPTY_PROGRAM, type LadderProgram } from '../plc/core/ladder';
import { keepRungComments } from '../edits/rungComments';
import { appPersistStorage } from '../lib/appStorage';

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
  /** Shown on the proposal banner: why the rules wrote it and whether it replaces one that was waiting. */
  note?: string;
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
  /**
   * Who made the program as it stands: 'app' = generated here and not changed by hand since (Update all may rebuild
   * it, keeping a version); 'user' = edited, imported, restored or recovered (Update all only proposes). Absent on
   * older projects: treated as 'user'.
   */
  ladderOrigin?: 'app' | 'user';
  /** The file the program was read from (Upgrade, a printout), while it is still that program; else absent. */
  ladderSource?: string;
  /** Replace the program with a fresh generation (origin 'user' for a program read from a file or recovered). */
  setGeneratedLadder: (program: LadderProgram, explanation: string, reasoning: string | null, origin?: 'app' | 'user', source?: string) => void;
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
      setGeneratedLadder: (program, explanation, reasoning, origin = 'app', source) =>
        set((s) => ({
          ladderOrigin: origin,
          ladderSource: source,
          versions: snapshot(s.versions, s.ladder, 'Before new generation'),
          // Rung comments the user rewrote stay (rungs keep their ids).
          ladder: keepRungComments(program),
          reasoning,
          proposal: null,
          lastGeneratedAt: now(),
          // A new generation starts a new fix-it conversation.
          chat: [{ role: 'assistant', text: explanation, at: now(), outcome: 'applied' }],
        })),
      // Every hand edit (the editor's history.edit, undo / redo included): the user's. Undo back to the generated
      // program stays 'user' on purpose (the app cannot tell the user meant to undo everything).
      editLadder: (ladder) => set({ ladder, ladderOrigin: 'user' }),
      saveVersion: (label) => set((s) => ({ versions: snapshot(s.versions, s.ladder, label) })),
      restoreVersion: (id) =>
        set((s) => {
          const v = s.versions.find((x) => x.id === id);
          if (!v) return {};
          return { versions: snapshot(s.versions, s.ladder, 'Before restore'), ladder: v.program, proposal: null, ladderOrigin: 'user', ladderSource: undefined };
        }),
      addChat: (msg) => set((s) => ({ chat: [...s.chat, { ...msg, at: now() }] })),
      setProposal: (proposal) => set({ proposal }),
      applyProposal: () =>
        set((s) => {
          if (!s.proposal) return {};
          return {
            versions: snapshot(s.versions, s.ladder, 'Before AI change'),
            ladder: keepRungComments(s.proposal.program),
            reasoning: s.proposal.reasoning,
            proposal: null,
            // A change the user asked for (Change tab, checker fix, block rewrite) makes the program theirs; an Update
            // all proposal (specUpdate) leaves the origin as it was.
            ladderOrigin: s.proposal.specUpdate ? s.ladderOrigin : 'user',
            chat: markLastAssistant(s.chat, 'applied'),
          };
        }),
      rejectProposal: () => set((s) => ({ proposal: null, chat: markLastAssistant(s.chat, 'rejected') })),
      clearLadder: () =>
        set((s) => ({ versions: snapshot(s.versions, s.ladder, 'Before clear'), ladder: EMPTY_PROGRAM, chat: [], proposal: null, ladderOrigin: undefined, ladderSource: undefined })),
    }),
    {
      name: 'plc-program-store',
      storage: appPersistStorage(),
      // A generation in flight can't survive a reload; don't persist the flag.
      partialize: (s) => ({
        projectName: s.projectName,
        userPrompt: s.userPrompt,
        lastGeneratedAt: s.lastGeneratedAt,
        generatedCode: s.generatedCode,
        reasoning: s.reasoning,
        ladder: s.ladder,
        ladderOrigin: s.ladderOrigin,
        ladderSource: s.ladderSource,
        versions: s.versions,
        chat: s.chat,
        proposal: s.proposal,
      }),
    }
  )
);

/**
 * The question before "Build program from my project" replaces a program. A program read from a file says what is
 * replaced and where it stays; one the app made keeps the short question.
 */
export function replaceProgramQuestion(s: Pick<ProgramStore, 'ladder' | 'ladderSource'>): string {
  return s.ladderSource
    ? `Replace the program read from ${s.ladderSource} (${s.ladder.rungs.length} rungs) with a new one built from the description? The imported program stays in History (Restore).`
    : 'Build a new program from your project? (The current one is kept in History.)';
}
