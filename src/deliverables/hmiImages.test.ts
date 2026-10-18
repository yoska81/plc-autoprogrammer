/// <reference types="node" />
/**
 * HMI screen images: one screen failing to draw is left out and reported, the others are made (the ZIP and
 * the engineering package never fail because of one screen).
 *   npx tsx src/deliverables/hmiImages.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { drawEachScreen, hmiImageName, hmiImagesNote } from './hmiImages';

const screens = [{ name: 'Main' }, { name: 'Manual / Jog' }, { name: 'Alarms' }];
const { images, failed } = await drawEachScreen(screens, async (s) => {
  if (s.name === 'Manual / Jog') throw new Error('HMI screen "Manual / Jog" could not be drawn for its image.');
  return `data:image/png;base64,${s.name}`;
});
assert.deepEqual(images.map((i) => [i.screen, i.name]), [[0, '01_Main.png'], [2, '03_Alarms.png']], 'the other screens keep their own index and file name');
assert.deepEqual(failed, [{ screen: 'Manual / Jog', error: 'HMI screen "Manual / Jog" could not be drawn for its image.' }]);
assert.equal(hmiImageName(1, 'Manual / Jog'), '02_Manual_Jog.png');
const note = hmiImagesNote(failed);
assert.match(note, /^1 HMI screen could not be drawn/);
assert.match(note, /- Manual \/ Jog: HMI screen "Manual \/ Jog" could not be drawn/);
// every screen failing: nothing thrown, every failure reported
const none = await drawEachScreen(screens, async () => { throw new Error('no canvas'); });
assert.equal(none.images.length, 0);
assert.equal(none.failed.length, 3);
assert.match(hmiImagesNote(none.failed), /^3 HMI screens could not be drawn/);

// the ZIP, the package and the Export page use it: a failure becomes a note, never a failed download
const files = readFileSync(new URL('./files.ts', import.meta.url), 'utf8');
assert.match(files, /buildHmiImages\(p, failed\)[\s\S]{0,200}SCREENS_NOT_DRAWN\.txt/, 'the deliverables ZIP writes the note');
assert.match(readFileSync(new URL('../pages/ExportPage.tsx', import.meta.url), 'utf8'), /SCREENS_NOT_DRAWN\.txt/, 'the screen images ZIP writes the note');
console.log('hmi images: 1 passed, 0 failed');
