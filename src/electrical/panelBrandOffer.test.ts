/// <reference types="node" />
/**
 * "Use Siemens for panel parts too": offered (never applied) when the PLC's maker also sells panel parts and the
 * panel brand was never chosen. Run with:  npx tsx src/electrical/panelBrandOffer.test.ts
 */
import assert from 'node:assert/strict';
import { panelBrandOffer, withPanelBrand } from './panelBrandOffer';
import { normalizePreference, partsFor } from './catalogs';

// A Siemens PLC with no panel brand chosen: offered.
const s = panelBrandOffer('siemens-s7', '', undefined);
assert.equal(s?.vendor, 'siemens');
assert.equal(s?.name, 'Siemens');
assert.equal(s?.from, 'plc');
// Not before a PLC of that maker exists, only from what the description names; never for the default brand.
assert.equal(panelBrandOffer('click', 'Conveyor with a Siemens S7-1200 PLC.', undefined)?.vendor, 'siemens', 'named in the description');
assert.equal(panelBrandOffer('click', 'Conveyor with a Siemens S7-1200 PLC.', undefined)?.from, 'description');
assert.equal(panelBrandOffer('click', 'Conveyor, CLICK PLC.', undefined), null, 'the default brand: nothing to offer');
// A brand already chosen for the panel parts is kept (also AutomationDirect chosen on purpose).
assert.equal(panelBrandOffer('siemens-s7', '', { panel: ['automationdirect'] }), null);
assert.equal(panelBrandOffer('siemens-s7', '', { panel: ['eaton'] }), null);
// A "no thanks" for this maker is remembered.
assert.equal(panelBrandOffer('siemens-s7', '', undefined, ['siemens']), null);
// Accepting changes the panel group only, and the parts then come from the maker's catalog.
const next = withPanelBrand({ plc: ['siemens'], field: ['ifm'] }, 'siemens');
assert.deepEqual(next, { plc: ['siemens'], field: ['ifm'], panel: ['siemens'] });
const pb = partsFor('pushbutton', normalizePreference(next)).parts[0];
assert.equal(pb?.vendor, 'siemens', `pushbuttons from Siemens (${pb?.partNumber})`);
const ct = partsFor('contactor', normalizePreference(next)).parts[0];
assert.equal(ct?.vendor, 'siemens', `contactors from Siemens (${ct?.partNumber})`);
// What the maker doesn't sell stays with the default brand, and the offer says so.
assert.ok(s!.stillDefault.length > 0 && s!.stillDefault.every((c) => partsFor(c, normalizePreference(next)).fallback), `still default: ${s!.stillDefault.join(', ')}`);
console.log(`panel brand offer tests passed (Siemens; still default: ${s!.stillDefault.join(', ')})`);
