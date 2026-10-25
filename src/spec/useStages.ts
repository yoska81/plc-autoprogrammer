import { useMemo } from 'react';
import { useSpecStore } from '../store/useSpecStore';
import { useIOStore } from '../store/useIOStore';
import { useHmiStore } from '../store/useHmiStore';
import { useElectricalStore } from '../store/useElectricalStore';
import { useProgramStore } from '../store/useProgramStore';
import { setAddressFingerprint, useStageStore, type StageId, type StageSource } from '../store/useStageStore';
import { useProjectStore } from '../store/useProjectStore';
import { noTouchPanelNow, useNoTouchPanel } from '../hmi/projectPanel';
import { getCpu, getProfile } from '../plc/core/profiles';
import { resolveAddresses } from '../plc/core/profile';
import { moduleSlots } from '../plc/core/modules';
import { hardwareShortfall } from './equipmentRules';
import { changedSections, fingerprint, specToText, type SpecSections } from './types';
import { brandMismatch, plcPreference, plcPreferenceOf } from './brand';
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
    panel: hmi?.hmiPartNumber,
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
  fp: { spec: Record<string, string>; specFp: string; ioFp: string; addrFp?: string; region?: string; hmiFp: string; panel?: string };
  sources: Partial<Record<StageId, StageSource>>;
  ioCount: number;
  hasDesign: boolean;
  hasHmi: boolean;
  hasProgram: boolean;
  /** The equipment was chosen without a touch panel (pushbuttons and lamps only): the HMI stage is not used. */
  noHmi?: boolean;
  /** Why the chosen CPU and modules cannot hold the I/O list (hardwareShortfall), or null. */
  hardwareShort?: string | null;
  /** Why the project's PLC is not the brand asked for (brandMismatch), or null. */
  otherBrand?: string | null;
  /** The machine keeps its own controller (read only, from its program): the equipment is there, nothing to choose. */
  keptController?: boolean;
}

/** Pure stage status (used by the hook below and by the design review). */
export function computeStages({ fp, sources, ioCount, hasDesign, hasHmi, hasProgram, noHmi = false, hardwareShort = null, otherBrand = null, keptController = false }: StageInputs): Record<StageId, StageInfo> {
  const specEmpty = !Object.values(fp.spec).some((t) => t.trim());
  const hasEquipment = Boolean(sources.equipment);
  const info = (id: StageId, has: boolean, deps: { spec?: boolean; io?: boolean; hmi?: boolean; region?: boolean; panel?: boolean }): StageInfo => {
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
    // Screens scaled to another panel keep their layout problems until they are laid out for it.
    if (deps.panel && src.panel && fp.panel && src.panel !== fp.panel) reasons.push(id === 'hmi'
      ? `the touch panel changed (the screens were laid out for ${src.panel}; Redesign screens lays them out for ${fp.panel})`
      // the electrical design holds what the panel needs on the PLC side (communication module, cutout, 24 V load)
      : `the touch panel changed (the design was made for ${src.panel}; update it for ${fp.panel})`);
    return reasons.length ? { id, status: 'stale', reason: `Out of date: ${reasons.join(' and ')}.` } : { id, status: 'ready', reason: null };
  };
  return {
    spec: { id: 'spec', status: specEmpty ? 'empty' : 'ready', reason: null },
    // A PLC that cannot hold the I/O is never "done", however it was chosen (Equipment or PLC page).
    equipment: keptController ? { id: 'equipment', status: 'ready', reason: null }
      : hardwareShort
      ? { id: 'equipment', status: 'stale', reason: `The PLC cannot hold the I/O list: ${hardwareShort} Choose a larger CPU or add modules on the Equipment page.` }
      // Another brand than the description (or Brand preference) asks for: chosen again by Update all.
      : otherBrand && hasEquipment ? { id: 'equipment', status: 'stale', reason: `${otherBrand} Choose that brand on the Equipment page, or run Update all.` }
        : info('equipment', hasEquipment, { spec: true }),
    io: info('io', ioCount > 0, { spec: true }),
    electrical: info('electrical', hasDesign, { spec: true, io: true, region: true, panel: true }),
    hmi: noHmi && !hasHmi ? { id: 'hmi', status: 'ready', reason: null } : info('hmi', hasHmi, { spec: true, io: true, panel: true }),
    program: info('program', hasProgram, { spec: true, io: true, hmi: true }),
  };
}

/** Stage status read straight from the stores (outside React). */
export function stagesNow(): Record<StageId, StageInfo> {
  const sections = useSpecStore.getState().sections;
  const io = useIOStore.getState().projectIO;
  const noHmi = noTouchPanelNow();
  // Screens left from an earlier panel do not count on a machine without one.
  const hmi = noHmi ? null : useHmiStore.getState().design;
  const prog = useProgramStore.getState();
  return computeStages({
    fp: { spec: sections, specFp: fingerprint(sections), ioFp: ioFingerprint(io), addrFp: addressFingerprintNow(), region: useProjectStore.getState().info.region, hmiFp: hmiFingerprint(hmi), panel: hmi?.hmiPartNumber },
    sources: useStageStore.getState().sources,
    ioCount: io.length,
    hasDesign: Boolean(useElectricalStore.getState().design),
    hasHmi: Boolean(hmi),
    hasProgram: prog.ladder.rungs.length > 0 || Boolean(prog.generatedCode),
    hardwareShort: (() => { const p = useProjectStore.getState(); return hardwareShortfall(p.cpuId, p.modules, io); })(),
    otherBrand: brandMismatch(specToText(sections), plcPreference(), useProjectStore.getState().plcId),
    noHmi,
    keptController: Boolean(getProfile(useProjectStore.getState().plcId).readOnly),
  });
}

/** Status of every stage: empty, out of date (with reason) or ready. */
export function useStages(): Record<StageId, StageInfo> {
  const fp = useFingerprints();
  const sources = useStageStore((s) => s.sources);
  const ioCount = useIOStore((s) => s.projectIO.length);
  const hasDesign = useElectricalStore((s) => Boolean(s.design));
  const noHmi = useNoTouchPanel();
  const hasHmi = useHmiStore((s) => Boolean(s.design)) && !noHmi;
  const hasProgram = useProgramStore((s) => s.ladder.rungs.length > 0 || Boolean(s.generatedCode));
  const io = useIOStore((s) => s.projectIO);
  const cpuId = useProjectStore((s) => s.cpuId);
  const modules = useProjectStore((s) => s.modules);
  const hardwareShort = useMemo(() => hardwareShortfall(cpuId, modules, io), [cpuId, modules, io]);
  const plcId = useProjectStore((s) => s.plcId);
  const plcPref = useProjectStore((s) => s.info.vendors?.plc);
  const plcChosen = useProjectStore((s) => s.info.plcChosen);
  const otherBrand = useMemo(() => brandMismatch(specToText(fp.spec), plcPreferenceOf(plcPref, plcChosen), plcId), [fp.spec, plcPref, plcChosen, plcId]);
  const keptController = Boolean(getProfile(plcId).readOnly);
  return useMemo(() => computeStages({ fp, sources, ioCount, hasDesign, hasHmi, hasProgram, noHmi, hardwareShort, otherBrand, keptController }),
    [fp, sources, ioCount, hasDesign, hasHmi, hasProgram, noHmi, hardwareShort, otherBrand, keptController]);
}
