/**
 * What pdf.js 5 calls that browsers don't all have yet: Map / WeakMap getOrInsert(Computed) and Math.sumPrecise
 * (2026 additions; Chromium 141 has neither). Installed on the page and inside pdf.js's worker (pdfjsWorkerShim.ts).
 */
export function installPdfPolyfills() {
  for (const C of [Map, WeakMap] as unknown as { prototype: Record<string, unknown> }[]) {
    const proto = C.prototype as unknown as {
      has(k: unknown): boolean; get(k: unknown): unknown; set(k: unknown, v: unknown): unknown;
      getOrInsert?: (k: unknown, v: unknown) => unknown; getOrInsertComputed?: (k: unknown, f: (k: unknown) => unknown) => unknown;
    };
    if (!proto.getOrInsert) Object.defineProperty(proto, 'getOrInsert', { configurable: true, writable: true, value(this: typeof proto, k: unknown, v: unknown) { if (!this.has(k)) this.set(k, v); return this.get(k); } });
    if (!proto.getOrInsertComputed) Object.defineProperty(proto, 'getOrInsertComputed', { configurable: true, writable: true, value(this: typeof proto, k: unknown, f: (k: unknown) => unknown) { if (!this.has(k)) this.set(k, f(k)); return this.get(k); } });
  }
  const M = Math as unknown as { sumPrecise?: (items: Iterable<number>) => number };
  // compensated (Neumaier) summation: what pdf.js sums are lengths and sizes, exact either way
  if (!M.sumPrecise) Object.defineProperty(Math, 'sumPrecise', { configurable: true, writable: true, value(items: Iterable<number>) {
    let sum = -0, c = 0;
    for (const x of items) {
      if (typeof x !== 'number') throw new TypeError('Math.sumPrecise: not a number');
      const t = sum + x;
      c += Math.abs(sum) >= Math.abs(x) ? (sum - t) + x : (x - t) + sum;
      sum = t;
    }
    return sum + c;
  } });
}
