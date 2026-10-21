import type { Effort, Speed } from '../../store/useSettingsStore';

/**
 * What an AI request is for. Small JSON tasks (naming HMI items, choosing equipment) need little
 * thinking; Speed "fast" caps each task's effort at its own level so they answer in seconds, while
 * "thorough" uses the Settings effort for everything.
 */
export type AiTask = 'hmi-names' | 'equipment' | 'cycle' | 'machine' | 'io' | 'spec' | 'review' | 'program' | 'design' | 'import' | 'troubleshoot';

export const TASK_EFFORT: Record<AiTask, Effort> = {
  'hmi-names': 'low', equipment: 'low', troubleshoot: 'low',
  cycle: 'medium', machine: 'medium', io: 'medium', spec: 'medium',
  review: 'high', program: 'high', design: 'high', import: 'high',
};

/**
 * Most tokens a task's answer may take, thinking included (the API's max_tokens). Small JSON answers need a few
 * thousand; the program and an import write the whole program back. An answer cut off at a lower cap is asked
 * again once at MAX_ANSWER_TOKENS (anthropic.ts), so a long think never loses the answer.
 */
export const MAX_ANSWER_TOKENS = 64000;
export const TASK_MAX_TOKENS: Record<AiTask, number> = {
  'hmi-names': 8000, equipment: 8000, troubleshoot: 8000, machine: 8000,
  cycle: 12000, io: 16000, spec: 16000, review: 16000,
  design: 32000, program: MAX_ANSWER_TOKENS, import: MAX_ANSWER_TOKENS,
};

/** Tasks a smaller, faster model may answer (Settings → "Model for small tasks"). */
export const SMALL_TASKS: AiTask[] = ['hmi-names', 'equipment', 'troubleshoot'];

const RANK: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

/** The effort a request runs at: in "fast" mode the lower of the Settings effort and the task's level. */
export function effectiveEffort(effort: Effort, task: AiTask | undefined, speed: Speed = 'fast'): Effort {
  if (!task || speed !== 'fast') return effort;
  const cap = TASK_EFFORT[task];
  return RANK.indexOf(cap) < RANK.indexOf(effort) ? cap : effort;
}

/** The model a request runs on: the small-task model when one is set and the task is small. */
export function effectiveModel(model: string, task: AiTask | undefined, smallTaskModel: string): string {
  return task && smallTaskModel && SMALL_TASKS.includes(task) ? smallTaskModel : model;
}
