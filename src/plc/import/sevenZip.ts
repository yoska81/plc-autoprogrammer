/**
 * A small 7-Zip archive reader: enough for the archives programming software writes (Yaskawa MPE720
 * keeps its project as a 7z inside the .YMW7 file). Reads the (possibly LZMA-packed) header, the
 * folders and the file names; decodes folders packed with LZMA or stored as they are. Other methods
 * (LZMA2, BCJ, encryption) are refused with a plain message.
 */
import { lzmaDecode } from './lzma';

export const SEVEN_ZIP_SIGNATURE = [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c];

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
  byte(): number {
    if (this.p >= this.b.length) throw new Error('The 7z archive is cut short.');
    return this.b[this.p++];
  }
  /** 7z variable-length number: the leading 1 bits of the first byte say how many bytes follow. */
  num(): number {
    const first = this.byte();
    let mask = 0x80, value = 0;
    for (let i = 0; i < 8; i++) {
      if ((first & mask) === 0) return value + (first & (mask - 1)) * 2 ** (8 * i);
      value += this.byte() * 2 ** (8 * i);
      mask >>= 1;
    }
    return value;
  }
  bytes(n: number): Uint8Array { const s = this.b.subarray(this.p, this.p + n); this.p += n; return s; }
  bits(n: number): boolean[] {
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

function skipDigests(r: Reader, n: number) {
  const def = r.defined(n);
  r.p += def.filter(Boolean).length * 4;
}

function readStreams(r: Reader): Streams {
  const s: Streams = { packPos: 0, packSizes: [], folders: [], perFolder: [], sizes: [], folderCrc: [] };
  let subRead = false;
  for (;;) {
    const id = r.byte();
    if (id === ID.end) break;
    if (id === ID.packInfo) {
      s.packPos = r.num();
      const n = r.num();
      for (let t = r.byte(); t !== ID.end; t = r.byte()) {
        if (t === ID.size) for (let i = 0; i < n; i++) s.packSizes.push(r.num());
        else if (t === ID.crc) skipDigests(r, n);
        else throw new Error('The 7z archive has an unknown pack field.');
      }
    } else if (id === ID.unpackInfo) {
      if (r.byte() !== ID.folder) throw new Error('The 7z archive has no folder list.');
      const n = r.num();
      if (r.byte() !== 0) throw new Error('The 7z archive keeps its folders elsewhere (not supported).');
      let packIndex = 0;
      for (let f = 0; f < n; f++) {
        const coders: Coder[] = [];
        let outs = 0, ins = 0;
        const nc = r.num();
        for (let c = 0; c < nc; c++) {
          const flag = r.byte();
          const method = [...r.bytes(flag & 0x0f)].map((x) => x.toString(16).padStart(2, '0')).join('');
          let ni = 1, no = 1;
          if (flag & 0x10) { ni = r.num(); no = r.num(); }
          const props = flag & 0x20 ? r.bytes(r.num()) : new Uint8Array(0);
          coders.push({ method, props });
          ins += ni; outs += no;
        }
        for (let i = 0; i < outs - 1; i++) { r.num(); r.num(); }
        const packed = ins - (outs - 1);
        if (packed > 1) for (let i = 0; i < packed; i++) r.num();
        s.folders.push({ coders, unpackSizes: [], packIndex });
        packIndex += packed;
      }
      if (r.byte() !== ID.unpackSize) throw new Error('The 7z archive has no unpacked sizes.');
      // one unpacked size per coder output (one coder, one output, for the folders this reader decodes)
      for (const f of s.folders) for (let i = 0; i < f.coders.length; i++) f.unpackSizes.push(r.num());
      s.folderCrc = s.folders.map(() => false);
      for (let t = r.byte(); t !== ID.end; t = r.byte()) {
        if (t === ID.crc) { s.folderCrc = r.defined(s.folders.length); r.p += s.folderCrc.filter(Boolean).length * 4; }
        else throw new Error('The 7z archive has an unknown folder field.');
      }
    } else if (id === ID.subStreams) {
      subRead = true;
      s.perFolder = s.folders.map(() => 1);
      let t = r.byte();
      if (t === ID.numUnpackStream) { s.perFolder = s.folders.map(() => r.num()); t = r.byte(); }
      const sizesGiven = t === ID.size;
      s.folders.forEach((f, i) => {
        const n = s.perFolder[i];
        if (!n) return;
        let sum = 0;
        for (let k = 0; k < n - 1; k++) { const v = sizesGiven ? r.num() : 0; s.sizes.push(v); sum += v; }
        s.sizes.push(f.unpackSizes[f.unpackSizes.length - 1] - sum);
      });
      if (sizesGiven) t = r.byte();
      while (t !== ID.end) {
        if (t === ID.crc) skipDigests(r, s.perFolder.reduce((a, n, i) => a + (n === 1 && s.folderCrc[i] ? 0 : n), 0));
        else throw new Error('The 7z archive has an unknown stream field.');
        t = r.byte();
      }
    } else throw new Error('The 7z archive has an unknown streams field.');
  }
  if (!subRead) { s.perFolder = s.folders.map(() => 1); s.sizes = s.folders.map((f) => f.unpackSizes[f.unpackSizes.length - 1]); }
  return s;
}

function unpackFolder(archive: Uint8Array, base: number, s: Streams, fi: number): Uint8Array {
  const f = s.folders[fi];
  if (f.coders.length !== 1) throw new Error('This 7z archive uses filters this reader does not decode.');
  let start = base + 32 + s.packPos;
  for (let i = 0; i < f.packIndex; i++) start += s.packSizes[i];
  const packed = archive.subarray(start, start + s.packSizes[f.packIndex]);
  const size = f.unpackSizes[f.unpackSizes.length - 1];
  const { method, props } = f.coders[0];
  if (method === '00') return packed.slice(0, size);
  if (method === '030101') return lzmaDecode(props, packed, size);
  if (/^06f1/.test(method)) throw new Error('This 7z archive is protected with a password.');
  throw new Error(`This 7z archive is packed with a method this reader does not decode (${method === '21' ? 'LZMA2' : method}).`);
}

/** The files of the 7z archive starting at `base` in `bytes`. Folders (directories) are left out. */
export function readSevenZip(bytes: Uint8Array, base = 0): SevenZipEntry[] {
  for (let k = 0; k < 6; k++) if (bytes[base + k] !== SEVEN_ZIP_SIGNATURE[k]) throw new Error('This is not a 7z archive.');
  const dv = new DataView(bytes.buffer, bytes.byteOffset + base);
  const nextOff = dv.getUint32(12, true) + dv.getUint32(16, true) * 2 ** 32;
  const nextSize = dv.getUint32(20, true);
  const at = base + 32 + nextOff;
  if (at + nextSize > bytes.length) throw new Error('The 7z archive is cut short (the file was not uploaded whole).');
  let header = bytes.subarray(at, at + nextSize);
  let r = new Reader(header);
  let id = r.byte();
  while (id === ID.encodedHeader) {
    const s = readStreams(r);
    header = unpackFolder(bytes, base, s, 0);
    r = new Reader(header);
    id = r.byte();
  }
  if (id !== ID.header) throw new Error('The 7z archive header is not readable.');
  let streams: Streams = { packPos: 0, packSizes: [], folders: [], perFolder: [], sizes: [], folderCrc: [] };
  const names: string[] = [];
  let empty: boolean[] = [];
  let emptyFile: boolean[] = [];
  for (let t = r.byte(); t !== ID.end; t = r.byte()) {
    if (t === ID.archiveProps) { for (let p = r.byte(); p !== ID.end; p = r.byte()) r.p += r.num(); }
    else if (t === ID.additionalStreams) readStreams(r);
    else if (t === ID.mainStreams) streams = readStreams(r);
    else if (t === ID.files) {
      const n = r.num();
      empty = new Array<boolean>(n).fill(false);
      for (let p = r.byte(); p !== ID.end; p = r.byte()) {
        const size = r.num();
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
        }
        r.p = end;
      }
    } else throw new Error('The 7z archive header has an unknown field.');
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
    if (folder >= streams.folders.length) throw new Error('The 7z archive lists more files than it holds.');
    unpacked ??= unpackFolder(bytes, base, streams, folder);
    const size = streams.sizes[stream++];
    out.push({ name: names[i].replace(/\\/g, '/'), data: unpacked.subarray(offset, offset + size) });
    offset += size; inFolder++;
  }
  return out;
}
