/**
 * A small 7-Zip archive reader: enough for the archives programming software writes (Yaskawa MPE720
 * keeps its project as a 7z inside the .YMW7 file). Reads the (possibly LZMA-packed) header, the
 * folders and the file names; decodes folders packed with LZMA or stored as they are. Other methods
 * (LZMA2, BCJ, encryption) are refused with a plain message.
 *
 * Every count and size in the archive is checked against what the file can hold before it is used, so
 * a damaged or hostile file fails at once (DamagedData) instead of allocating gigabytes or looping:
 * an entry unpacks to at most MAX_UNPACKED, and all entries together to at most RATIO × the file size.
 */
import { DamagedData, lzmaDecode, MAX_UNPACKED } from './lzma';

export { DamagedData } from './lzma';

export const SEVEN_ZIP_SIGNATURE = [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c];

/** Most the whole archive may unpack to, as a multiple of its packed size (with a floor for tiny files). */
export const RATIO = 200;
const MIN_BUDGET = 1024 * 1024;

export interface SevenZipEntry { name: string; data: Uint8Array }

/** Where a 7z archive starts in `bytes` (some files wrap one after their own header), or -1. */
export function findSevenZip(bytes: Uint8Array, from = 0, within = 4096): number {
  const end = Math.min(bytes.length - 32, from + within);
  outer: for (let i = from; i <= end; i++) {
    for (let k = 0; k < 6; k++) if (bytes[i + k] !== SEVEN_ZIP_SIGNATURE[k]) continue outer;
    return i;
  }
  return -1;
}

const ID = { end: 0x00, header: 0x01, archiveProps: 0x02, additionalStreams: 0x03, mainStreams: 0x04, files: 0x05, packInfo: 0x06, unpackInfo: 0x07, subStreams: 0x08, size: 0x09, crc: 0x0a, folder: 0x0b, unpackSize: 0x0c, numUnpackStream: 0x0d, emptyStream: 0x0e, emptyFile: 0x0f, name: 0x11, encodedHeader: 0x17 } as const;

class Reader {
  private readonly b: Uint8Array;
  p: number;
  constructor(b: Uint8Array, p = 0) { this.b = b; this.p = p; }
  get left(): number { return this.b.length - this.p; }
  byte(): number {
    if (this.p >= this.b.length) throw new DamagedData('its header is cut short');
    return this.b[this.p++];
  }
  /** 7z variable-length number: the leading 1 bits of the first byte say how many bytes follow. */
  num(): number {
    const first = this.byte();
    let mask = 0x80, value = 0;
    for (let i = 0; i < 8; i++) {
      if ((first & mask) === 0) { value += (first & (mask - 1)) * 2 ** (8 * i); break; }
      value += this.byte() * 2 ** (8 * i);
      mask >>= 1;
    }
    if (!Number.isSafeInteger(value)) throw new DamagedData('a number in its header is out of range');
    return value;
  }
  /** A count of items that each take at least `bits` bits of the header that is left. */
  count(bits = 8): number {
    const n = this.num();
    if (n > this.left * (8 / bits)) throw new DamagedData(`its header lists ${n} items it has no room for`);
    return n;
  }
  bytes(n: number): Uint8Array {
    if (n > this.left) throw new DamagedData('its header is cut short');
    const s = this.b.subarray(this.p, this.p + n); this.p += n; return s;
  }
  skip(n: number) { this.bytes(n); }
  seek(p: number) { if (p < this.p || p > this.b.length) throw new DamagedData('its header is cut short'); this.p = p; }
  bits(n: number): boolean[] {
    if (n > this.left * 8) throw new DamagedData('its header is cut short');
    const out: boolean[] = [];
    let cur = 0, mask = 0;
    for (let i = 0; i < n; i++) {
      if (!mask) { cur = this.byte(); mask = 0x80; }
      out.push((cur & mask) !== 0); mask >>= 1;
    }
    return out;
  }
  /** "All defined" byte, else a bit field. */
  defined(n: number): boolean[] { return this.byte() ? new Array<boolean>(n).fill(true) : this.bits(n); }
}

interface Coder { method: string; props: Uint8Array }
interface Folder { coders: Coder[]; unpackSizes: number[]; packIndex: number }
interface Streams { packPos: number; packSizes: number[]; folders: Folder[]; perFolder: number[]; sizes: number[]; folderCrc: boolean[] }

/** What the archive may still unpack to, shared by the header and the files. */
interface Budget { left: number }

function skipDigests(r: Reader, n: number) {
  const def = r.defined(n);
  r.skip(def.filter(Boolean).length * 4);
}

function readStreams(r: Reader, archiveSize: number): Streams {
  const s: Streams = { packPos: 0, packSizes: [], folders: [], perFolder: [], sizes: [], folderCrc: [] };
  let subRead = false;
  for (;;) {
    const id = r.byte();
    if (id === ID.end) break;
    if (id === ID.packInfo) {
      s.packPos = r.num();
      const n = r.count();
      for (let t = r.byte(); t !== ID.end; t = r.byte()) {
        if (t === ID.size) for (let i = 0; i < n; i++) {
          const v = r.num();
          if (v > archiveSize) throw new DamagedData(`a packed part claims ${v} bytes, more than the file holds`);
          s.packSizes.push(v);
        }
        else if (t === ID.crc) skipDigests(r, n);
        else throw new DamagedData('its header has an unknown pack field');
      }
    } else if (id === ID.unpackInfo) {
      if (r.byte() !== ID.folder) throw new DamagedData('its header has no folder list');
      const n = r.count();
      if (r.byte() !== 0) throw new Error('The 7z archive keeps its folders elsewhere (not supported).');
      let packIndex = 0;
      for (let f = 0; f < n; f++) {
        const coders: Coder[] = [];
        let outs = 0, ins = 0;
        const nc = r.count();
        if (nc > 4) throw new DamagedData(`a folder lists ${nc} packing methods`);
        for (let c = 0; c < nc; c++) {
          const flag = r.byte();
          const method = [...r.bytes(flag & 0x0f)].map((x) => x.toString(16).padStart(2, '0')).join('');
          let ni = 1, no = 1;
          if (flag & 0x10) { ni = r.count(); no = r.count(); }
          if (ni > 4 || no > 4) throw new DamagedData('a packing method lists too many streams');
          const props = flag & 0x20 ? r.bytes(r.count()) : new Uint8Array(0);
          coders.push({ method, props });
          ins += ni; outs += no;
        }
        for (let i = 0; i < outs - 1; i++) { r.num(); r.num(); }
        const packed = ins - (outs - 1);
        if (packed > 1) for (let i = 0; i < packed; i++) r.num();
        s.folders.push({ coders, unpackSizes: [], packIndex });
        packIndex += Math.max(packed, 0);
      }
      if (r.byte() !== ID.unpackSize) throw new DamagedData('its header has no unpacked sizes');
      // one unpacked size per coder output (one coder, one output, for the folders this reader decodes)
      for (const f of s.folders) for (let i = 0; i < f.coders.length; i++) {
        const v = r.num();
        if (v > MAX_UNPACKED) throw new DamagedData(`an entry claims ${v} bytes`);
        f.unpackSizes.push(v);
      }
      s.folderCrc = s.folders.map(() => false);
      for (let t = r.byte(); t !== ID.end; t = r.byte()) {
        if (t === ID.crc) { s.folderCrc = r.defined(s.folders.length); r.skip(s.folderCrc.filter(Boolean).length * 4); }
        else throw new DamagedData('its header has an unknown folder field');
      }
    } else if (id === ID.subStreams) {
      subRead = true;
      s.perFolder = s.folders.map(() => 1);
      let t = r.byte();
      if (t === ID.numUnpackStream) { s.perFolder = s.folders.map(() => r.count(1)); t = r.byte(); }
      const sizesGiven = t === ID.size;
      s.folders.forEach((f, i) => {
        const n = s.perFolder[i];
        if (!n) return;
        const total = f.unpackSizes[f.unpackSizes.length - 1] ?? 0;
        let sum = 0;
        for (let k = 0; k < n - 1; k++) { const v = sizesGiven ? r.num() : 0; s.sizes.push(v); sum += v; }
        if (sum > total) throw new DamagedData('its files add up to more than their folder');
        s.sizes.push(total - sum);
      });
      if (sizesGiven) t = r.byte();
      while (t !== ID.end) {
        if (t === ID.crc) skipDigests(r, s.perFolder.reduce((a, n, i) => a + (n === 1 && s.folderCrc[i] ? 0 : n), 0));
        else throw new DamagedData('its header has an unknown stream field');
        t = r.byte();
      }
    } else throw new DamagedData('its header has an unknown streams field');
  }
  if (!subRead) { s.perFolder = s.folders.map(() => 1); s.sizes = s.folders.map((f) => f.unpackSizes[f.unpackSizes.length - 1] ?? 0); }
  return s;
}

function unpackFolder(archive: Uint8Array, base: number, s: Streams, fi: number, budget: Budget): Uint8Array {
  const f = s.folders[fi];
  if (!f) throw new DamagedData('a folder is missing');
  if (f.coders.length !== 1) throw new Error('This 7z archive uses filters this reader does not decode.');
  if (f.packIndex >= s.packSizes.length) throw new DamagedData('a packed part is missing');
  let start = base + 32 + s.packPos;
  for (let i = 0; i < f.packIndex; i++) start += s.packSizes[i];
  const len = s.packSizes[f.packIndex];
  if (start + len > archive.length) throw new DamagedData('it is cut short (the file was not uploaded whole?)');
  const packed = archive.subarray(start, start + len);
  const size = f.unpackSizes[f.unpackSizes.length - 1];
  if (size > budget.left) throw new DamagedData(`it claims to unpack to far more than its size (${size} bytes)`);
  budget.left -= size;
  const { method, props } = f.coders[0];
  if (method === '00') {
    if (size > packed.length) throw new DamagedData('a stored part is cut short');
    return packed.slice(0, size);
  }
  if (method === '030101') return lzmaDecode(props, packed, size);
  if (/^06f1/.test(method)) throw new Error('This 7z archive is protected with a password.');
  throw new Error(`This 7z archive is packed with a method this reader does not decode (${method === '21' ? 'LZMA2' : method}).`);
}

/** The files of the 7z archive starting at `base` in `bytes`. Folders (directories) are left out. */
export function readSevenZip(bytes: Uint8Array, base = 0): SevenZipEntry[] {
  if (base < 0 || base + 32 > bytes.length) throw new DamagedData('it is cut short');
  for (let k = 0; k < 6; k++) if (bytes[base + k] !== SEVEN_ZIP_SIGNATURE[k]) throw new Error('This is not a 7z archive.');
  const archiveSize = bytes.length - base;
  const budget: Budget = { left: Math.max(archiveSize * RATIO, MIN_BUDGET) };
  const dv = new DataView(bytes.buffer, bytes.byteOffset + base);
  const nextOff = dv.getUint32(12, true) + dv.getUint32(16, true) * 2 ** 32;
  const nextSize = dv.getUint32(20, true) + dv.getUint32(24, true) * 2 ** 32;
  const at = base + 32 + nextOff;
  if (at + nextSize > bytes.length) throw new DamagedData('it is cut short (the file was not uploaded whole?)');
  let header = bytes.subarray(at, at + nextSize);
  let r = new Reader(header);
  let id = r.byte();
  for (let depth = 0; id === ID.encodedHeader; depth++) {
    if (depth >= 4) throw new DamagedData('its header is packed too many times');
    const s = readStreams(r, archiveSize);
    header = unpackFolder(bytes, base, s, 0, budget);
    r = new Reader(header);
    id = r.byte();
  }
  if (id !== ID.header) throw new DamagedData('its header is not readable');
  let streams: Streams = { packPos: 0, packSizes: [], folders: [], perFolder: [], sizes: [], folderCrc: [] };
  const names: string[] = [];
  let empty: boolean[] = [];
  let emptyFile: boolean[] = [];
  for (let t = r.byte(); t !== ID.end; t = r.byte()) {
    if (t === ID.archiveProps) { for (let p = r.byte(); p !== ID.end; p = r.byte()) r.skip(r.num()); }
    else if (t === ID.additionalStreams) readStreams(r, archiveSize);
    else if (t === ID.mainStreams) streams = readStreams(r, archiveSize);
    else if (t === ID.files) {
      const n = r.count(1);
      empty = new Array<boolean>(n).fill(false);
      for (let p = r.byte(); p !== ID.end; p = r.byte()) {
        const size = r.num();
        if (size > r.left) throw new DamagedData('its file list is cut short');
        const end = r.p + size;
        if (p === ID.emptyStream) empty = r.bits(n);
        else if (p === ID.emptyFile) emptyFile = r.bits(empty.filter(Boolean).length);
        else if (p === ID.name) {
          if (r.byte() !== 0) throw new Error('The 7z archive keeps its file names elsewhere (not supported).');
          const raw = r.bytes(end - r.p);
          let cur = '';
          for (let i = 0; i + 1 < raw.length; i += 2) {
            const c = raw[i] | (raw[i + 1] << 8);
            if (c === 0) { names.push(cur); cur = ''; } else cur += String.fromCharCode(c);
          }
          if (names.length > n) throw new DamagedData('it names more files than it lists');
        }
        r.seek(end);
      }
    } else throw new DamagedData('its header has an unknown field');
  }
  // Files with data, in order, are the streams of the folders, in order.
  const out: SevenZipEntry[] = [];
  let folder = 0, inFolder = 0, offset = 0, stream = 0, emptyIndex = 0;
  let unpacked: Uint8Array | null = null;
  for (let i = 0; i < names.length; i++) {
    if (empty[i]) {
      const isFile = emptyFile[emptyIndex++] ?? false;
      if (isFile) out.push({ name: names[i], data: new Uint8Array(0) });
      continue;
    }
    while (folder < streams.folders.length && inFolder >= streams.perFolder[folder]) { folder++; inFolder = 0; offset = 0; unpacked = null; }
    if (folder >= streams.folders.length || stream >= streams.sizes.length) throw new DamagedData('it lists more files than it holds');
    unpacked ??= unpackFolder(bytes, base, streams, folder, budget);
    const size = streams.sizes[stream++];
    if (offset + size > unpacked.length) throw new DamagedData('a file runs past the end of its folder');
    out.push({ name: names[i].replace(/\\/g, '/'), data: unpacked.subarray(offset, offset + size) });
    offset += size; inFolder++;
  }
  return out;
}
