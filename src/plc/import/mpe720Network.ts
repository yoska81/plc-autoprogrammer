/**
 * The rack's network modules in an MPE720 project, as far as the files say it for certain (layout read from a real
 * CPU-301 project by the side manager; the test builds synthetic files of the same layout):
 *   PRG/IOMAP/$SLT1003  SVC (MECHATROLINK): block 0x10E7 holds the record count, then one 37-byte record per axis:
 *                       +0 station address, +1 axis within the station (two-axis drives), +0x0A device type code
 *   PRG/IOMAP/$SLT1002  218IFD (Ethernet): block 0x112A holds the connection count, then one 129-byte record per
 *                       connection, its number in the byte 4 before it: +0x04 name (length-prefixed), +0x0A local
 *                       port, +0x10 remote port (LE)
 * Only these fields are read. The remote addresses are never kept, and nothing else is guessed: no module is made
 * up, and an I/O point gets a source only when its register lies in a range a file states (none of these does yet).
 */

export interface MechatrolinkAxis {
  /** Axis number on the circuit, in file order (1 = the first record, the drive of $SVP0101). */
  axis: number;
  /** MECHATROLINK station address, as MPE720 shows it (hex: "13"). */
  station: string;
  /** Axis within the station: 0 / 1 on a two-axis drive. */
  stationAxis: number;
  /** MPE720's device type code (not translated: the code → model table is not in the file). */
  deviceType: number;
}

export interface EthernetConnection {
  number: number;
  name: string;
  localPort: number;
  remotePort: number;
  /** Only what the port says for certain: 502 is Modbus TCP. */
  protocol?: 'Modbus TCP';
}

const u16 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);

/** First offset of a block id (2 bytes LE + 00 00) at a 16-byte boundary, or -1. */
function block(b: Uint8Array, id: number, from = 0): number {
  for (let at = from; at + 4 <= b.length; at += 16) if (u16(b, at) === id && b[at + 2] === 0 && b[at + 3] === 0) return at;
  return -1;
}

const STATION_RECORD = 0x25;

/** The SVC's axis records ($SLT1003); [] when the file is not there or not in the known layout. */
export function readSvcStations(b: Uint8Array): MechatrolinkAxis[] {
  const at = block(b, 0x10e7);
  if (at < 0) return [];
  const count = u16(b, at + 0x0a);
  const first = at + 0x10;
  if (!count || count > 64 || first + count * STATION_RECORD > b.length) return [];
  const out: MechatrolinkAxis[] = [];
  for (let i = 0; i < count; i++) {
    const r = first + i * STATION_RECORD;
    out.push({ axis: i + 1, station: b[r].toString(16).toUpperCase().padStart(2, '0'), stationAxis: b[r + 1], deviceType: b[r + 0x0a] });
  }
  return out;
}

const CONNECTION_RECORD = 0x81;

/** The 218IFD's connections that are set ($SLT1002); [] when the file is not there or not in the known layout. */
export function readEthernetConnections(b: Uint8Array): EthernetConnection[] {
  const at = block(b, 0x112a);
  if (at < 0) return [];
  const count = u16(b, at + 0x0a);
  if (!count || count > 64) return [];
  // The first record: number 1 four bytes before it, number 2 one record later.
  let first = -1;
  for (let p = at + 0x10; p + 4 + 2 * CONNECTION_RECORD < b.length; p++) if (b[p] === 1 && b[p + CONNECTION_RECORD] === 2) { first = p + 4; break; }
  if (first < 0) return [];
  const out: EthernetConnection[] = [];
  for (let i = 0; i < count; i++) {
    const r = first + i * CONNECTION_RECORD;
    if (r + CONNECTION_RECORD > b.length || b[r - 4] !== i + 1) break;
    const len = b[r + 4];
    const name = len && len < 32 ? String.fromCharCode(...b.subarray(r + 5, r + 5 + len)).replace(/[^\x20-\x7e]/g, '') : '';
    const localPort = u16(b, r + 0x0a), remotePort = u16(b, r + 0x10);
    if (!name && !localPort && !remotePort) continue; // not set
    out.push({ number: i + 1, name, localPort, remotePort, ...(remotePort === 502 ? { protocol: 'Modbus TCP' as const } : {}) });
  }
  return out;
}

/** One line each for the import notes. */
export function networkNotes(stations: MechatrolinkAxis[], connections: EthernetConnection[]): string[] {
  const out: string[] = [];
  if (stations.length) {
    const st = [...new Set(stations.map((s) => s.station))];
    out.push(`MECHATROLINK (SVC): ${st.length} station${st.length === 1 ? '' : 's'} / ${stations.length} ax${stations.length === 1 ? 'is' : 'es'}: ${stations.map((s) => `axis ${s.axis} on station ${s.station}${s.stationAxis ? ` (second axis)` : ''}`).join(', ')}.`);
  }
  if (connections.length) {
    out.push(`Ethernet (218IFD) connections: ${connections.map((c) => `${c.number}${c.name ? ` "${c.name}"` : ''}${c.protocol ? ` ${c.protocol}` : c.remotePort ? ` to port ${c.remotePort}` : ''}${c.localPort ? ` (local port ${c.localPort})` : ''}`).join('; ')}.`);
  }
  return out;
}
