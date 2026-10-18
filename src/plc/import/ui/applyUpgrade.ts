import { useProjectStore } from '../../../store/useProjectStore';
import { useIOStore } from '../../../store/useIOStore';
import { useProgramStore } from '../../../store/useProgramStore';
import { useSpecStore } from '../../../store/useSpecStore';
import { useDraftStore } from '../../../store/useDraftStore';
import { useProjectsStore } from '../../../store/useProjectsStore';
import { planUpgrade, UPGRADE_KEY, type UpgradeOriginal, type UpgradePlan } from '../upgrade';
import type { ImportedProgram } from '../types';
import type { SpecSectionId } from '../../../spec/types';

/**
 * Make the imported program the open project: PLC and modules, the I/O list (replaced), the program
 * (the previous one is kept as a version), the machine description sections that are still empty,
 * the questions, and the original for "Original vs now".
 */
export function applyUpgrade(imp: ImportedProgram): UpgradePlan {
  const plan = planUpgrade(imp, useProjectStore.getState().plcId);
  const project = useProjectStore.getState();
  project.setPlc(plan.plcId, plan.cpuId);
  project.setModules(plan.modules);
  useIOStore.getState().importPoints(plan.io, true);
  const s = imp.source;
  // A project still on the default name takes the machine's.
  if (/^(My PLC Project)?$/.test(useProgramStore.getState().projectName.trim())) useProjectsStore.getState().renameActive(s.projectName.replace(/_/g, ' '));
  useProgramStore.getState().setGeneratedLadder(
    plan.program,
    `Read from ${s.fileName}: ${imp.report.converted} of ${imp.report.rungs} rungs converted. This is the machine's original program; ask for changes here and compare with the original on the Upgrade page.`,
    null,
  );
  const spec = useSpecStore.getState();
  for (const [id, text] of Object.entries(plan.spec) as [SpecSectionId, string][]) {
    if (!spec.sections[id]?.trim() && text) spec.setSection(id, text);
  }
  const asked = new Set(spec.questions);
  spec.setQuestions([...spec.questions, ...plan.questions.filter((q) => !asked.has(q))]);
  useDraftStore.getState().setDraft(UPGRADE_KEY, plan.original);
  return plan;
}

export const upgradeOriginal = (drafts: Record<string, unknown>) => (drafts[UPGRADE_KEY] as UpgradeOriginal | undefined) ?? null;
