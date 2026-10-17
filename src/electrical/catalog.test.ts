/// <reference types="node" />
/**
 * Catalog data checks: every part is traceable to the manufacturer's / distributor's published data
 * and its key ratings are present and plausible. A new entry without a source, with an invented-looking
 * part number or with a missing / implausible rating fails here.
 * Run with:  npx tsx src/electrical/catalog.test.ts
 */
import assert from 'node:assert/strict';
import { CATALOG } from './catalog';
import { PRICES } from './prices';
import { HMI_MODELS } from '../hmi/hmiCatalog';
import type { CatalogCategory, CatalogPart } from './types';

let passed = 0;
const failures: string[] = [];
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { failures.push(name); console.log(`  FAIL ${name}\n       ${(e as Error).message.split('\n').join('\n       ')}`); }
}

/**
 * Where a part's data may come from: the manufacturer's own site, or the distributor that sells it
 * under its part number. Add a vendor here together with its first parts.
 */
const SOURCE_HOSTS: { host: RegExp; makers: RegExp }[] = [
  // AutomationDirect sells its own brands and these makers under AD part numbers
  { host: /(^|\.)automationdirect\.com$/, makers: /./ },
  { host: /(^|\.)rockwellautomation\.com$/, makers: /allen[- ]?bradley|rockwell/i },
  // siemens.com includes the official download cache (cache.industry.siemens.com) and support portal;
  // docs.tia.siemens.cloud is Siemens' official TIA Portal documentation site
  { host: /(^|\.)(siemens\.com|tia\.siemens\.cloud)$/, makers: /siemens/i },
  { host: /(^|\.)(se\.com|schneider-electric\.com|schneider-electric\.us)$/, makers: /schneider|square ?d|telemecanique/i },
  { host: /(^|\.)ifm\.com$/, makers: /\bifm\b/i },
  { host: /(^|\.)yaskawa\.(com|eu)$/, makers: /yaskawa/i },
  { host: /(^|\.)(nvent\.com|hoffmanonline\.com)$/, makers: /hoffman|nvent/i },
  { host: /(^|\.)rittal\.(com|us)$/, makers: /rittal/i },
  { host: /(^|\.)phoenixcontact\.com$/, makers: /phoenix/i },
  { host: /(^|\.)eaton\.com$/, makers: /eaton/i },
  { host: /(^|\.)(omron\.com|omron\.eu)$/, makers: /omron/i },
  { host: /(^|\.)weintek\.com$/, makers: /weintek/i },
  // Red Lion is part of HMS Networks: redlion.net now redirects to hms-networks.com
  { host: /(^|\.)(redlion\.net|hms-networks\.com)$/, makers: /red ?lion/i },
  { host: /(^|\.)maplesystems\.com$/, makers: /maple/i },
  { host: /(^|\.)(mitsubishielectric\.com|mitsubishielectric\.co\.jp)$/, makers: /mitsubishi/i },
  { host: /(^|\.)(deltaww\.com|delta-americas\.com)$/, makers: /delta/i },
  { host: /(^|\.)(proface\.com|pro-face\.com)$/, makers: /pro-?face/i },
  { host: /(^|\.)unitronicsplc\.com$/, makers: /unitronics/i },
];

/** Key ratings a part of each category must state (the design and calculations use them). */
const REQUIRED: Partial<Record<CatalogCategory, string[]>> = {
  breaker: ['amps', 'poles', 'volts', 'interruptingKA'],
  contactor: ['amps', 'poles', 'coilVoltage'],
  overload: ['minAmps', 'maxAmps', 'tripClass'],
  motorProtector: ['minAmps', 'maxAmps', 'poles', 'volts'],
  fuse: ['amps', 'volts', 'fuseClass'],
  powerSupply: ['outputVolts', 'outputAmps', 'inputVolts'],
  vfd: ['inputVolts', 'inputPhases', 'outputAmps'],
  plc: ['supplyVolts'],
  plcModule: ['family'],
  enclosure: [],
  estop: ['contacts'],
  pushbutton: ['contacts', 'color'],
  selector: ['positions', 'contacts'],
  pilotLight: ['color', 'volts'],
  sensor: ['output', 'volts'],
  solenoidValve: ['coilVoltage'],
  safetyRelay: ['coilVoltage', 'safetyOutputs'],
  stackLight: ['volts'],
};
/** Some parts state a rating under another name. */
const ALIASES: Record<string, string[]> = { volts: ['volts', 'supplyVolts'], coilVoltage: ['coilVoltage', 'coil'] };

/** Plausible ranges for numeric ratings (a typo like 4800 V or 0.0 A fails). */
const RANGES: Record<string, [number, number]> = {
  amps: [0.1, 2000], minAmps: [0.05, 1000], maxAmps: [0.1, 1000], outputAmps: [0.1, 2000], vtAmps: [0.1, 2000],
  interruptingKA: [1, 200], sccrKA: [1, 200], sccrKA480: [1, 200], poles: [1, 4],
  hp200: [0, 500], hp230: [0, 500], hp480: [0, 1000], hp575: [0, 1000], hp1ph120: [0, 50], hp1ph230: [0, 50], hp1ph: [0, 50],
  outputVolts: [5, 600], watts: [0.1, 5000], va: [10, 100000],
  discreteInputs: [0, 512], discreteOutputs: [0, 512], sensingMm: [0.5, 100000], operatorMm: [20, 100], diameterMm: [3, 200],
};

/** Enclosure sizes in inches (other parts use widthIn for e.g. a wire duct width). */
const ENCLOSURE_IN: [number, number] = [2, 100];

/**
 * Parts that cannot be verified yet, each with the reason (shown in the review). The list must stay short:
 * an entry for a part that is verified, or missing from the catalog, fails.
 */
const UNVERIFIED_OK: Record<string, string> = {
  'XCSPA993': 'contacts (2 NC + 1 NO slow break), 1/2in NPT entry and AC-15 rating from the Schneider XCS catalog; terminal numbers still to be checked on the product data sheet (se.com not reachable).',
  '3SE5112-0QV10': 'Siemens data sheet server refused the download (403): terminal numbers and AC-15 / DC-13 ratings still to be checked; contacts (1 NO + 2 NC), M20 entry and actuator from distributor listings.',
};

/** A maker's document (PDF catalog / datasheet or documentation portal) covering many parts. */
const isMakerDocument = (u: URL) => /\.pdf$/i.test(u.pathname) || /\/dl\/files\//.test(u.pathname) || /^docs\.|^literature\./.test(u.host);

const isAdHost = (u: string) => /(^|\.)automationdirect\.com$/.test(new URL(u).host);
const has = (p: CatalogPart, k: string) => (ALIASES[k] ?? [k]).some((a) => p.ratings[a] !== undefined && p.ratings[a] !== '');

console.log('catalog');

test('part numbers are unique and look like real part numbers', () => {
  const seen = new Set<string>();
  const bad: string[] = [];
  for (const p of CATALOG) {
    if (seen.has(p.partNumber)) bad.push(`${p.partNumber}: duplicate`);
    seen.add(p.partNumber);
    if (!/^[A-Za-z0-9][A-Za-z0-9./#+\- ]{1,40}$/.test(p.partNumber) || /\b(TBD|XXX|N\/A|GENERIC|EXAMPLE)\b/i.test(p.partNumber)) bad.push(`${p.partNumber}: not a part number`);
  }
  assert.deepEqual(bad, []);
});

test('every part has a source page from its maker or the distributor that sells it', () => {
  const bad: string[] = [];
  for (const p of CATALOG) {
    let host = '';
    try { const u = new URL(p.url); host = u.host; if (u.protocol !== 'https:') bad.push(`${p.partNumber}: source must be https`); } catch { bad.push(`${p.partNumber}: no source URL`); continue; }
    const src = SOURCE_HOSTS.find((s) => s.host.test(host));
    if (!src) bad.push(`${p.partNumber}: source ${host} is not a known maker / distributor site`);
    else if (!src.makers.test(p.manufacturer)) bad.push(`${p.partNumber}: ${p.manufacturer} part sourced from ${host}`);
    if (!p.manufacturer.trim()) bad.push(`${p.partNumber}: no manufacturer`);
  }
  assert.deepEqual(bad, []);
});

test('the source page is the page of that part', () => {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const bad = CATALOG.filter((p) => {
    const u = new URL(p.url);
    const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() ?? '').toLowerCase();
    if (isAdHost(p.url)) return last !== p.partNumber.toLowerCase() && !u.pathname.toLowerCase().includes(`/pn/${p.partNumber.toLowerCase()}`);
    return !norm(decodeURIComponent(u.pathname + u.search)).includes(norm(p.partNumber)) && !isMakerDocument(u);
  }).map((p) => `${p.partNumber}: ${p.url}`);
  assert.deepEqual(bad, []);
});

test('every part is checked against its datasheet (verified), or listed with a reason', () => {
  assert.deepEqual(CATALOG.filter((p) => !p.verified && !UNVERIFIED_OK[p.partNumber]).map((p) => p.partNumber), []);
  const stale = Object.entries(UNVERIFIED_OK).filter(([pn, why]) => !CATALOG.some((p) => p.partNumber === pn && !p.verified) || why.trim().length < 30).map(([pn]) => pn);
  assert.deepEqual(stale, [], 'allowlist entries must be unverified catalog parts with a reason of 30+ characters');
});

test('key ratings are stated for each category', () => {
  const bad: string[] = [];
  for (const p of CATALOG) {
    for (const k of REQUIRED[p.category] ?? []) if (!has(p, k)) bad.push(`${p.partNumber} (${p.category}): no ${k}`);
    // enclosures state their outside size; subpanels their panel size
    if (p.category === 'enclosure') {
      const sub = String(p.ratings.kind ?? '') === 'subpanel';
      for (const k of sub ? ['panelHeightIn', 'panelWidthIn'] : ['heightIn', 'widthIn']) if (!has(p, k)) bad.push(`${p.partNumber} (${sub ? 'subpanel' : 'enclosure'}): no ${k}`);
    }
    // controllers with on-board I/O state it; modular controllers state their expansion capacity
    if (p.category === 'plc' && !(has(p, 'discreteInputs') && has(p, 'discreteOutputs')) && !has(p, 'maxExpansionModules')) bad.push(`${p.partNumber} (plc): no on-board I/O or expansion capacity`);
  }
  assert.deepEqual(bad, []);
});

test('numeric ratings are plausible', () => {
  const bad: string[] = [];
  for (const p of CATALOG) {
    for (const [k, v] of Object.entries(p.ratings)) {
      const r = RANGES[k];
      if (!r || typeof v !== 'number') continue;
      if (!Number.isFinite(v) || v < r[0] || v > r[1]) bad.push(`${p.partNumber}: ${k} = ${v} (expected ${r[0]}..${r[1]})`);
    }
    if (p.category === 'enclosure') for (const k of ['heightIn', 'widthIn', 'depthIn']) {
      const v = p.ratings[k];
      if (typeof v === 'number' && (v < ENCLOSURE_IN[0] || v > ENCLOSURE_IN[1])) bad.push(`${p.partNumber}: ${k} = ${v}`);
    }
    if (typeof p.ratings.minAmps === 'number' && typeof p.ratings.maxAmps === 'number' && p.ratings.minAmps >= p.ratings.maxAmps) bad.push(`${p.partNumber}: minAmps >= maxAmps`);
    if (p.widthMm !== undefined && !(p.widthMm > 0 && p.widthMm < 2500)) bad.push(`${p.partNumber}: widthMm ${p.widthMm}`);
    if (p.heightMm !== undefined && !(p.heightMm > 0 && p.heightMm < 2500)) bad.push(`${p.partNumber}: heightMm ${p.heightMm}`);
  }
  assert.deepEqual(bad, []);
});

test('ratings in the part number agree with the ratings (breakers, power supplies)', () => {
  const bad: string[] = [];
  for (const p of CATALOG) {
    const gm = /^GMCBU?-(\d)C-(\d+)$/.exec(p.partNumber);
    if (gm && (Number(gm[1]) !== p.ratings.poles || Number(gm[2]) !== p.ratings.amps)) bad.push(`${p.partNumber}: poles ${p.ratings.poles}, amps ${p.ratings.amps}`);
    const ps = /^PS[RLN]-?24-(\d{3})/.exec(p.partNumber);
    if (ps && p.ratings.watts !== undefined && Number(ps[1]) !== p.ratings.watts && Number(ps[1]) / 10 !== p.ratings.outputAmps) bad.push(`${p.partNumber}: watts ${p.ratings.watts}, amps ${p.ratings.outputAmps}`);
  }
  assert.deepEqual(bad, []);
});

test('parts of other vendors give a datasheet footprint for back-panel parts', () => {
  // AutomationDirect parts may still use the category footprint estimate (shown as estimated on the layout);
  // new vendors' back-panel parts must state width x height from the datasheet.
  const bad = CATALOG.filter((p) => !isAdHost(p.url) && p.mount === 'backplate' && !['enclosure', 'dinRail', 'wireDuct', 'terminalAccessory'].includes(p.category) && !(p.widthMm && p.heightMm)).map((p) => p.partNumber);
  assert.deepEqual(bad, []);
});

test('prices belong to catalog parts and come from the same site', () => {
  const byPn = new Map<string, { url: string }>([...CATALOG.map((p) => [p.partNumber, p] as const), ...HMI_MODELS.map((h) => [h.partNumber, { url: h.url }] as const)]);
  const bad: string[] = [];
  for (const [pn, pr] of Object.entries(PRICES)) {
    const p = byPn.get(pn);
    if (!p) { bad.push(`${pn}: price for a part not in the catalog`); continue; }
    if (new URL(pr.sourceUrl).host !== new URL(p.url).host) bad.push(`${pn}: price from ${new URL(pr.sourceUrl).host}, part page on ${new URL(p.url).host}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pr.date)) bad.push(`${pn}: price date ${pr.date}`);
  }
  assert.deepEqual(bad, []);
});

console.log(failures.length ? `\n${failures.length} failed: ${failures.join(', ')}` : `\n${passed} passed, 0 failed`);
process.exit(failures.length ? 1 : 0);
