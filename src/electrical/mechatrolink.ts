/**
 * Network servo axes (Yaskawa MECHATROLINK-III): the axes come from the project's axis list (the imported program's
 * SVC / SVR definitions, Dev 2's useProjectStore.networkAxes) or the specification text, not from pulse / direction
 * outputs. Each real axis gets a MECHATROLINK-III SERVOPACK with safe torque off (HWBB), its motor and cables; a
 * two-axis SGD7W carries two axes. Virtual (SVR) axes get no hardware. The drives are daisy-chained from the CPU's
 * MECHATROLINK-III port: CN6A in, CN6B out, one JEPMC-W6012 cable per link, no terminator (MECHATROLINK-III
 * needs none: Yaskawa SIEP S800001 28, 4.7; KAEP C880725 03).
 */
import type { CatalogPart } from './types';

/** One axis as the project lists it (same shape as src/plc/core/networkAxes.ts NetworkAxis). */
export interface NetworkAxisInput {
  key: string;
  name: string;
  circuit: number;
  axis: number;
  kind?: 'servo' | 'virtual';
  drivePartNumber?: string;
  motorPartNumber?: string;
  watts?: number;
  source?: 'import' | 'spec' | 'user';
}

/**
 * Functions built into the MP3300 CPU-301 / CPU-302 that MPE720 lists as "modules" in the module configuration (an
 * imported .YMW7 shows them): never a part, never a BOM line, never an option slot (MP3300 manual SIEP C880725 21E,
 * self-configuration register map). SVC32 / SVR32 are the 32-axis CPU's versions.
 */
export const MP3300_BUILT_IN: Record<string, string> = {
  '218IFD': 'Ethernet (MEMOBUS / Extended MEMOBUS, EtherNet/IP, Modbus TCP), built into CPU-301 / CPU-302',
  SVC: 'MECHATROLINK-III motion (16 axes), built into CPU-301 / CPU-302 (-1-E)',
  SVC32: 'MECHATROLINK-III motion (32 axes), built into CPU-301 / CPU-302 (-2-E)',
  SVR: 'virtual axes (16), built into CPU-301 / CPU-302 (-1-E)',
  SVR32: 'virtual axes (32), built into CPU-301 / CPU-302 (-2-E)',
  'M-EXECUTOR': 'motion program executor, built into CPU-301 / CPU-302',
};
/** What an imported module name is when it is built into the CPU (null: a real option module or unknown). */
export const builtIntoCpu = (moduleName: string): string | null => MP3300_BUILT_IN[moduleName.trim().toUpperCase()] ?? null;

/** A CPU that commands its servo axes over MECHATROLINK-III (MP3300 CPU-301 / -302). */
export const isMechatrolinkCpu = (cpu: CatalogPart | undefined) => /MECHATROLINK-III/i.test(String(cpu?.ratings.motionNetwork ?? ''));

const PN = /\b(SG[DM][\w]*-[\w-]+)/gi;

/**
 * Axes from the specification text:
 * - "axis 1 (line 1): SGDV-280D21A with motor SGMGV-1ADDA61" (the program reader's axis summary) → axis 1 with those parts;
 * - "Axis 3 … 400 W" → axis 3 sized for 400 W;
 * - "8 axes" / "8 servo axes" → axes 1..8 when no axis is named.
 */
export function axesFromSpec(spec: string): NetworkAxisInput[] {
  const byKey = new Map<string, NetworkAxisInput>();
  const lines = spec.split(/\n|;\s*|\.\s+/);
  for (const line of lines) {
    const m = /\baxis\s*(\d{1,2})\b(?:\s*\((?:line|circuit)\s*(\d)\))?/i.exec(line);
    if (!m) continue;
    const n = Number(m[1]);
    const key = `ax${n}`;
    const a = byKey.get(key) ?? { key, name: `Axis ${n}`, circuit: Number(m[2] ?? 1), axis: n, kind: 'servo' as const, source: 'spec' as const };
    if (/\bvirtual\b|\bSVR\b/i.test(line)) a.kind = 'virtual';
    const pns = [...line.matchAll(PN)].map((x) => x[1].toUpperCase());
    const drive = pns.find((p) => /^SGD/.test(p));
    const motor = pns.find((p) => /^SGM/.test(p));
    if (drive) a.drivePartNumber = drive;
    if (motor) a.motorPartNumber = motor;
    // the power figure, never a part number's digits ("SGD7W-…" is not 7 W)
    const w = /(?<![\w-])(\d+(?:\.\d+)?)\s*(kw|w)\b/i.exec(line.replace(PN, ' '));
    if (w) a.watts = Number(w[1]) * (/kw/i.test(w[2]) ? 1000 : 1);
    byKey.set(key, a);
  }
  if (!byKey.size) {
    const count = /\b(\d{1,2})\s*(?:servo\s*)?(?:axes|axis)\b/i.exec(spec);
    for (let n = 1; n <= Number(count?.[1] ?? 0); n++) byKey.set(`ax${n}`, { key: `ax${n}`, name: `Axis ${n}`, circuit: 1, axis: n, kind: 'servo', source: 'spec' });
  }
  return [...byKey.values()].sort((a, b) => a.circuit - b.circuit || a.axis - b.axis);
}
