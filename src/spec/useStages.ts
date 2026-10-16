import { useMemo } from 'react';
import { useSpecStore } from '../store/useSpecStore';
import { useIOStore } from '../store/useIOStore';
import { useHmiStore } from '../store/useHmiStore';
import { useElectricalStore } from '../store/useElectricalStore';
import { useProgramStore } from '../store/useProgramStore';
import { useStageStore, type StageId, type StageSource } from '../store/useStageStore';
import { fingerprint } from './types';
import type { IOPoint } from '../types/io';
import type { HmiDesign } from '../hmi/types';

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

/** Current fingerprints of the inputs each stage depends on. */
export function useFingerprints() {
  const sections = useSpecStore((s) => s.sections);
  const io = useIOStore((s) => s.projectIO);
  const hmi = useHmiStore((s) => s.design);
  return useMemo(() => ({
    spec: sections,
    specFp: fingerprint(sections),
    ioFp: ioFingerprint(io),
    hmiFp: hmiFingerprint(hmi),
  }), [sections, io, hmi]);
}

export interface StageInputs {
  fp: { spec: Record<string, string>; specFp: string; ioFp: string; hmiFp: string };
  sources: Partial<Record<StageId, StageSource>>;
  ioCount: number;
  hasDesign: boolean;
  hasHmi: boolean;
  hasProgram: boolean;
}

/** Pure stage status (used by the hook below and by the design review). */
export function computeStages({ fp, sources, ioCount, hasDesign, hasHmi, hasProgram }: StageInputs): Record<StageId, StageInfo> {
  const specEmpty = !Object.values(fp.spec).some((t) => t.trim());
  const hasEquipment = Boolean(sources.equipment);
  const info = (id: StageId, has: boolean, deps: { spec?: boolean; io?: boolean; hmi?: boolean }): StageInfo => {
    if (!has) return { id, status: 'empty', reason: null };
    const src = sources[id];
    if (!src) return { id, status: 'ready', reason: null }; // made by hand or before tracking
    const reasons: string[] = [];
    if (deps.spec && src.specFp !== fp.specFp) reasons.push('the spec changed');
    if (deps.io && src.ioFp !== undefined && src.ioFp !== fp.ioFp) reasons.push('the I/O list changed');
    if (deps.hmi && src.hmiFp !== undefined && src.hmiFp !== fp.hmiFp) reasons.push('the HMI tags changed');
    return reasons.length ? { id, status: 'stale', reason: `Out of date: ${reasons.join(' and ')}.` } : { id, status: 'ready', reason: null };
  };
  return {
    spec: { id: 'spec', status: specEmpty ? 'empty' : 'ready', reason: null },
    equipment: info('equipment', hasEquipment, { spec: true }),
    io: info('io', ioCount > 0, { spec: true }),
    electrical: info('electrical', hasDesign, { spec: true, io: true }),
    hmi: info('hmi', hasHmi, { spec: true, io: true }),
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
    fp: { spec: sections, specFp: fingerprint(sections), ioFp: ioFingerprint(io), hmiFp: hmiFingerprint(hmi) },
    sources: useStageStore.getState().sources,
    ioCount: io.length,
    hasDesign: Boolean(useElectricalStore.getState().design),
    hasHmi: Boolean(hmi),
    hasProgram: prog.ladder.rungs.length > 0 || Boolean(prog.generatedCode),
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
  return useMemo(() => computeStages({ fp, sources, ioCount, hasDesign, hasHmi, hasProgram }),
    [fp, sources, ioCount, hasDesign, hasHmi, hasProgram]);
}
