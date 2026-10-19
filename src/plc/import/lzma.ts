/**
 * LZMA (LZMA1) decoder: the method 7-Zip archives use, and the one inside Yaskawa MPE720 project files
 * (.YMW7). Written from the algorithm of the public-domain LZMA SDK (Igor Pavlov): a range decoder
 * over adaptive bit probabilities, literals coded against the previous byte, and matches / repeats
 * of the last four distances.
 */

const PROB_INIT = 1024;
const TOP = 1 << 24;

class RangeDecoder {
  private range = 0xffffffff;
  private code = 0;
  private readonly buf: Uint8Array;
  private pos: number;
  constructor(buf: Uint8Array, pos: number) {
    this.buf = buf;
    this.pos = pos;
    if (buf[pos] !== 0) throw new Error('LZMA data is damaged (bad first byte).');
    this.pos++;
    for (let i = 0; i < 4; i++) this.code = ((this.code << 8) | this.byte()) >>> 0;
  }
  private byte(): number { return this.pos < this.buf.length ? this.buf[this.pos++] : 0; }
  private norm() {
    if (this.range < TOP) { this.range = (this.range << 8) >>> 0; this.code = ((this.code << 8) | this.byte()) >>> 0; }
  }
  bit(probs: Uint16Array, i: number): number {
    const p = probs[i];
    const bound = (this.range >>> 11) * p;
    let b: number;
    if (this.code < bound) { this.range = bound; probs[i] = p + ((2048 - p) >>> 5); b = 0; }
    else { this.range = (this.range - bound) >>> 0; this.code = (this.code - bound) >>> 0; probs[i] = p - (p >>> 5); b = 1; }
    this.norm();
    return b;
  }
  direct(n: number): number {
    let r = 0;
    for (let i = 0; i < n; i++) {
      this.range >>>= 1;
      const t = this.code >= this.range ? 1 : 0;
      if (t) this.code = (this.code - this.range) >>> 0;
      r = ((r << 1) | t) >>> 0;
      this.norm();
    }
    return r;
  }
  tree(probs: Uint16Array, base: number, bits: number): number {
    let m = 1;
    for (let i = 0; i < bits; i++) m = (m << 1) | this.bit(probs, base + m);
    return m - (1 << bits);
  }
  reverse(probs: Uint16Array, base: number, bits: number): number {
    let m = 1, r = 0;
    for (let i = 0; i < bits; i++) { const b = this.bit(probs, base + m); m = (m << 1) | b; r |= b << i; }
    return r;
  }
}

/** Length coder: choice bits, then 3 bits (low / mid, per position state) or 8 bits (high). */
class LenDecoder {
  private readonly choice = new Uint16Array(2).fill(PROB_INIT);
  private readonly low = new Uint16Array(16 << 3).fill(PROB_INIT);
  private readonly mid = new Uint16Array(16 << 3).fill(PROB_INIT);
  private readonly high = new Uint16Array(256).fill(PROB_INIT);
  decode(rc: RangeDecoder, posState: number): number {
    if (!rc.bit(this.choice, 0)) return rc.tree(this.low, posState << 3, 3);
    if (!rc.bit(this.choice, 1)) return 8 + rc.tree(this.mid, posState << 3, 3);
    return 16 + rc.tree(this.high, 0, 8);
  }
}

/**
 * Decode raw LZMA data. `props` is the 5-byte property block (lc/lp/pb byte, dictionary size) as 7-Zip
 * stores it with the coder; `outSize` is the unpacked size (7-Zip always knows it).
 */
export function lzmaDecode(props: Uint8Array, data: Uint8Array, outSize: number, offset = 0): Uint8Array {
  let d = props[0];
  if (d >= 9 * 5 * 5) throw new Error('LZMA properties are not valid.');
  const lc = d % 9; d = Math.floor(d / 9);
  const lp = d % 5; const pb = Math.floor(d / 5);
  const out = new Uint8Array(outSize);
  if (!outSize) return out;
  const rc = new RangeDecoder(data, offset);

  const literal = new Uint16Array(0x300 << (lc + lp)).fill(PROB_INIT);
  const isMatch = new Uint16Array(12 << 4).fill(PROB_INIT);
  const isRep = new Uint16Array(12).fill(PROB_INIT);
  const isRepG0 = new Uint16Array(12).fill(PROB_INIT);
  const isRepG1 = new Uint16Array(12).fill(PROB_INIT);
  const isRepG2 = new Uint16Array(12).fill(PROB_INIT);
  const isRep0Long = new Uint16Array(12 << 4).fill(PROB_INIT);
  const posSlot = new Uint16Array(4 << 6).fill(PROB_INIT);
  const posSpecial = new Uint16Array(115).fill(PROB_INIT);
  const align = new Uint16Array(16).fill(PROB_INIT);
  const lenDec = new LenDecoder();
  const repLenDec = new LenDecoder();
  const pbMask = (1 << pb) - 1, lpMask = (1 << lp) - 1;

  let state = 0, rep0 = 0, rep1 = 0, rep2 = 0, rep3 = 0, pos = 0;
  while (pos < outSize) {
    const posState = pos & pbMask;
    if (!rc.bit(isMatch, (state << 4) + posState)) {
      // literal, coded against the previous byte (and, after a match, the byte at rep0)
      const prev = pos ? out[pos - 1] : 0;
      const base = 0x300 * (((pos & lpMask) << lc) + (prev >> (8 - lc)));
      let sym = 1;
      if (state >= 7) {
        let matchByte = out[pos - rep0 - 1];
        while (sym < 0x100) {
          const mb = (matchByte >> 7) & 1; matchByte <<= 1;
          const b = rc.bit(literal, base + ((1 + mb) << 8) + sym);
          sym = (sym << 1) | b;
          if (mb !== b) break;
        }
      }
      while (sym < 0x100) sym = (sym << 1) | rc.bit(literal, base + sym);
      out[pos++] = sym & 0xff;
      state = state < 4 ? 0 : state < 10 ? state - 3 : state - 6;
      continue;
    }
    let len: number;
    if (rc.bit(isRep, state)) {
      if (!pos) throw new Error('LZMA data is damaged.');
      if (!rc.bit(isRepG0, state)) {
        if (!rc.bit(isRep0Long, (state << 4) + posState)) {
          state = state < 7 ? 9 : 11;
          out[pos] = out[pos - rep0 - 1]; pos++;
          continue;
        }
      } else {
        let dist: number;
        if (!rc.bit(isRepG1, state)) dist = rep1;
        else {
          if (!rc.bit(isRepG2, state)) dist = rep2;
          else { dist = rep3; rep3 = rep2; }
          rep2 = rep1;
        }
        rep1 = rep0; rep0 = dist;
      }
      len = repLenDec.decode(rc, posState);
      state = state < 7 ? 8 : 11;
    } else {
      rep3 = rep2; rep2 = rep1; rep1 = rep0;
      len = lenDec.decode(rc, posState);
      state = state < 7 ? 7 : 10;
      const slot = rc.tree(posSlot, (len < 4 ? len : 3) << 6, 6);
      if (slot < 4) rep0 = slot;
      else {
        const direct = (slot >> 1) - 1;
        let dist = ((2 | (slot & 1)) << direct) >>> 0;
        if (slot < 14) dist += rc.reverse(posSpecial, dist - slot - 1, direct);
        else dist += (rc.direct(direct - 4) << 4) + rc.reverse(align, 0, 4);
        rep0 = dist >>> 0;
        if (rep0 === 0xffffffff) break; // end marker
      }
      if (rep0 >= pos) throw new Error('LZMA data is damaged (distance beyond the start).');
    }
    len += 2;
    const from = pos - rep0 - 1;
    for (let i = 0; i < len && pos < outSize; i++) out[pos++] = out[from + i];
  }
  return out;
}
