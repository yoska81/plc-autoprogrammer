// npx tsx src/standards/issue.test.ts — one rule for "issued for construction".
import assert from 'node:assert/strict';
import { issuedForConstruction as ifc } from './issue';

const rev = (...d: string[]) => d.map((description) => ({ description }));
assert.equal(ifc({ revisions: rev('Issued for review'), checkedBy: 'JS', approvedBy: 'AB' }), false, 'for review is preliminary');
assert.equal(ifc({ revisions: rev('Issued for construction'), checkedBy: '', approvedBy: 'AB' }), false, 'no checker named');
assert.equal(ifc({ revisions: rev('Issued for construction'), checkedBy: 'JS', approvedBy: '' }), false, 'no approver named');
assert.equal(ifc({ revisions: rev('Issued for construction'), checkedBy: 'JS', approvedBy: 'AB' }), true);
assert.equal(ifc({ revisions: rev('IFC'), checkedBy: 'JS', approvedBy: 'AB' }), true);
assert.equal(ifc({ revisions: rev('Preliminary — not for construction'), checkedBy: 'JS', approvedBy: 'AB' }), false, '"not for construction"');
assert.equal(ifc({ revisions: rev('Issued for construction', 'Revised for review'), checkedBy: 'JS', approvedBy: 'AB' }), false, 'the CURRENT revision decides');
assert.equal(ifc({ revisions: rev('As built'), checkedBy: 'JS', approvedBy: 'AB' }), true);
console.log('issue tests passed');
