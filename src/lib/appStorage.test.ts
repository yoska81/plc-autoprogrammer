/// <reference types="node" />
/**
 * The app's storage: values too big for localStorage are kept in IndexedDB and come back after a restart;
 * localStorage's values from before (and written straight into it) are used and copied over; clearing
 * localStorage still starts clean; nothing is dropped when localStorage is full; a failed write is said.
 * Run with:  npx tsx src/lib/appStorage.test.ts
 */
import assert from 'node:assert/strict';
import { appPersistStorage, appStorage, flushAppStorage, IN_IDB, loadAppStorage, MARKER_KEY, resetAppStorage, type StorageBackend } from './appStorage';

/** localStorage that holds at most `limit` characters. */
class SmallStorage {
  data = new Map<string, string>();
  limit: number;
  constructor(limit: number) { this.limit = limit; }
  get length() { return this.data.size; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) {
    const used = [...this.data].reduce((n, [key, val]) => n + (key === k ? 0 : key.length + val.length), 0);
    if (used + k.length + v.length > this.limit) throw new DOMException('exceeded the quota', 'QuotaExceededError');
    this.data.set(k, v);
  }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
}
// Object.keys(localStorage) lists the keys, as in a browser
const asStorage = (s: SmallStorage) => new Proxy(s, { ownKeys: (t) => [...t.data.keys()], getOwnPropertyDescriptor: (t, k) => (typeof k === 'string' && t.data.has(k) ? { enumerable: true, configurable: true, value: t.data.get(k) } : undefined) });

class MemoryBackend implements StorageBackend {
  data = new Map<string, string>();
  failing = false;
  async readAll() { return new Map(this.data); }
  async put(k: string, v: string) { if (this.failing) throw new Error('disk full'); this.data.set(k, v); }
  async remove(k: string) { this.data.delete(k); }
}

const ls = new SmallStorage(1000);
Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => asStorage(ls) });
const idb = new MemoryBackend();
const restart = async (onFailure?: (e: unknown) => void) => { await flushAppStorage(); resetAppStorage(); await loadAppStorage({ backend: idb, onFailure }); };

let passed = 0;
const test = async (name: string, fn: () => Promise<void> | void) => { await fn(); passed++; console.log('  ok ', name); };

await test('before loading, everything is in localStorage as before', () => {
  appStorage.setItem('plc-io-store', '{"io":1}');
  assert.equal(ls.getItem('plc-io-store'), '{"io":1}');
  assert.equal(appStorage.getItem('plc-io-store'), '{"io":1}');
});

await test('first start: localStorage\'s projects are used and copied to IndexedDB', async () => {
  await restart();
  assert.equal(appStorage.getItem('plc-io-store'), '{"io":1}');
  assert.equal(idb.data.get('plc-io-store'), '{"io":1}');
  assert.equal(ls.getItem(MARKER_KEY), 'indexeddb-1');
});

const big = JSON.stringify({ rungs: 'x'.repeat(5000) });
await test('a value too big for localStorage: a placeholder there, the value in IndexedDB, back after a restart', async () => {
  appStorage.setItem('plc-program-store', big);
  assert.equal(appStorage.getItem('plc-program-store'), big, 'read back at once');
  assert.equal(ls.getItem('plc-program-store'), IN_IDB);
  await restart();
  assert.equal(appStorage.getItem('plc-program-store'), big);
});

await test('it grows too big after fitting: the old copy in localStorage is replaced by the placeholder', async () => {
  appStorage.setItem('plc-draft-store', '{"small":1}');
  assert.equal(ls.getItem('plc-draft-store'), '{"small":1}');
  appStorage.setItem('plc-draft-store', big);
  assert.equal(ls.getItem('plc-draft-store'), IN_IDB);
  await restart();
  assert.equal(appStorage.getItem('plc-draft-store'), big);
});

await test('a value written straight into localStorage (a test, an older version) is used', async () => {
  ls.setItem('plc-settings-store', '{"seeded":true}');
  await restart();
  assert.equal(appStorage.getItem('plc-settings-store'), '{"seeded":true}');
  assert.equal(idb.data.get('plc-settings-store'), '{"seeded":true}');
});

await test('the app closed before the IndexedDB write: the localStorage copy is used', async () => {
  appStorage.setItem('plc-io-store', '{"io":2}');
  resetAppStorage(); // closed: the waiting write is lost
  assert.equal(idb.data.get('plc-io-store'), '{"io":1}');
  await loadAppStorage({ backend: idb });
  assert.equal(appStorage.getItem('plc-io-store'), '{"io":2}');
});

await test('localStorage full, not even the placeholder fits: the IndexedDB copy is kept', async () => {
  const used = [...ls.data].reduce((n, [k, v]) => n + k.length + v.length, 0);
  ls.setItem('filler', 'f'.repeat(ls.limit - used - 'filler'.length));
  appStorage.setItem('plc-hmi-store', big);
  assert.equal(ls.getItem('plc-hmi-store'), null);
  await restart();
  assert.equal(appStorage.getItem('plc-hmi-store'), big);
  ls.removeItem('filler');
});

await test('localStorage cleared: the app starts clean (IndexedDB\'s old values are dropped)', async () => {
  ls.clear();
  ls.setItem('plc-settings-store', '{"fresh":true}');
  await restart();
  assert.deepEqual(appStorage.keys(), ['plc-settings-store']);
  assert.equal(appStorage.getItem('plc-program-store'), null);
  assert.equal(idb.data.has('plc-program-store'), false);
});

await test('removed: gone from both', async () => {
  appStorage.setItem('plc-project-data:1', big);
  await flushAppStorage();
  appStorage.removeItem('plc-project-data:1');
  await restart();
  assert.equal(appStorage.getItem('plc-project-data:1'), null);
  assert.equal(idb.data.has('plc-project-data:1'), false);
});

await test('an IndexedDB write that fails is said (the project would not survive a restart)', async () => {
  let told = 0;
  await restart(() => { told++; });
  idb.failing = true;
  appStorage.setItem('plc-program-store', big);
  await flushAppStorage();
  assert.equal(told, 1);
  idb.failing = false;
});

await test('a store\'s state is written once its changes stop (a burst of changes, one JSON)', async () => {
  const st = appPersistStorage<{ n: number }>();
  for (let n = 1; n <= 3; n++) st.setItem('plc-spec-store', { state: { n }, version: 0 });
  assert.equal(ls.getItem('plc-spec-store'), null, 'not yet written');
  assert.deepEqual(st.getItem('plc-spec-store'), { state: { n: 3 }, version: 0 }, 'read back at once');
  await flushAppStorage();
  assert.equal(ls.getItem('plc-spec-store'), '{"state":{"n":3},"version":0}');
  assert.equal(idb.data.get('plc-spec-store'), '{"state":{"n":3},"version":0}');
});

console.log(`appStorage.test: all passed (${passed})`);
