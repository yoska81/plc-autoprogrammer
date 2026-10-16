/// <reference types="node" />
/**
 * Every vendor catalog: shape, unique part numbers, a source page per part,
 * and the preference / fallback rules. Run with:
 *   npx tsx src/electrical/catalogs/catalogs.test.ts
 */
import assert from 'node:assert/strict';
import { ALL_PARTS, DEFAULT_PREFERENCE, GROUP_OF, VENDORS, catalogFor, fallbackCategories, normalizePreference, partsFor, supplierOfPart, type VendorPreference } from './index';
import { getPart, partsIn } from '../catalog';
import type { CatalogCategory } from '../types';

const CATEGORIES = Object.keys(GROUP_OF) as CatalogCategory[];
const MOUNTS = new Set(['backplate', 'door', 'field']);

// Shape and sources, per vendor
const seen = new Map<string, string>();
for (const v of VENDORS) {
  assert.ok(v.parts.length > 0, `${v.name}: no parts`);
  assert.ok(v.supplier.trim(), `${v.name}: no supplier`);
  for (const p of v.parts) {
    const id = `${v.name} ${p.partNumber}`;
    assert.equal(p.vendor, v.id, `${id}: vendor tag`);
    assert.ok(p.partNumber.trim() === p.partNumber && p.partNumber.length > 1, `${id}: part number`);
    assert.ok(CATEGORIES.includes(p.category), `${id}: category ${p.category}`);
    assert.ok(p.description.trim(), `${id}: description`);
    assert.ok(p.manufacturer.trim(), `${id}: manufacturer`);
    assert.ok(MOUNTS.has(p.mount), `${id}: mount`);
    assert.match(p.url, /^https?:\/\/[^\s]+\.[a-z]{2,}/i, `${id}: source URL`);
    assert.equal(typeof p.ratings, 'object', `${id}: ratings`);
    for (const [k, val] of Object.entries(p.ratings)) assert.ok(typeof val === 'string' || (typeof val === 'number' && Number.isFinite(val)), `${id}: rating ${k}`);
    if (p.widthMm !== undefined) assert.ok(p.widthMm > 0, `${id}: widthMm`);
    if (p.heightMm !== undefined) assert.ok(p.heightMm > 0, `${id}: heightMm`);
    if (!p.verified) assert.ok(p.verify?.trim() || v.id === 'automationdirect', `${id}: unverified parts say what to check`);
    // Unique across all vendors (getPart looks up by part number alone).
    const key = p.partNumber.toUpperCase();
    assert.ok(!seen.has(key), `${id}: duplicate part number (also in ${seen.get(key)})`);
    seen.set(key, v.name);
  }
}
assert.equal(ALL_PARTS.length, seen.size);
for (const p of ALL_PARTS) assert.equal(getPart(p.partNumber)?.vendor, p.vendor);

// Default preference = AutomationDirect only (the behaviour before multi-vendor support)
const ad = ALL_PARTS.filter((p) => p.vendor === 'automationdirect');
assert.deepEqual(catalogFor().map((p) => p.partNumber).sort(), ad.map((p) => p.partNumber).sort());
assert.deepEqual(partsIn('contactor').map((p) => p.vendor), partsIn('contactor').map(() => 'automationdirect'));
assert.deepEqual(fallbackCategories(DEFAULT_PREFERENCE), []);
assert.equal(supplierOfPart(getPart('C0-11DD1E-D')), 'AutomationDirect');

// Preferences are completed and cleaned
assert.deepEqual(normalizePreference(undefined), DEFAULT_PREFERENCE);
assert.deepEqual(normalizePreference({ drives: ['nobody' as never] }).drives, ['automationdirect']);

// Every other vendor: its own parts when preferred, AutomationDirect where it offers nothing
for (const v of VENDORS.filter((x) => x.id !== 'automationdirect')) {
  const pref: VendorPreference = { plc: [v.id], hmi: [v.id], drives: [v.id], panel: [v.id], field: [v.id], enclosure: [v.id] };
  for (const c of new Set(v.parts.map((p) => p.category))) {
    const r = partsFor(c, pref);
    assert.ok(!r.fallback && r.parts.every((p) => p.vendor === v.id), `${v.name} ${c}: own parts`);
  }
  for (const c of fallbackCategories(pref)) {
    assert.ok(!v.parts.some((p) => p.category === c), `${v.name} ${c}: fallback only where it has nothing`);
    assert.ok(partsFor(c, pref).parts.every((p) => p.vendor === 'automationdirect'));
  }
}

console.log(`catalog tests passed (${VENDORS.map((v) => `${v.name} ${v.parts.length}`).join(', ')})`);
