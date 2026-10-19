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
import type { LadderProgram } from '../../core/ladder';
import { panelTags, programRoles } from '../hmiRoles';
import type { UpgradeRoles } from '../../../hmi/engine/upgradeHmi';

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
    'user',
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

/** The upgraded program's own addresses for the HMI's functions, or null when the project is not an upgrade. */
export function projectUpgradeRoles(drafts: Record<string, unknown>, ladder: LadderProgram): UpgradeRoles | null {
  const orig = upgradeOriginal(drafts);
  if (!orig) return null;
  const roles = programRoles(ladder, new Map(Object.entries(orig.names).map(([a, n]) => [a.toUpperCase(), n])));
  const panel = panelTags(roles);
  // The exact panel Start / Stop changes are in the HMI's PLC change list; the rest is said as the importer found it.
  const missing = roles.missing.filter((m) => !(panel.parallelTo.length && /in parallel/i.test(m)));
  return { ...panel, alarms: roles.alarms.map((a) => ({ ...a, text: alarmText(a, ladder) })), missing };
}

/** An alarm known only by its tag ("Alm[0].3") is named by the comment of the rung that sets it ("Alarm 3: Pallet jam"). */
function alarmText(a: { address: string; nickname: string; text: string }, ladder: LadderProgram): string {
  if (a.text !== a.nickname && /\s/.test(a.text)) return a.text;
  const setter = ladder.rungs.find((r) => r.comment.trim() && r.outputs.some((o) => (o.type === 'OUT' || o.type === 'SET') && o.address.toUpperCase() === a.address.toUpperCase()));
  const said = setter?.comment.replace(/^original:\s*\S+\s*[—-]\s*/i, '').replace(/^alarm\s*\d*\s*:\s*/i, '').split(/[.\n]/)[0].trim();
  return said ? said[0].toUpperCase() + said.slice(1) : a.text;
}
