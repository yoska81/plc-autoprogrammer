/** Stages the harness runs and scores, and how a request's system prompt maps to one. */
export const STAGES = ['spec', 'equipment', 'io', 'electrical', 'hmi', 'program'] as const;
export type Stage = (typeof STAGES)[number] | 'review' | 'unknown';

/** Each AI module's system prompt contains one of these phrases (same as e2e/app.e2e.cjs). */
export function stageOfPrompt(system: string): Stage {
  if (system.includes('checks a machine control design')) return 'review';
  if (system.includes('functional specification')) return 'spec';
  if (system.includes('choosing the control equipment')) return 'equipment';
  if (system.includes('PLC I/O list')) return 'io';
  if (system.includes('industrial control panel')) return 'electrical';
  // Generate / Update all: the AI reads the machine model, the rule-based engine designs the panel.
  if (system.includes("describe the machine's electrical load")) return 'electrical';
  if (system.includes('HMI designer')) return 'hmi';
  // Design / Update all: rule-based screens, the AI only names things (src/lib/ai/hmiContentAI.ts).
  if (system.includes('You name things on an operator touch panel')) return 'hmi';
  if (system.includes('ladder logic')) return 'program';
  return 'unknown';
}

/** What the user would set in the app before generating (project data / electrical inputs). */
export const MACHINE_SETUP: Record<string, { region?: 'US' | 'Canada'; supply?: string }> = {
  'm1-case-erector': { supply: '480VAC-3PH' },
  'm2-pick-place-servo': { supply: '240VAC-3PH' },
  'm3-bottle-filler-capper': { supply: '480VAC-3PH' },
  'm4-palletizer-light-curtain': { supply: '480VAC-3PH' },
  'm5-mixing-tank': { supply: '480VAC-3PH' },
  'm6-canada-conveyor-vfd': { region: 'Canada', supply: '600VAC-3PH' },
};
