import { collectProject } from '../deliverables/collect';
import { stagesNow } from '../spec/useStages';
import { useProjectStore } from '../store/useProjectStore';
import { runChecks } from './checks';
import { useReviewStore } from './useReviewStore';
import { AREA_LABEL, SEVERITY_LABEL, type Finding } from './types';

/** Run the deterministic checks on the current project and store them. */
export function refreshChecks() {
  const findings = runChecks({ p: collectProject(), stages: stagesNow(), modules: useProjectStore.getState().modules });
  useReviewStore.getState().setChecks(findings);
  return findings;
}

/** Text handed to a stage's AI fix flow. */
export function fixText(f: Finding): string {
  return `Design review finding (${SEVERITY_LABEL[f.severity]}, ${AREA_LABEL[f.area]}): ${f.title}\n${f.detail}\nRecommended fix: ${f.fix}`;
}

