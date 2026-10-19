/// <reference types="node" />
/**
 * Every persisted store keeps its data through appStorage (IndexedDB + localStorage): a store created with
 * zustand's persist() and its default storage (localStorage only) would lose a big project again, and nothing
 * but the app's storage modules writes localStorage directly.
 * Run with:  npx tsx src/lib/appStoragePersist.test.ts
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('..', import.meta.url).pathname;
/** Small per-viewer settings that stay in localStorage on purpose (pane widths, AI timing, the preview's seed). */
const LOCAL_ONLY = ['lib/appStorage.ts', 'lib/storageFull.ts', 'components/ResizablePane.tsx', 'lib/ai/progress.ts', 'preview/sampleProject.ts'];

const files: string[] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(p);
  }
};
walk(SRC);

const rel = (p: string) => p.slice(SRC.length).replace(/\\/g, '/');
const persisted = files.filter((f) => /\bpersist\(/.test(readFileSync(f, 'utf8')));
assert.ok(persisted.length >= 20, `${persisted.length} persisted stores found`);
const without = persisted.filter((f) => (readFileSync(f, 'utf8').match(/\bpersist\(/g) ?? []).length > (readFileSync(f, 'utf8').match(/storage: appPersistStorage\(\)/g) ?? []).length);
assert.deepEqual(without.map(rel), [], 'every persist() store has storage: appPersistStorage()');

const direct = files.filter((f) => /\blocalStorage\.(setItem|getItem|removeItem)\(|Object\.keys\(localStorage\)/.test(readFileSync(f, 'utf8')) && !LOCAL_ONLY.includes(rel(f)));
assert.deepEqual(direct.map(rel), [], 'project data goes through appStorage, not localStorage directly');

console.log(`appStoragePersist.test: all passed (${persisted.length} persisted stores)`);
