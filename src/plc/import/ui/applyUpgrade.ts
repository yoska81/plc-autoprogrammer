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
import type { NetworkAxis } from '../../core/networkAxes';
import type { VendorGroup } from '../../../electrical/catalogs';
import type { VendorId } from '../../../electrical/types';

/**
 * Make the imported program the open project: PLC and modules, the I/O list (replaced), the program
 * (the previous one is kept as a version), the machine description sections that are still empty,
 * the questions, and the original for "Original vs now". `planned`: the plan already worked out (off the page,
 * for a big program).
 */
export function applyUpgrade(imp: ImportedProgram, fileText?: string, planned?: UpgradePlan): UpgradePlan {
  const plan = planned ?? planUpgrade(imp, useProjectStore.getState().plcId);
  const project = useProjectStore.getState();
  project.setPlc(plan.plcId, plan.cpuId);
  machineBrands(imp);
  project.setModules(plan.modules);
  // The servo axes the file defines (MECHATROLINK): the electrical design, the program and the HMI number them from this list.
  project.setNetworkAxes(networkAxesFrom(imp.source.axes ?? []));
  useIOStore.getState().importPoints(plan.io, true);
  const s = imp.source;
  // A project still on the default name takes the machine's.
  if (/^(My PLC Project)?$/.test(useProgramStore.getState().projectName.trim())) useProjectsStore.getState().renameActive(s.projectName.replace(/_/g, ' '));
  useProgramStore.getState().setGeneratedLadder(
    plan.program,
    `Read from ${s.fileName}: ${imp.report.converted} of ${imp.report.rungs} rungs converted. This is the machine's original program; ask for changes here and compare with the original on the Upgrade page.`,
    null,
    'user',
    s.fileName,
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

/** An imported program's axes as the project's network axes (line → circuit; two axes on one station are one drive). */
export function networkAxesFrom(axes: NonNullable<ImportedProgram['source']['axes']>): NetworkAxis[] {
  return axes.map((a) => ({
    key: `ax${a.line}_${a.axis}`, name: `Axis ${a.axis}${a.line > 1 ? ` (line ${a.line})` : ''}`, circuit: a.line, axis: a.axis, kind: a.kind,
    ...(a.drive ? { drivePartNumber: a.drive } : {}), ...(a.motor ? { motorPartNumber: a.motor } : {}),
    ...(a.station ? { station: a.station, stationAxis: a.stationAxis ?? 0 } : {}), source: 'import' as const,
  }));
}

/**
 * A program read from a Yaskawa MPE720 project: the brand rows follow the machine. The PLC row shows the project's
 * PLC (a PLC brand chosen before no longer overrides it); its servo drives are Yaskawa, and a Weintek panel project
 * that came with it makes the panel row Weintek. The other rows keep the user's choice.
 */
function machineBrands(imp: ImportedProgram): void {
  if (imp.source.format !== 'yaskawa-mpe720') return;
  const { info, setInfo } = useProjectStore.getState();
  const vendors: Partial<Record<VendorGroup, VendorId[]>> = { ...info.vendors };
  delete vendors.plc;
  if (imp.source.axes?.some((a) => a.kind === 'servo')) vendors.drives = ['yaskawa'];
  if (imp.source.panel) vendors.hmi = [imp.source.panel.vendor as VendorId];
  setInfo({ vendors, plcChosen: false });
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
