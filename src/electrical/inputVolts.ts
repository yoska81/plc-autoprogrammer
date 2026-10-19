/**
 * The AC input voltages a part takes, from its catalog text: ranges in any of the catalogs' forms ("380-480 VAC",
 * "85~264VAC", "85…265V AC", "3 x 400-500 VAC"), nominal lists ("120/230 VAC" auto-range, "120/240VAC": each within
 * -15 % / +10 %), DC parts and line-to-neutral ranges ("100-120VAC L-N") left out. Empty when the text states none.
 */
export function acInputRanges(text: string): [number, number][] {
  const out: [number, number][] = [];
  const t = text.replace(/\(\s*[-+]?\d+\s*%[^)]*\)/g, ' ');
  for (const seg of t.split(/[,;()]|\bor\b/i)) {
    if (/L-N/i.test(seg)) continue;
    // "a-b VAC / c-d VDC": the parts of a "/" that are DC are not AC inputs
    const parts = seg.split(/\s*\/\s*(?=\d)/);
    for (const part of parts) {
      if (/V\s*DC|VDC/i.test(part) && !/V\s*AC|VAC/i.test(part)) continue;
      const r = /(\d{2,3})\s*(?:-|~|…|\.\.\.|to)\s*(\d{2,3})/.exec(part);
      if (r) { out.push([Number(r[1]), Number(r[2])]); continue; }
      const n = /(?<![\d.])(\d{2,3})(?![\d.%])/.exec(part);
      if (n && Number(n[1]) >= 24) out.push([Math.round(Number(n[1]) * 0.85), Math.round(Number(n[1]) * 1.1)]);
    }
  }
  return out;
}

/** Does the part take this AC voltage (true when its text states no AC input)? */
export const takesAc = (text: string, volts: number): boolean => {
  const r = acInputRanges(text);
  return !r.length || r.some(([lo, hi]) => lo <= volts && volts <= hi);
};
