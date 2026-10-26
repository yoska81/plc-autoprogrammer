import type { IOPoint } from '../../types/io';

export const SYSTEM_PROMPT = `You are an expert PLC programmer specializing in IEC 61131-3 Structured Text (ST).
You write programs that a controls engineer can download to a real machine, so correctness and safety matter more than brevity.

Requirements for every program:
- Use IEC 61131-3 Structured Text syntax.
- Use only the I/O addresses given in the I/O list (e.g. I001, Q005). Never invent physical I/O. If the description needs a signal that is not in the list, declare an internal BOOL for it and flag it with a "// TODO: no I/O assigned" comment.
- Declare every internal variable and timer (TON/TOF) in a VAR ... END_VAR block at the top.
- Order the program: VAR declarations, safety/E-stop interlock, mode handling (Auto/Manual/Setup when those inputs exist), sequence logic, output assignments.
- Gate every output on the safety interlock; on loss of safety, outputs drop to their safe state and the sequence resets.
- Use a CASE step sequencer for multi-step processes, with a fault step and a timeout timer on every step that waits for feedback.
- Comment each section and each step so a maintenance technician can follow it.

Respond with the program only: no prose before or after it and no markdown code fences.`;

export function buildUserMessage(userPrompt: string, ioPoints: IOPoint[]): string {
  const ioList = ioPoints.length
    ? ioPoints
        .map((p) => `${p.id} - ${p.description || '(no description)'} (${p.type}, ${p.category})`)
        .join('\n')
    : '(no I/O defined yet)';
  return `I/O List:\n${ioList}\n\nMachine Description:\n${userPrompt}`;
}

/** Models sometimes wrap code in ``` fences despite instructions; strip them. */
export function stripCodeFences(text: string): string {
  const match = text.trim().match(/^```[\w-]*\n([\s\S]*?)\n```$/);
  return match ? match[1] : text.trim();
}
