import { useProjectStore } from '../../../store/useProjectStore';
import { useIOStore } from '../../../store/useIOStore';
import { useProgramStore } from '../../../store/useProgramStore';
import { useSpecStore } from '../../../store/useSpecStore';
import { useDraftStore } from '../../../store/useDraftStore';
import { useProjectsStore } from '../../../store/useProjectsStore';
import { planUpgrade, UPGRADE_KEY, type UpgradeOriginal, type UpgradePlan } from '../upgrade';
import { gzipText } from '../gz';
import { canPatch } from '../exportUpgrade';
import { notify } from '../../../store/useNoticeStore';
import type { ImportedProgram } from '../types';
import type { SpecSectionId } from '../../../spec/types';

/**
 * Make the imported program the open project: PLC and modules, the I/O list (replaced), the program
 * (the previous one is kept as a version), the machine description sections that are still empty,
 * the questions, and the original for "Original vs now".
 */
export function applyUpgrade(imp: ImportedProgram, fileText?: string): UpgradePlan {
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
  // The original file goes with the project (compressed) so the download can write the changes into it.
  if (fileText && canPatch(plan.original, plan.plcId)) void keepFile(fileText, plan.original.importedAt);
  return plan;
}

/** Largest compressed original kept with the project (the project is saved in the browser's storage). */
const MAX_KEPT = 3_000_000;

async function keepFile(text: string, importedAt: string): Promise<void> {
  try {
    const fileGz = await gzipText(text);
    const cur = upgradeOriginal(useDraftStore.getState().drafts);
    if (!cur || cur.importedAt !== importedAt) return; // another program was read meanwhile
    if (fileGz.length > MAX_KEPT) { notify('The original file is too large to keep with the project: the download will be a new project file, with a list of what it does not have.'); return; }
    useDraftStore.getState().setDraft(UPGRADE_KEY, { ...cur, fileGz });
  } catch {
    notify('The original file could not be kept with the project: the download will be a new project file.');
  }
}

export const upgradeOriginal = (drafts: Record<string, unknown>) => (drafts[UPGRADE_KEY] as UpgradeOriginal | undefined) ?? null;
