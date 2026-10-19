import type { CpuModel, PlcProfile } from '../profile';
import { clickProfile } from './click';
import { logixProfile } from './logix';
import { micro800Profile } from './micro800';
import { siemensProfile } from './siemens';
import { unistreamProfile } from './unilogic';
import { visionProfile } from './visilogic';
import { yaskawaProfile } from './yaskawa';

/** Generic IEC 61131-3 Structured Text, addressed by the project's own I/O ids. */
const genericStProfile: PlcProfile = {
  id: 'generic-st',
  vendor: 'IEC 61131-3',
  name: 'Generic Structured Text',
  language: 'st',
  available: true,
  cpuModels: [{ id: 'generic', label: 'Any IEC 61131-3 controller', builtInInputs: 0, builtInOutputs: 0 }],
  defaultCpuId: 'generic',
  autoAddresses: (io) => new Map(io.map((p) => [p.id, p.id])),
  parseAddress: () => ({ kind: 'bit', isBit: true }),
  promptKnowledge: () => '',
};

export const PLC_PROFILES: PlcProfile[] = [
  clickProfile,
  logixProfile,
  micro800Profile,
  siemensProfile,
  unistreamProfile,
  visionProfile,
  yaskawaProfile,
  genericStProfile,
];

export function getProfile(id: string): PlcProfile {
  return PLC_PROFILES.find((p) => p.id === id && p.available) ?? clickProfile;
}

export function getCpu(profile: PlcProfile, cpuId: string): CpuModel {
  return profile.cpuModels.find((c) => c.id === cpuId) ?? profile.cpuModels.find((c) => c.id === profile.defaultCpuId)!;
}
