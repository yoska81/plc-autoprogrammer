/// <reference types="node" />
/**
 * Dictation and read-aloud helpers: where dictated words go, which engine runs, spoken yes/no in
 * several languages, Markdown read aloud, long texts split for speechSynthesis.
 * Run with:  npx tsx src/voice/text.test.ts
 */
import assert from 'node:assert/strict';
import { clock, joinDictation, langCode, pickEngine, speakable, speechChunks, spokenReply } from './text';

// Add vs replace.
assert.equal(joinDictation('', 'hello world', 'append'), 'hello world');
assert.equal(joinDictation('Two doors.', ' The robot holds the part. ', 'append'), 'Two doors. The robot holds the part.');
assert.equal(joinDictation('First line\n', 'second', 'append'), 'First line\nsecond', 'after a new line: no extra space');
assert.equal(joinDictation('Old text', 'new text', 'replace'), 'new text');
assert.equal(joinDictation('Keep me', '', 'append'), 'Keep me', 'nothing said: the text stays');

// Engine choice.
const e = (o: Partial<Parameters<typeof pickEngine>[0]>) => pickEngine({ engine: 'auto', browserSpeech: true, desktop: false, openaiKey: false, preview: false, ...o });
assert.equal(e({}), 'browser', 'a browser with speech recognition uses it');
assert.equal(e({ desktop: true }), 'local', 'desktop app without an OpenAI key: the model on this computer');
assert.equal(e({ desktop: true, openaiKey: true }), 'openai', 'desktop app with an OpenAI key: OpenAI');
assert.equal(e({ browserSpeech: false, openaiKey: true, preview: true }), 'local', 'the preview never calls OpenAI');
assert.equal(e({ engine: 'openai', openaiKey: true }), 'openai', 'chosen engine');
assert.equal(e({ engine: 'openai' }), 'browser', 'chosen engine not available: automatic');
assert.equal(e({ engine: 'browser', desktop: true }), 'local', 'browser recognition never in the desktop app');
assert.equal(e({ engine: 'local' }), 'local');

// Spoken replies.
assert.equal(spokenReply('Yes', 'en-US'), 'yes');
assert.equal(spokenReply('yes please save it', 'en-US'), 'yes');
assert.equal(spokenReply('No, again', 'en-US'), 'no');
assert.equal(spokenReply('skip this one', 'en-GB'), 'skip');
assert.equal(spokenReply('stop', 'en-US'), 'stop');
assert.equal(spokenReply('the conveyor', 'en-US'), null, 'not a reply');
assert.equal(spokenReply('', 'en-US'), null);
assert.equal(spokenReply('כן', 'he-IL'), 'yes', 'Hebrew yes');
assert.equal(spokenReply('לא', 'he-IL'), 'no', 'Hebrew no');
assert.equal(spokenReply('לאט', 'he-IL'), null, 'whole words only (Hebrew)');
assert.equal(spokenReply('Да', 'ru-RU'), 'yes', 'Russian yes');
assert.equal(spokenReply('нет, ещё раз', 'ru-RU'), 'no', 'Russian no');
assert.equal(spokenReply('Sí', 'es-ES'), 'yes', 'Spanish yes');
assert.equal(spokenReply('siguiente', 'es-MX'), 'skip', 'Spanish skip');
assert.equal(spokenReply('yes', 'ru-RU'), 'yes', 'English words work in every language');
assert.equal(langCode('he-IL'), 'he');
assert.equal(langCode('en'), 'en');

// Read aloud: Markdown marks are not spoken.
const md = '# Machine — spec\n\n| Item | Value |\n| --- | --- |\n| Customer | ACME |\n\n- **Q:** How fast?\n  **A:** _20 per minute_';
const said = speakable(md);
assert.ok(!/[#|*]|---/.test(said), `no Markdown marks: ${said}`);
assert.match(said, /Customer, ACME/, 'table rows read as "cell, cell"');
assert.match(said, /20 per minute/);

// Long texts in pieces (Chromium stops long utterances).
const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} is here.`).join(' ');
const parts = speechChunks(long, 120);
assert.ok(parts.length > 5 && parts.every((p) => p.length <= 120), 'pieces under the limit');
assert.equal(parts.join(' ').replace(/\s+/g, ' '), long, 'nothing lost');
const run = speechChunks(`${'word '.repeat(100)}end.`, 80);
assert.ok(run.every((p) => p.length <= 80), 'a very long sentence is split at spaces');
assert.deepEqual(speechChunks(''), []);
assert.deepEqual(speechChunks('   '), []);
assert.equal(clock(65_400), '1:05');

console.log('voice text.test: all passed');
