/// <reference types="node" />
/**
 * Foreign (IEC / Chinese) part data for "Convert existing drawings": every record is sourced from its maker
 * and states plausible ratings for its function. Nothing here may also be a catalog part.
 * Run with:  npx tsx src/electrical/catalogs/foreignParts.test.ts
 */
import assert from 'node:assert/strict';
import { CATALOG } from '../catalog';
import { FOREIGN_PART_DATA } from './foreignParts';

/** The makers' own sites (and their official download hosts). */
const MAKER_HOSTS: [RegExp, RegExp][] = [
  [/chint/i, /(^|\.)(chint\.com|chintglobal\.com|chint\.net|chintelectric\.com)$/],
  [/delixi/i, /(^|\.)(delixi-electric\.com|delixielectric\.com|delixi\.com)$/],
  [/schneider|telemecanique/i, /(^|\.)(se\.com|schneider-electric\.com)$/],
  [/siemens/i, /(^|\.)(siemens\.com|industry\.siemens\.cloud)$/],
  [/\babb\b/i, /(^|\.)abb\.com$/],
  [/fuji/i, /(^|\.)fujielectric(-europe)?\.com$/],
  [/mean ?well/i, /(^|\.)(meanwell\.com|meanwell-web\.com)$/],
  [/idec/i, /(^|\.)idec\.com$/],
  [/omron/i, /(^|\.)(omron\.com|omron\.eu)$/],
  [/inovance/i, /(^|\.)(inovance\.com|inovance\.eu)$/],
  [/xinje/i, /(^|\.)(xinje\.com|xinje\.co)$/],
  [/mitsubishi/i, /(^|\.)(mitsubishielectric\.com|mitsubishielectric\.co\.jp)$/],
  [/autonics/i, /(^|\.)autonics\.com$/],
];

const bad: string[] = [];
const catalogPns = new Set(CATALOG.map((p) => p.partNumber.toUpperCase()));
for (const [pn, p] of Object.entries(FOREIGN_PART_DATA)) {
  const host = new URL(p.url).host;
  const rule = MAKER_HOSTS.find(([m]) => m.test(p.maker));
  if (!rule) bad.push(`${pn}: no source rule for maker ${p.maker}`);
  else if (!rule[1].test(host)) bad.push(`${pn}: source ${host} is not ${p.maker}'s site`);
  if (catalogPns.has(pn.toUpperCase())) bad.push(`${pn}: also a catalog part`);
  if (!p.ul.trim()) bad.push(`${pn}: UL status missing (use the maker's wording or 'CCC/CE only (no UL)')`);
  const d = p.drawn;
  for (const [k, v] of Object.entries(d)) if (typeof v === 'number' && !(Number.isFinite(v) && v > 0)) bad.push(`${pn}: ${k} = ${v}`);
  if (d.coilVoltage !== undefined && !/^\d+([-/]\d+)?V(AC|DC|AC\/DC)$/.test(d.coilVoltage)) bad.push(`${pn}: coilVoltage '${d.coilVoltage}' (write like '220VAC')`);
  if (d.curve !== undefined && !/^[BCDKZ]$/.test(d.curve)) bad.push(`${pn}: curve '${d.curve}'`);
  if (d.minAmps !== undefined && d.maxAmps !== undefined && d.minAmps >= d.maxAmps) bad.push(`${pn}: range ${d.minAmps}-${d.maxAmps} A`);
  if (p.category === 'contactor' && !(d.amps && d.poles)) bad.push(`${pn}: contactor needs amps and poles`);
  if (p.category === 'breaker' && !(d.amps && d.poles && d.curve)) bad.push(`${pn}: breaker needs amps, poles and curve`);
  if ((p.category === 'overload' || p.category === 'motorProtector') && !(d.minAmps && d.maxAmps)) bad.push(`${pn}: needs minAmps and maxAmps`);
  if (p.category === 'powerSupply' && !(d.outputVolts && d.outputAmps)) bad.push(`${pn}: supply needs outputVolts and outputAmps`);
}
assert.deepEqual(bad, []);
console.log(`foreign part tests passed (${Object.keys(FOREIGN_PART_DATA).length} parts)`);
