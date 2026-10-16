/**
 * IEC 81346-2 product designations for a design made with NFPA-style tags: CB1 → -Q1, MCR → -K2,
 * PS1 → -T1, PB3 → -S3… Tags are renumbered per class letter (CB1 and DS1 cannot both become
 * -Q1) in natural order; suffixes stay (FU1A → -F1A, K1-AUX → -K1-AUX). Applied to a copy of the
 * design (and the machine layout) when the drawing context is built, so every output agrees.
 */
import type { ElectricalDesign } from '../electrical/types';

const CLASS: [RegExp, string][] = [
  [/^(DS|MDS|CB|MCB|MPCB|MMS|MP|QF|Q)$/, 'Q'],
  [/^(FU|F|OL)$/, 'F'],
  [/^(M|MTR|SOL|YV)$/, 'M'],
  [/^(K|CR|MCR|SR|SFT|C|PLC|CPU|A)$/, 'K'],
  [/^(PS|T|XFMR|VFD|U|DR)$/, 'T'],
  [/^(PB|SS|ES|ESTOP|SW)$/, 'S'],
  [/^(LS|PX|PE|PRS|PRX|B|SEN|PS?W)$/, 'B'],
  [/^(PL|LT|L|SL|H|HMI)$/, 'P'],
  [/^(TB|X|TS)$/, 'X'],
  [/^(ENC|SP|JB)$/, 'U'],
];

const parse = (tag: string) => tag.match(/^([A-Z]+)(\d*)([A-Z]?(?:-.*)?)$/);

/** Map of every base tag (prefix + number) to its IEC designation. */
export function designationMap(tags: string[]): Map<string, string> {
  const bases = new Map<string, { letter: string; prefix: string; num: number }>();
  for (const t of tags) {
    const m = parse(t.toUpperCase());
    if (!m) continue;
    const base = m[1] + m[2];
    if (bases.has(base)) continue;
    const letter = CLASS.find(([re]) => re.test(m[1]))?.[1];
    if (letter) bases.set(base, { letter, prefix: m[1], num: m[2] ? Number(m[2]) : 0 });
  }
  const out = new Map<string, string>();
  const next = new Map<string, number>();
  // Natural order inside a class: by original prefix, then number (CB1, CB2, DS1 → -Q1, -Q2, -Q3).
  const sorted = [...bases].sort(([, a], [, b]) => a.letter.localeCompare(b.letter) || a.prefix.localeCompare(b.prefix) || a.num - b.num);
  for (const [base, b] of sorted) {
    const n = (next.get(b.letter) ?? 0) + 1;
    next.set(b.letter, n);
    out.set(base, `-${b.letter}${n}`);
  }
  return out;
}

/** Replace whole-word tags (with their suffixes) in a text. */
export function renameTags(text: string, map: Map<string, string>): string {
  if (!map.size) return text;
  return text.replace(/(?<![A-Za-z0-9:-])([A-Z]+\d*)(?=[A-Z]?(?:-|:|\b|$))/g, (w) => map.get(w) ?? w);
}

const SKIP = new Set(['partNumber', 'address', 'generatedAt']);

function deep<T>(v: T, map: Map<string, string>, key = ''): T {
  if (typeof v === 'string') return (SKIP.has(key) ? v : renameTags(v, map)) as T;
  if (Array.isArray(v)) return v.map((x) => deep(x, map, key)) as T;
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) o[SKIP.has(k) ? k : renameTags(k, map)] = deep(x, map, k);
    return o as T;
  }
  return v;
}

/** Tags the design names: components, field devices, motors, junction boxes. */
export function designTags(d: ElectricalDesign): string[] {
  return [
    ...d.components.map((c) => c.tag), ...d.ioWiring.map((w) => w.deviceTag), ...d.inputs.motors.map((m) => m.tag),
    ...(d.machine?.junctionBoxes ?? []).map((j) => j.tag),
  ].filter(Boolean);
}

/** The design (and anything else keyed by its tags, e.g. the machine layout) with IEC designations. */
export function withIecDesignations<D extends ElectricalDesign, L>(design: D, layout?: L): { design: D; layout: L | undefined; map: Map<string, string> } {
  const map = designationMap(designTags(design));
  return { design: deep(design, map), layout: layout === undefined ? undefined : deep(layout, map), map };
}
