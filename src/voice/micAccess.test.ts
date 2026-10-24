/// <reference types="node" />
/**
 * Microphone access: where voice input can work, what a refusal tells the user, and the desktop
 * app's permission decisions (electron/micPermission.cjs).
 * Run with:  npx tsx src/voice/micAccess.test.ts
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { micErrorText, micPermissionText, micPlace, micUsable, PREVIEW_NO_MIC } from './micAccess';

const denied = Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });

// Where we are.
assert.equal(micPlace({ preview: true, desktop: false }), 'preview');
assert.equal(micPlace({ preview: false, desktop: true }), 'desktop');
assert.equal(micPlace({ preview: false, desktop: false }), 'browser');
assert.equal(micUsable('preview'), false, 'the preview frame has no microphone');
assert.ok(micUsable('desktop') && micUsable('browser'));

// Preview: never the address-bar advice (there is no prompt to answer there).
assert.equal(micErrorText(denied, 'preview'), PREVIEW_NO_MIC);
assert.match(PREVIEW_NO_MIC, /Windows app/);
assert.doesNotMatch(PREVIEW_NO_MIC, /address bar/);

// Browser: the address-bar hint only after a real refusal.
assert.match(micErrorText(denied, 'browser'), /address bar/);
assert.match(micErrorText(new Error('not-allowed'), 'browser'), /address bar/, 'speech recognition refusal');
assert.doesNotMatch(micErrorText(Object.assign(new Error('x'), { name: 'NotFoundError' }), 'browser'), /address bar/);
assert.match(micErrorText(Object.assign(new Error('x'), { name: 'NotFoundError' }), 'browser'), /No microphone was found/);
assert.equal(micErrorText(new Error('The browser could not reach its speech service.'), 'browser'), 'The browser could not reach its speech service.', 'other messages pass through');

// Desktop: press again and choose Allow; Windows privacy if no question appears; never the address bar.
const d = micErrorText(denied, 'desktop');
assert.match(d, /Allow once/);
assert.match(d, /Windows Settings/);
assert.doesNotMatch(d, /address bar/);
assert.match(micErrorText(Object.assign(new Error('x'), { name: 'NotReadableError' }), 'desktop'), /another program/);

assert.match(micPermissionText('always'), /allowed always/);
assert.match(micPermissionText('session'), /until the app is closed/);
assert.match(micPermissionText('ask'), /asks/);

// Desktop permission decisions (main process).
const mic = createRequire(import.meta.url)('../../electron/micPermission.cjs') as {
  BUTTONS: string[];
  isMicRequest: (p: string, d?: { mediaTypes?: string[] }) => boolean;
  decide: (s: { always: boolean; session: boolean }) => 'allow' | 'ask';
  applyChoice: (s: { always: boolean; session: boolean }, b: number) => { grant: boolean; state: { always: boolean; session: boolean } };
  status: (s: { always: boolean; session: boolean }) => string;
  load: (dir: string) => { always: boolean; session: boolean };
  save: (dir: string, s: { always: boolean; session: boolean }) => void;
};
assert.deepEqual(mic.BUTTONS, ['Allow once', 'Always allow', "Don't allow"]);
assert.ok(mic.isMicRequest('media', { mediaTypes: ['audio'] }), 'microphone only');
assert.ok(!mic.isMicRequest('media', { mediaTypes: ['audio', 'video'] }), 'camera is not part of voice input');
assert.ok(!mic.isMicRequest('media', { mediaTypes: ['video'] }));
assert.ok(!mic.isMicRequest('notifications', {}));

const fresh = { always: false, session: false };
assert.equal(mic.decide(fresh), 'ask', 'first time: ask');
const once = mic.applyChoice(fresh, 0);
assert.deepEqual(once, { grant: true, state: { always: false, session: true } }, 'Allow once: until the app closes');
assert.equal(mic.decide(once.state), 'allow');
const always = mic.applyChoice(fresh, 1);
assert.deepEqual(always, { grant: true, state: { always: true, session: true } }, 'Always allow');
const no = mic.applyChoice(once.state, 2);
assert.deepEqual(no, { grant: false, state: { always: false, session: false } }, "Don't allow: refused, asked again next time");
assert.equal(mic.decide(no.state), 'ask');
assert.equal(mic.status(always.state), 'always');
assert.equal(mic.status(once.state), 'session');
assert.equal(mic.status(fresh), 'ask');

// "Always" survives a restart; "once" does not; a damaged file means "ask".
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'isa-mic-'));
assert.deepEqual(mic.load(dir), fresh, 'no file: ask');
mic.save(dir, always.state);
assert.deepEqual(mic.load(dir), { always: true, session: false }, 'always is remembered');
mic.save(dir, once.state);
assert.deepEqual(mic.load(dir), fresh, 'allow once is not remembered');
fs.writeFileSync(path.join(dir, 'mic-permission.json'), '{oops');
assert.deepEqual(mic.load(dir), fresh, 'damaged file: ask');
fs.rmSync(dir, { recursive: true, force: true });

console.log('micAccess.test: all passed');
