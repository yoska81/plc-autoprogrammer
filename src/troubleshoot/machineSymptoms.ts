import type { CatalogCategory, CatalogPart } from '../electrical/types';
import { MACHINE_SYMPTOM_DATA } from './machineSymptomData';
import { profileMatches, type DeviceFaultProfile, type SymptomKind } from './deviceFaults';

/**
 * Machine-level symptom maps for the AI Troubleshooter: for a machine type (roll former with flying shear …), the
 * symptoms an operator reports ("cut length wrong / drifting", "shear doesn't fire", "material slips"), each with
 * its causes ranked most likely first, the devices involved, how to check, and the fix. Ranking and causes come
 * from maker application notes / manuals cited per cause (`source`); device-level detail is in deviceFaults.ts
 * (link via `profileIds` or `categories`).
 */

export interface SymptomCause {
  /** 1 = most likely. Ties allowed. */
  rank: number;
  cause: string;
  /** Why it causes the symptom, in one or two sentences. */
  mechanism?: string;
  /** Devices to look at: device fault profile ids (deviceFaults) and / or catalog categories. */
  devices: { profileIds?: string[]; categories?: CatalogCategory[] };
  /** Checks in order: meter / display / mechanical, with expected vs faulty results. */
  checks: string[];
  fix: string[];
  /** Maker document (URL + page / section) the cause and checks come from. */
  source: string;
}

export interface MachineSymptom {
  /** Stable id: 'cut-length-wrong', 'shear-does-not-fire', 'material-slips'. */
  id: string;
  /** As an operator would say it. */
  symptom: string;
  /** Other phrasings to match: 'parts too long', 'length drifts', 'inconsistent length'. */
  aliases: string[];
  kind?: SymptomKind;
  causes: SymptomCause[];
}

export interface MachineSymptomMap {
  /** 'roll-former-flying-shear'. */
  machineType: string;
  title: string;
  /** Words that identify the machine type in a project ('roll former', 'roll forming', 'flying shear', 'cut to length'). */
  aliases: string[];
  symptoms: MachineSymptom[];
  sources: string[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** The symptom map for a machine type, by id or any alias ('roll forming line', 'flying shear'). */
export function symptomMap(machineType: string, data: MachineSymptomMap[] = MACHINE_SYMPTOM_DATA): MachineSymptomMap | undefined {
  const q = norm(machineType);
  return data.find((m) => m.machineType === machineType || [m.title, ...m.aliases].some((a) => q.includes(norm(a)) || norm(a).includes(q)));
}

/** A symptom of a machine type by id or by the operator's words (all words must appear in the symptom or an alias). */
export function findSymptom(map: MachineSymptomMap, text: string): MachineSymptom | undefined {
  const byId = map.symptoms.find((s) => s.id === text);
  if (byId) return byId;
  const ws = norm(text).split(' ').filter((w) => w.length > 2);
  return map.symptoms.find((s) => [s.symptom, ...s.aliases].some((a) => ws.every((w) => norm(a).includes(w))));
}

/** Ranked causes of a symptom, most likely first. */
export function rankedCauses(s: MachineSymptom): SymptomCause[] {
  return [...s.causes].sort((a, b) => a.rank - b.rank);
}

/** Does a cause involve this part (by its device fault profiles or its category)? */
export function causeInvolves(c: SymptomCause, part: CatalogPart, profiles: DeviceFaultProfile[]): boolean {
  if (c.devices.categories?.includes(part.category)) return true;
  return (c.devices.profileIds ?? []).some((id) => profiles.some((p) => p.id === id && profileMatches(p.match, part)));
}
