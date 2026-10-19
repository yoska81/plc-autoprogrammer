/// <reference types="node" />
/**
 * The SVC (MECHATROLINK) and 218IFD (Ethernet) set-up of an MPE720 project: synthetic files in the layout of a real
 * CPU-301 project ($SLT1003 / $SLT1002, made-up values, no real addresses). Only the certain fields are read: the
 * station of each axis (two axes on one station = one two-axis drive), the connections' number, name and ports.
 * And "Use this program" gives the project its servo axes (the electrical design draws servo drives from them).
 *   npx tsx src/plc/import/mpe720Network.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkNotes, readEthernetConnections, readSvcStations } from './mpe720Network';
import { networkAxesFrom } from './ui/applyUpgrade';

const put16 = (b: Uint8Array, at: number, v: number) => { b[at] = v & 0xff; b[at + 1] = v >> 8; };

// SVC: block 0x10E7 at 0x50 with 8 records of 37 bytes from 0x60 (station, axis in station, …, +0x0A device type).
const svc = new Uint8Array(0x60 + 8 * 0x25 + 0x20);
put16(svc, 0x50, 0x10e7); put16(svc, 0x58, 1); put16(svc, 0x5a, 8);
const plan: [number, number, number][] = [[0x13, 0, 0x20], [0x23, 0, 0x25], [0x23, 1, 0x25], [0x43, 0, 0x25], [0x53, 0, 0x20], [0x63, 0, 0x25], [0x63, 1, 0x25], [0x43, 1, 0x25]];
plan.forEach(([st, ax, type], i) => { const r = 0x60 + i * 0x25; svc[r] = st; svc[r + 1] = ax; svc[r + 0x0a] = type; });
const stations = readSvcStations(svc);
assert.equal(stations.length, 8);
assert.deepEqual(stations.map((s) => `${s.axis}:${s.station}/${s.stationAxis}`), ['1:13/0', '2:23/0', '3:23/1', '4:43/0', '5:53/0', '6:63/0', '7:63/1', '8:43/1']);
assert.equal(new Set(stations.map((s) => s.station)).size, 5, '5 stations, 8 axes');
assert.deepEqual(readSvcStations(new Uint8Array(64)), [], 'another file: nothing read, nothing made up');

// 218IFD: block 0x112A at 0x200 with 20 connections of 129 bytes, each number 4 bytes before its record.
const first = 0x29c;
const ifd = new Uint8Array(first + 20 * 0x81 + 16);
put16(ifd, 0x200, 0x112a); put16(ifd, 0x20a, 20);
for (let i = 0; i < 20; i++) ifd[first + i * 0x81 - 4] = i + 1;
const conn = (i: number, name: string, local: number, remote: number) => {
  const r = first + i * 0x81;
  ifd[r + 4] = name.length; for (let k = 0; k < name.length; k++) ifd[r + 5 + k] = name.charCodeAt(k);
  put16(ifd, r + 0x0a, local); put16(ifd, r + 0x10, remote);
  ifd.set([10, 0, 0, 1], r + 0x0c); // a remote address: never kept
};
conn(0, 'HMI', 0, 0); conn(1, '', 1030, 502); conn(2, '', 1031, 502);
const connections = readEthernetConnections(ifd);
assert.deepEqual(connections, [
  { number: 1, name: 'HMI', localPort: 0, remotePort: 0 },
  { number: 2, name: '', localPort: 1030, remotePort: 502, protocol: 'Modbus TCP' },
  { number: 3, name: '', localPort: 1031, remotePort: 502, protocol: 'Modbus TCP' },
], 'the set connections only; port 502 is Modbus TCP; no addresses');
const notes = networkNotes(stations, connections).join(' ');
assert.match(notes, /MECHATROLINK \(SVC\): 5 stations \/ 8 axes/);
assert.match(notes, /2 Modbus TCP \(local port 1030\)/);
assert.doesNotMatch(notes, /10\.0\.0\.1/, 'no remote address in the notes');

// "Use this program": the axes become the project's network axes, the station kept (one SGD7W = axes 2 and 3 here).
const axes = networkAxesFrom(stations.map((s) => ({ line: 1, axis: s.axis, kind: 'servo' as const, drive: s.deviceType === 0x20 ? 'SGDV-DEMO' : 'SGD7W-DEMO', station: s.station, stationAxis: s.stationAxis })));
assert.equal(axes.length, 8);
assert.deepEqual(axes[2], { key: 'ax1_3', name: 'Axis 3', circuit: 1, axis: 3, kind: 'servo', drivePartNumber: 'SGD7W-DEMO', station: '23', stationAxis: 1, source: 'import' });

// The demo project: its one axis reaches the project.
{
  const here = dirname(fileURLToPath(import.meta.url));
  const ymw = new Uint8Array(readFileSync(join(here, '__fixtures__', 'demo_mp.YMW7')));
  const { importProgramFiles } = await import('./index');
  const { applyUpgrade } = await import('./ui/applyUpgrade');
  const { useProjectStore } = await import('../../store/useProjectStore');
  const { program } = importProgramFiles([{ name: 'demo_mp.YMW7', text: '', bytes: ymw }]);
  applyUpgrade(program!);
  assert.deepEqual(useProjectStore.getState().networkAxes.map((a) => `${a.key} ${a.drivePartNumber} ${a.motorPartNumber} ${a.source}`), ['ax1_1 SGDEMO-AMP01 SGMDEMO-MOT01 import']);
}

console.log('mpe720 network tests passed');
