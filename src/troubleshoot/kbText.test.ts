/// <reference types="node" />
/**
 * The troubleshooting knowledge is written in our own short words (the repo is public): only facts (codes,
 * terminals, values) and the citation come from the maker documents. Any text field over 150 characters (URLs not
 * counted) is likely copied prose and fails here.
 * Run with:  npx tsx src/troubleshoot/kbText.test.ts
 */
import assert from 'node:assert/strict';
import { DEVICE_FAULT_DATA } from './deviceFaultData';
import { MACHINE_SYMPTOM_DATA } from './machineSymptomData';

const MAX = 150;
/** Citations and ids are not prose. */
const SKIP = new Set(['source', 'sources', 'url', 'id', 'code', 'machineType']);
const long: string[] = [];
function walk(v: unknown, path: string, key: string) {
  if (typeof v === 'string') {
    if (!SKIP.has(key) && v.replace(/https?:\/\/\S+/g, '').trim().length > MAX) long.push(`${path}: ${v.slice(0, 60)}…`);
  } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`, key));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`, k);
}
for (const d of DEVICE_FAULT_DATA) walk(d, d.id, '');
for (const m of MACHINE_SYMPTOM_DATA) walk(m, m.machineType, '');
assert.deepEqual(long.slice(0, 20), [], `${long.length} text fields over ${MAX} characters`);
console.log('knowledge text tests passed');
