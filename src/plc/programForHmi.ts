/**
 * After the HMI screens change ("Redesign screens", a new panel, a PLC change) the program may not implement
 * every HMI tag yet: the checker then blocks the program exports. This says which tags, on the HMI and Program
 * pages, and rebuilds the program's standard blocks from the rules around its current cycle (no AI, no key).
 */
import type { LadderProgram } from './core/ladder';
import type { HmiDesign } from '../hmi/types';
import type { IOPoint } from '../types/io';
import { isAnalog } from '../types/io';
import { implemented, programUse } from '../hmi/engine/upgradeHmi';
import { useProjectStore } from '../store/useProjectStore';
import { useIOStore } from '../store/useIOStore';
import { useProgramStore } from '../store/useProgramStore';
import { useElectricalStore } from '../store/useElectricalStore';
import { useSpecStore } from '../store/useSpecStore';
import { useStageStore } from '../store/useStageStore';
import { getCpu, getProfile } from './core/profiles';
import { resolveAddresses } from './core/profile';
import { moduleSlots } from './core/modules';
import { activeHmiDesign, noTouchPanelNow } from '../hmi/projectPanel';
import { generateRuleBasedProgram } from './ai/cycleAI';
import { fingerprint, specToText } from '../spec/types';
import { hmiFingerprint, ioFingerprint } from '../spec/useStages';

/** HMI tags (addresses) the program does not implement: shown but never written, or written but never read. */
export function hmiTagsNotInProgram(ladder: LadderProgram, design: HmiDesign | null | undefined, io: IOPoint[], addresses: Map<string, string>): string[] {
  // An upgraded program's own list of PLC changes covers its tags (the review lists them).
  if (!design || !ladder.rungs.length || design.plcChanges) return [];
  const use = programUse(ladder);
  const analogIn = new Set(io.filter((p) => p.type === 'input' && isAnalog(p)).map((p) => (addresses.get(p.id) ?? '').toUpperCase()));
  return [...new Set(design.tags.filter((t) => !analogIn.has(t.address.trim().toUpperCase()) && !implemented(t, use)).map((t) => t.address.trim().toUpperCase()))];
}

/** A ladder program can be rebuilt from the rules (around its cycle steps when it has them). */
export const canRebuildForHmi = () => getProfile(useProjectStore.getState().plcId).language === 'ladder';

/**
 * Rebuild the standard blocks (every HMI tag implemented) around the current cycle steps, or the default cycle from
 * the I/O list when the program has none (written by hand or by the AI); the old program goes to History.
 */
export async function rebuildProgramForHmi(): Promise<void> {
  const { plcId, cpuId, modules } = useProjectStore.getState();
  const profile = getProfile(plcId), cpu = getCpu(profile, cpuId);
  const io = useIOStore.getState().projectIO;
  const addresses = resolveAddresses(profile, cpu, io, moduleSlots(modules));
  const electrical = useElectricalStore.getState().design;
  const wiring = new Map((electrical?.ioWiring ?? []).map((w) => [w.address, { deviceTag: w.deviceTag, deviceType: w.deviceType }]));
  const hmi = activeHmiDesign();
  const sections = useSpecStore.getState().sections;
  const prog = useProgramStore.getState();
  const r = await generateRuleBasedProgram({
    ctx: { profile, cpu, io, addresses, wiring, hmi: hmi ?? undefined }, spec: specToText(sections), electrical, hmi, noPanel: noTouchPanelNow(),
    ...(prog.ladder.sequence ? { keepSequence: prog.ladder.sequence } : {}),
  });
  // The cycle of the program as it was is kept: it stays the user's when it was (a hand-edited or imported cycle must
  // not be rebuilt away by a later Update all).
  prog.setGeneratedLadder(r.program, `Rebuilt for the HMI screens (standard blocks from the rules, the cycle kept). ${r.explanation}`.trim(), r.reasoning, prog.ladderOrigin === 'app' ? 'app' : 'user');
  useStageStore.getState().markGenerated('program', { specFp: fingerprint(sections), spec: sections, ioFp: ioFingerprint(io), hmiFp: hmiFingerprint(hmi) });
}
