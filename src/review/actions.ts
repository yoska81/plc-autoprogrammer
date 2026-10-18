import { collectProject, type ProjectSnapshot } from '../deliverables/collect';
import { stagesNow } from '../spec/useStages';
import { useProjectStore } from '../store/useProjectStore';
import { runChecks } from './checks';
import { storedMachine, storedTarget } from '../convert/apply';
import { convertMachine, NA_TARGET } from '../convert/convert';
import { functionKept, functionKeptFindings } from '../convert/functionKept';
import { useReviewStore } from './useReviewStore';
import { AREA_LABEL, SEVERITY_LABEL, type Finding } from './types';

/** Deterministic checks for a project snapshot with the current stage status, modules and equipment cautions. */
export function checksFor(p: ProjectSnapshot): Finding[] {
  const { modules, recommendation } = useProjectStore.getState();
  const found = runChecks({ p, stages: stagesNow(), modules, cautions: recommendation?.cautions ?? [] });
  // a project converted from existing drawings: every original function must still be there
  const m = storedMachine();
  return m ? [...found, ...functionKeptFindings(functionKept(m, convertMachine(m, storedTarget() ?? NA_TARGET), p))] : found;
}

/** Run the deterministic checks on the current project and store them. */
export function refreshChecks() {
  const findings = checksFor(collectProject());
  useReviewStore.getState().setChecks(findings);
  return findings;
}

/** Text handed to a stage's AI fix flow. */
export function fixText(f: Finding): string {
  return `Design review finding (${SEVERITY_LABEL[f.severity]}, ${AREA_LABEL[f.area]}): ${f.title}\n${f.detail}\nRecommended fix: ${f.fix}`;
}


/** Open critical findings right now (fresh checks + stored AI review). */
export function openCriticalFindings(): Finding[] {
  const checks = refreshChecks();
  const { ai, marks } = useReviewStore.getState();
  return [...checks, ...(ai?.findings ?? [])].filter((f) => f.severity === 'critical' && !marks[f.id]);
}

/** Record an "issue for construction" override: every open critical finding is marked accepted with the reason. */
export function acceptCriticalForConstruction(findings: Finding[], rev: string, reason: string) {
  const mark = useReviewStore.getState().mark;
  for (const f of findings) mark(f.id, 'ignored', `Issued for construction (rev ${rev}) with this finding open — override: ${reason}`);
}
