import { useMemo } from 'react';
import { useSpecStore } from '../store/useSpecStore';
import { useIOStore } from '../store/useIOStore';
import { useHmiStore } from '../store/useHmiStore';
import { useElectricalStore } from '../store/useElectricalStore';
import { useProgramStore } from '../store/useProgramStore';
import { setAddressFingerprint, useStageStore, type StageId, type StageSource } from '../store/useStageStore';
import { useProjectStore } from '../store/useProjectStore';
import { getCpu, getProfile } from '../plc/core/profiles';
import { resolveAddresses } from '../plc/core/profile';
import { moduleSlots } from '../plc/core/modules';
import { changedSections, fingerprint, type SpecSections } from './types';
import type { IOPoint } from '../types/io';
import type { HmiDesign } from '../hmi/types';
import { SOURCE_LABEL, type QuestionSource } from '../components/questions/useQuestionStore';

export type StageStatus = 'empty' | 'stale' | 'ready';

export interface StageInfo {
  id: StageId;
  status: StageStatus;
  /** Why it is out of date, in plain words. */
  reason: string | null;
}

export const ioFingerprint = (io: IOPoint[]) =>
  fingerprint(io.map((p) => [p.id, p.description, p.type, p.plcAddress ?? '', p.deviceType ?? '']));
export const hmiFingerprint = (d: HmiDesign | null) => fingerprint(d?.tags ?? []);

/** PLC profile, CPU and the resolved address of every I/O point (what the I/O-based stages bind to). */
export function addressFingerprint(plcId: string, cpuId: string, modules: string[], io: IOPoint[]): string {
  const profile = getProfile(plcId);
  const cpu = getCpu(profile, cpuId);
  const addresses = resolveAddresses(profile, cpu, io, moduleSlots(modules));
  return fingerprint([profile.id, cpu.id, io.map((p) => [p.id, addresses.get(p.id) ?? ''])]);
}
const addressFingerprintNow = () => {
  const { plcId, cpuId, modules } = useProjectStore.getState();
  return addressFingerprint(plcId, cpuId, modules, useIOStore.getState().projectIO);
};
setAddressFingerprint(addressFingerprintNow, () => useProjectStore.getState().info.region);

/** Current fingerprints of the inputs each stage depends on. */
export function useFingerprints() {
  const sections = useSpecStore((s) => s.sections);
  const io = useIOStore((s) => s.projectIO);
  const hmi = useHmiStore((s) => s.design);
  const { plcId, cpuId, modules, info } = useProjectStore();
  return useMemo(() => ({
    spec: sections,
    specFp: fingerprint(sections),
    ioFp: ioFingerprint(io),
    addrFp: addressFingerprint(plcId, cpuId, modules, io),
    region: info.region,
    hmiFp: hmiFingerprint(hmi),
  }), [sections, io, hmi, plcId, cpuId, modules, info.region]);
}

/** Questions whose answers a stage is built on (the stages before it ask the rest). */
const QA_SOURCES: Partial<Record<StageId, QuestionSource[]>> = {
  // drawings: answers about the existing machine are part of the description for every stage
  equipment: ['spec', 'drawings', 'io'], io: ['spec', 'drawings', 'io'], electrical: ['spec', 'drawings', 'io', 'electrical'], hmi: ['spec', 'drawings', 'io', 'hmi'],
  program: ['spec', 'drawings', 'io', 'electrical', 'hmi', 'program', 'review'],
};

/**
 * The spec as one stage sees it: the sections, and only the answers to the questions it depends on.
 * An answer "use the AI's assumption" is left out: the stage was already built on that assumption.
 */
export function specForStage(spec: Record<string, string>, stage: StageId): Record<string, string> {
  const sources = QA_SOURCES[stage];
  const { qa: all = '', ...sections } = spec;
  if (!sources) return spec;
  const labels = new Set(sources.map((s) => SOURCE_LABEL[s]));
  const qa = all.split(/\n(?=Q \()/)
    .filter((b) => { const m = b.match(/^Q \(([^)]*)\):/); return b.trim() && (!m || labels.has(m[1])) && !/\nA: \(AI's assumption/.test(b); })
    .join('\n');
  // No answers that matter here and no answers at all compare the same.
  return qa ? { ...sections, qa } : sections;
}

export interface StageInputs {
  fp: { spec: Record<string, string>; specFp: string; ioFp: string; addrFp?: string; region?: string; hmiFp: string };
  sources: Partial<Record<StageId, StageSource>>;
  ioCount: number;
  hasDesign: boolean;
  hasHmi: boolean;
  hasProgram: boolean;
  /** The equipment was chosen without a touch panel (pushbuttons and lamps only): the HMI stage is not used. */
  noHmi?: boolean;
}

/** Pure stage status (used by the hook below and by the design review). */
export function computeStages({ fp, sources, ioCount, hasDesign, hasHmi, hasProgram, noHmi = false }: StageInputs): Record<StageId, StageInfo> {
  const specEmpty = !Object.values(fp.spec).some((t) => t.trim());
  const hasEquipment = Boolean(sources.equipment);
  const info = (id: StageId, has: boolean, deps: { spec?: boolean; io?: boolean; hmi?: boolean; region?: boolean }): StageInfo => {
    if (!has) return { id, status: 'empty', reason: null };
    const src = sources[id];
    if (!src) return { id, status: 'ready', reason: null }; // made by hand or before tracking
    const reasons: string[] = [];
    // With the spec the stage was built from, compare only what it depends on (its questions' answers).
    const specChanged = src.spec ? fingerprint(specForStage(src.spec, id)) !== fingerprint(specForStage(fp.spec, id)) : src.specFp !== fp.specFp;
    if (deps.spec && specChanged) {
      // Say exactly what changed: answering a question (e.g. during an update) is not the same as editing the description.
      const changed = src.spec ? changedSections(specForStage(src.spec, id) as SpecSections, specForStage(fp.spec, id) as SpecSections) : [];
      reasons.push(changed.length === 1 && changed[0] === 'Questions and answers' ? 'new answers to questions' : changed.length ? `the machine description changed (${changed.slice(0, 3).join(', ')}${changed.length > 3 ? '…' : ''})` : 'the spec changed');
    }
    if (deps.io && src.ioFp !== undefined && src.ioFp !== fp.ioFp) reasons.push('the I/O list changed');
    else if (deps.io && src.addrFp !== undefined && fp.addrFp !== undefined && src.addrFp !== fp.addrFp) reasons.push('the PLC or its I/O addresses changed');
    if (deps.region && src.region !== undefined && fp.region !== undefined && src.region !== fp.region) reasons.push('the installation region changed');
    if (deps.hmi && src.hmiFp !== undefined && src.hmiFp !== fp.hmiFp) reasons.push('the HMI tags changed');
    return reasons.length ? { id, status: 'stale', reason: `Out of date: ${reasons.join(' and ')}.` } : { id, status: 'ready', reason: null };
  };
  return {
    spec: { id: 'spec', status: specEmpty ? 'empty' : 'ready', reason: null },
    equipment: info('equipment', hasEquipment, { spec: true }),
    io: info('io', ioCount > 0, { spec: true }),
    electrical: info('electrical', hasDesign, { spec: true, io: true, region: true }),
    hmi: noHmi && !hasHmi ? { id: 'hmi', status: 'ready', reason: null } : info('hmi', hasHmi, { spec: true, io: true }),
    program: info('program', hasProgram, { spec: true, io: true, hmi: true }),
  };
}

/** Stage status read straight from the stores (outside React). */
export function stagesNow(): Record<StageId, StageInfo> {
  const sections = useSpecStore.getState().sections;
  const io = useIOStore.getState().projectIO;
  const hmi = useHmiStore.getState().design;
  const prog = useProgramStore.getState();
  return computeStages({
    fp: { spec: sections, specFp: fingerprint(sections), ioFp: ioFingerprint(io), addrFp: addressFingerprintNow(), region: useProjectStore.getState().info.region, hmiFp: hmiFingerprint(hmi) },
    sources: useStageStore.getState().sources,
    ioCount: io.length,
    hasDesign: Boolean(useElectricalStore.getState().design),
    hasHmi: Boolean(hmi),
    hasProgram: prog.ladder.rungs.length > 0 || Boolean(prog.generatedCode),
    noHmi: Boolean(useStageStore.getState().sources.equipment) && !useHmiStore.getState().hmiPartNumber,
  });
}

/** Status of every stage: empty, out of date (with reason) or ready. */
export function useStages(): Record<StageId, StageInfo> {
  const fp = useFingerprints();
  const sources = useStageStore((s) => s.sources);
  const ioCount = useIOStore((s) => s.projectIO.length);
  const hasDesign = useElectricalStore((s) => Boolean(s.design));
  const hasHmi = useHmiStore((s) => Boolean(s.design));
  const hasProgram = useProgramStore((s) => s.ladder.rungs.length > 0 || Boolean(s.generatedCode));
  const noPanel = useHmiStore((s) => !s.hmiPartNumber);
  const noHmi = Boolean(sources.equipment) && noPanel;
  return useMemo(() => computeStages({ fp, sources, ioCount, hasDesign, hasHmi, hasProgram, noHmi }),
    [fp, sources, ioCount, hasDesign, hasHmi, hasProgram, noHmi]);
}
