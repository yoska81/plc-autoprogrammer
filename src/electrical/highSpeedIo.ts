/**
 * Which PLC points can carry pulse trains (PTO) and high-speed counter inputs, from the catalog ratings. The
 * program (motion.ts puts an axis's pulse there), the drawings (Dev 4's servo sheet) and the checkers all read
 * this one helper, so they agree.
 *   - A CPU with its own high-speed I/O (CLICK C0: hscInputs "X001-X004") gives it directly.
 *   - A CLICK PLUS CPU has none of its own ("Option Slot 0 module …"): the option-slot module's ratings give
 *     it ("Y1, Y3, Y5", "X1-X8"), at slot 0, so the addresses are Y001 / Y003 / Y005 and X001…X008.
 * A machine-readable `ptoPoints` / `hscPoints` list in the ratings wins over the text when the catalog has one.
 */
import { getPart } from './catalog';

export interface HighSpeedIo {
  /** Outputs that can drive a pulse train (one axis each), in order. */
  pulseOutputs: string[];
  /** Inputs that can count at high speed. */
  hsInputs: string[];
  /** Highest rates (kHz), when the ratings give them. */
  ptoKHz?: number;
  hscKHz?: number;
  /** Where the high-speed I/O is (e.g. "the C2-14D1 in option slot 0"), or why there is none. */
  note: string;
}

const pad = (letter: string, slot: number, n: number) => `${letter}${slot}${String(n).padStart(2, '0')}`;

/**
 * Points named in a ratings text, on a slot: "Y1, Y3, Y5" → Y001 / Y003 / Y005; "X1-X8" → X001…X008;
 * already full addresses ("X001-X004") are kept. The first alternative only ("Y1, Y3, Y5 (…) or Y1, Y3 (…)").
 */
export function pointsFromText(text: string, letter: 'X' | 'Y', slot = 0): string[] {
  const first = text.split(/\bor\b/i)[0];
  const out: string[] = [];
  for (const m of first.matchAll(new RegExp(`\\b${letter}(\\d{1,3})(?:\\s*-\\s*${letter}?(\\d{1,3}))?\\b`, 'gi'))) {
    const full = (n: string) => n.length === 3;
    const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
    if (full(m[1])) {
      const s = Number(m[1][0]), lo = Number(m[1].slice(1)), hi = m[2] ? Number(m[2].slice(-2)) : lo;
      for (let n = lo; n <= hi; n++) out.push(pad(letter, s, n));
    } else for (let n = a; n <= b; n++) out.push(pad(letter, slot, n));
  }
  return [...new Set(out)];
}

const list = (v: unknown): string[] | null => (Array.isArray(v) ? v.map((x) => String(x).toUpperCase()) : null);

/** The high-speed I/O of a CPU, with the option-slot module that gives it on a CLICK PLUS. */
export function highSpeedIo(cpuPart: string, modules: string[] = []): HighSpeedIo {
  const cpu = getPart(cpuPart);
  const r = cpu?.ratings ?? {};
  if (r.hscViaOptionSlot || /option slot/i.test(String(r.ptoOutputs ?? r.hscInputs ?? ''))) {
    const opt = modules.map((pn) => getPart(pn)).find((p) => /option slot/i.test(String(p?.ratings.moduleType ?? '')));
    if (!opt) return { pulseOutputs: [], hsInputs: [], note: `${cpuPart} has no high-speed I/O of its own: it is on the option-slot module (none chosen).` };
    const o = opt.ratings;
    return {
      pulseOutputs: list(o.ptoPoints) ?? pointsFromText(String(o.ptoOutputs ?? ''), 'Y', 0),
      hsInputs: list(o.hscPoints) ?? pointsFromText(String(o.hscInputs ?? ''), 'X', 0),
      ...(o.ptoMaxKHz ? { ptoKHz: Number(o.ptoMaxKHz) } : {}), ...(o.hscMaxKHz ? { hscKHz: Number(o.hscMaxKHz) } : {}),
      note: `On the ${opt.partNumber} in option slot 0.`,
    };
  }
  return {
    pulseOutputs: list(r.ptoPoints) ?? (r.ptoOutputs ? pointsFromText(String(r.ptoOutputs), 'Y', 0) : []),
    hsInputs: list(r.hscPoints) ?? (r.hscInputs ? pointsFromText(String(r.hscInputs), 'X', 0) : []),
    ...(r.ptoMaxKHz ? { ptoKHz: Number(r.ptoMaxKHz) } : {}), ...(r.hscMaxKHz ? { hscKHz: Number(r.hscMaxKHz) } : {}),
    note: r.ptoOutputs || r.hscInputs ? `On the ${cpuPart} itself.` : `${cpuPart}: no high-speed I/O in the catalog ratings.`,
  };
}

/** Pulse-train outputs (Dev 4's name for the drawings). */
export const ptoPointsFor = (cpuPart: string, modules: string[] = []) => highSpeedIo(cpuPart, modules).pulseOutputs;
/** High-speed counter inputs. */
export const hsInputsFor = (cpuPart: string, modules: string[] = []) => highSpeedIo(cpuPart, modules).hsInputs;
