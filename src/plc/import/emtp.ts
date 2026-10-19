/**
 * Weintek EasyBuilder Pro project (.emtp): the touch panel of the machine. A binary MFC archive whose
 * texts are UTF-16 strings (FF FE FF, a length byte, the characters). Read here: the program version,
 * the PLC driver, the windows (screens) by name, and the PLC addresses the objects use.
 *   A window: its name, then its width and height (u32 each) and zero bytes.
 *   An object's addresses: a run of device names ("Local HMI", "<driver>") one per address slot, a few
 *   bytes ending with one device-type code per slot, then the address texts. For the Yaskawa MP Memobus
 *   driver the codes read are 5 = MB (bit: word in decimal, bit in hex), 11 = MW, 12 = ML.
 */

export interface HmiProject {
  version: string;
  drivers: string[];
  screens: string[];
  /** PLC addresses the panel reads or writes, as MP addresses ("MB000237", "MW00400"), with how often. */
  addresses: Map<string, number>;
  /** Address slots on the PLC whose type code is not one of the above. */
  otherSlots: number;
}

const MARK = [0xff, 0xfe, 0xff];

function cstring(b: Uint8Array, p: number): { s: string; end: number } | null {
  if (b[p] !== MARK[0] || b[p + 1] !== MARK[1] || b[p + 2] !== MARK[2]) return null;
  let n = b[p + 3], q = p + 4;
  if (n === 0xff) { n = b[q] | (b[q + 1] << 8); q += 2; }
  if (q + 2 * n > b.length) return null;
  let s = '';
  for (let i = 0; i < n; i++) s += String.fromCharCode(b[q + 2 * i] | (b[q + 2 * i + 1] << 8));
  return { s, end: q + 2 * n };
}

export function isEmtp(name: string, bytes: Uint8Array): boolean {
  return /\.emtp$|\.emt$/i.test(name) && bytes.length > 16;
}

const MEMOBUS = /Memobus|Yaskawa MP/i;

export function readEmtp(bytes: Uint8Array): HmiProject {
  const head = cstring(bytes, 4);
  const version = head && /^\d+\.\d+/.test(head.s) ? head.s : '';
  const drivers = new Set<string>();
  const screens: string[] = [];
  const addresses = new Map<string, number>();
  let otherSlots = 0;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const isDevice = (s: string) => s === 'Local HMI' || (s.length < 80 && /^[\x20-\x7e]+$/.test(s) && (MEMOBUS.test(s) || /\(.*(PLC|Controller).*\)$/i.test(s)));
  let p = 0;
  while (p < bytes.length - 4) {
    if (bytes[p] !== 0xff || bytes[p + 1] !== 0xfe || bytes[p + 2] !== 0xff) { p++; continue; }
    const c = cstring(bytes, p);
    if (!c) { p++; continue; }
    // A window: printable name, then width and height and zero bytes.
    if (c.s && /^[\x20-\x7e]+$/.test(c.s) && !/^\d+$/.test(c.s) && c.end + 16 <= bytes.length) {
      const w = dv.getUint32(c.end, true), h = dv.getUint32(c.end + 4, true);
      if (w >= 100 && w <= 2000 && h >= 50 && h <= 1200 && dv.getUint32(c.end + 8, true) === 0 && dv.getUint32(c.end + 12, true) === 0) {
        if (!screens.includes(c.s)) screens.push(c.s);
        p = c.end; continue;
      }
    }
    if (!isDevice(c.s)) { p = c.end; continue; }
    const run = [c.s];
    let q = c.end;
    for (;;) { const n = cstring(bytes, q); if (!n || !isDevice(n.s)) break; run.push(n.s); q = n.end; }
    for (const d of run) if (d !== 'Local HMI') drivers.add(d);
    // the address texts start at the next string, within a few bytes; the type codes are just before it
    let g = q;
    while (g < Math.min(bytes.length - 3, q + 64) && !(bytes[g] === 0xff && bytes[g + 1] === 0xfe && bytes[g + 2] === 0xff)) g++;
    if (g >= q + 64 || g - q < run.length) { p = q; continue; }
    const types = bytes.subarray(g - run.length, g);
    let r = g;
    const texts: string[] = [];
    for (let i = 0; i < run.length; i++) { const a = cstring(bytes, r); if (!a) break; texts.push(a.s); r = a.end; }
    if (texts.length === run.length) {
      run.forEach((d, i) => {
        if (!MEMOBUS.test(d)) return;
        const a = texts[i].trim().toUpperCase();
        const t = types[i];
        let addr = '';
        if (t === 5 && /^[0-9A-F]+$/.test(a)) addr = `MB${a.padStart(6, '0')}`;
        else if (t === 11 && /^\d+$/.test(a)) addr = `MW${a.padStart(5, '0')}`;
        else if (t === 12 && /^\d+$/.test(a)) addr = `ML${a.padStart(5, '0')}`;
        if (addr) addresses.set(addr, (addresses.get(addr) ?? 0) + 1);
        else if (a && a !== '0') otherSlots++;
      });
      p = r;
    } else p = q;
  }
  return { version, drivers: [...drivers], screens, addresses, otherSlots };
}

/** Plain-words summary of the panel, matched against the PLC's register comments. */
export function hmiNotes(hmi: HmiProject, comments: (addr: string) => string | undefined, usedInProgram: (addr: string) => boolean): string[] {
  const addrs = [...hmi.addresses.keys()];
  const commented = addrs.filter((a) => comments(a));
  const inProgram = addrs.filter((a) => usedInProgram(a));
  return [
    `Touch panel (Weintek EasyBuilder Pro${hmi.version ? ` ${hmi.version}` : ''}${hmi.drivers.length ? `, ${hmi.drivers.join(', ')}` : ''}): ${hmi.screens.length} screens (${hmi.screens.slice(0, 40).join(', ')}${hmi.screens.length > 40 ? ', …' : ''}).`,
    `The panel uses ${addrs.length} PLC addresses: ${inProgram.length} of them appear in the ladder, ${commented.length} have a comment in the PLC project.${hmi.otherSlots ? ` ${hmi.otherSlots} more address slots are of a type not read here.` : ''}`,
  ];
}
