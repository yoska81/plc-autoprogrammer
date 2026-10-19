/// <reference types="node" />
/**
 * A project too big for the browser's storage is said (with how to keep it), not lost quietly; the write still
 * fails as before, and writes that fit are untouched.
 * Run with:  npx tsx src/lib/storageFull.test.ts
 */
import assert from 'node:assert/strict';
import { installStorageFullNotice, STORAGE_FULL } from './storageFull';
import { useNoticeStore } from '../store/useNoticeStore';

class FakeStorage {
  data = new Map<string, string>();
  get length() { return this.data.size; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) {
    if (v.length > 100) throw new DOMException('exceeded the quota', 'QuotaExceededError');
    this.data.set(k, v);
  }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
}

const s = new FakeStorage() as unknown as Storage;
installStorageFullNotice(s);
installStorageFullNotice(s); // once only

s.setItem('small', 'fits');
assert.equal(s.getItem('small'), 'fits');
assert.throws(() => s.setItem('big', 'x'.repeat(200)), /quota/);
assert.throws(() => s.setItem('big', 'x'.repeat(200)), /quota/);
const message = () => useNoticeStore.getState().message;
assert.notEqual(message(), STORAGE_FULL, 'said a moment after the write');
await new Promise((r) => setTimeout(r, 1100));
assert.equal(message(), STORAGE_FULL);
assert.match(STORAGE_FULL, /Ctrl\+S/);
console.log('storageFull.test: all passed');
