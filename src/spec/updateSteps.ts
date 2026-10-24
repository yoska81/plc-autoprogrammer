// The stages and results of Update all, apart from the pipeline (./updateAll) so the toolbar loads without the engines.

export type UpdateStep = 'equipment' | 'io' | 'electrical' | 'hmi' | 'program';
export interface StepResult {
  step: UpdateStep;
  status: 'skipped' | 'done' | 'proposal' | 'failed';
  message: string;
  /** How long the stage took (ms). */
  ms?: number;
  /** A first result (the rules' version): the AI's version follows. */
  provisional?: boolean;
}

/**
 * Stages that run at the same time (the Update dialog's spinners): the I/O list does not depend on the
 * CPU, so it is asked while the equipment is chosen; electrical and HMI both need only the I/O list;
 * the PLC program needs the electrical wiring and the HMI tags.
 */
export const UPDATE_GROUPS: UpdateStep[][] = [['equipment', 'io'], ['electrical', 'hmi'], ['program']];
