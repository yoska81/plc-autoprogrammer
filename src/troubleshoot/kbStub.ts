/**
 * Stand-in for Dev 1's troubleshooting knowledge API (machineSymptoms.ts / deviceFaults.ts) until their reviewed
 * knowledge base lands on integration: the same types and functions, with no data of its own. Callers pass data
 * explicitly (tests) or get nothing. Delete this file and import from './machineSymptoms' and './deviceFaults' then.
 */

export type SymptomKind = 'no-input' | 'output-no-motion' | 'stuck-on' | 'trips' | 'display-code';

export interface SymptomCause {
  rank: number;
  cause: string;
  mechanism?: string;
  devices: { profileIds?: string[]; categories?: string[] };
  checks: string[];
  fix: string[];
  source: string;
}
export interface MachineSymptom { id: string; symptom: string; aliases: string[]; kind?: SymptomKind; causes: SymptomCause[] }
export interface MachineSymptomMap { machineType: string; title: string; aliases: string[]; symptoms: MachineSymptom[]; sources: string[] }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function symptomMap(machineType: string, data: MachineSymptomMap[] = []): MachineSymptomMap | undefined {
  const q = norm(machineType);
  return data.find((m) => m.machineType === machineType || [m.title, ...m.aliases].some((a) => q.includes(norm(a)) || norm(a).includes(q)));
}

export function findSymptom(map: MachineSymptomMap, text: string): MachineSymptom | undefined {
  const byId = map.symptoms.find((s) => s.id === text);
  if (byId) return byId;
  const ws = norm(text).split(' ').filter((w) => w.length > 2);
  return map.symptoms.find((s) => [s.symptom, ...s.aliases].some((a) => ws.every((w) => norm(a).includes(w))));
}

export function rankedCauses(s: MachineSymptom): SymptomCause[] {
  return [...s.causes].sort((a, b) => a.rank - b.rank);
}
