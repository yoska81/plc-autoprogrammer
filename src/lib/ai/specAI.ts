import type Anthropic from '@anthropic-ai/sdk';
import type { Effort } from '../../store/useSettingsStore';
import { SPEC_SECTIONS, type SpecSections } from '../../spec/types';
import { callClaude } from './anthropic';
import { fileToBlock } from './importAI';

/** Turn an uploaded spec file into something Claude can read. */
async function specFileToBlocks(file: File): Promise<Anthropic.Beta.Messages.BetaContentBlockParam[]> {
  const name = file.name.toLowerCase();
  if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
    return [await fileToBlock(file), { type: 'text', text: `(above: ${file.name})` }];
  }
  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth');
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return [{ type: 'text', text: `Document "${file.name}":\n${value}` }];
  }
  if (name.endsWith('.doc')) throw new Error(`${file.name}: old .doc files can't be read. Save it as .docx or PDF.`);
  // Plain text, Markdown, CSV and similar.
  return [{ type: 'text', text: `Document "${file.name}":\n${await file.text()}` }];
}

const SCHEMA = {
  type: 'object',
  properties: {
    sections: {
      type: 'object',
      properties: Object.fromEntries(SPEC_SECTIONS.map((s) => [s.id, { type: 'string' }])),
      required: SPEC_SECTIONS.map((s) => s.id),
      additionalProperties: false,
    },
    questions: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['sections', 'questions', 'summary'],
  additionalProperties: false,
};

const SYSTEM = `You are a senior controls engineer writing the functional specification for an industrial machine with the customer. The spec drives everything that follows: the I/O list, electrical design, HMI and PLC program.

Organize all the information you are given into these sections:
${SPEC_SECTIONS.map((s) => `- ${s.id} (${s.title}): ${s.hint}`).join('\n')}

Rules:
- Keep every fact, number, name and requirement from the current spec and the new material. Never drop details. When new material contradicts the current spec, use the new material and mention the change in "summary".
- Write in clear, short engineering sentences or bullet lines ("- "). Keep the customer's terms and device names.
- Leave a section as an empty string when nothing is known about it. Do not invent requirements.
- Write the facts the design steps need explicitly, one per line, whenever the material gives them: every motor (name, HP, voltage, starter / VFD / servo), every sensor and actuator (what it detects or moves), every safety device and exactly what it must stop (per zone when there are several, e.g. "Light curtain at pallet position 1 stops the robot only while it works at position 1"), every analog signal with its range (e.g. "Tank level transmitter 4-20 mA, 0–500 gal"), every interface to other equipment (robot, other machine: each handshake signal and its direction), recipes (how many, which values), and the supply voltage and country.
- "questions": the specific missing information an engineer needs before designing (e.g. "How is the lift axis homed: home switch or hard stop?", "What stop category for the guard door?"). Max 12, most important first. Never repeat a question that is already answered in "Questions already answered".
- "summary": two or three sentences on what you organized and what changed.`;

export async function organizeSpec(opts: {
  apiKey: string; model: string; effort: Effort; signal?: AbortSignal;
  current: SpecSections;
  /** Free text the user typed or pasted. */
  newText: string;
  files: File[];
}): Promise<{ sections: SpecSections; questions: string[]; summary: string; reasoning: string | null }> {
  const fileBlocks = (await Promise.all(opts.files.map(specFileToBlocks))).flat();
  const current = SPEC_SECTIONS.map((s) => `### ${s.id}\n${opts.current[s.id]?.trim() || '(empty)'}`).join('\n\n');
  // The project's questions and answers (part of the spec, kept outside the sections).
  const qa = opts.current.qa?.trim() ? `\n\nQuestions already answered by the customer (use these answers; do not ask these questions again):\n${opts.current.qa.trim()}` : '';
  const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = [
    ...fileBlocks,
    { type: 'text', text: `Current spec:\n${current}${qa}\n\n${opts.newText.trim() ? `New information from the engineer:\n${opts.newText}\n\n` : ''}${fileBlocks.length ? 'Merge the attached documents into the spec.' : 'Merge the new information into the spec.'}` },
  ];
  const { text, reasoning } = await callClaude({
    apiKey: opts.apiKey, model: opts.model, effort: opts.effort, signal: opts.signal,
    system: SYSTEM, messages: [{ role: 'user', content }], schema: SCHEMA,
  });
  try {
    const parsed = JSON.parse(text) as { sections: SpecSections; questions: string[]; summary: string };
    return { ...parsed, reasoning };
  } catch (err) {
    throw new Error('The AI returned a spec the app could not read. Please try again.', { cause: err });
  }
}
