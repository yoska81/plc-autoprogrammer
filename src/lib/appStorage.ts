import type { PersistStorage, StorageValue } from 'zustand/middleware';
/**
 * Where the app keeps its projects. The browser's localStorage holds about 5–10 MB, and a big imported program
 * (thousands of rungs) does not fit: it was lost on restart. Now every value is also kept in IndexedDB (no such
 * limit; the same in the desktop app), and the app reads and writes a copy in memory, loaded before the stores
 * start, so the stores still save and load at once as they did with localStorage.
 *
 * localStorage stays the list of what exists: each value is written there too when it fits, and a short
 * placeholder when it does not (the value is then only in IndexedDB). So a value written straight into
 * localStorage (an older version of the app, a test) is used, and a value whose IndexedDB copy was not written
 * before the app closed is still in localStorage when it fit. A value only in IndexedDB is never lost to a
 * closing window: the desktop app waits for it (main.cjs), and the browser asks before leaving while it is
 * being written. Clearing localStorage starts the app clean; what only IndexedDB had is kept aside (isa-cleared:…,
 * found by the deep scan), never deleted. Other tabs of the app get each value as it is written.
 *
 * Until loadAppStorage() has run (Node tests, a page that cannot open IndexedDB) everything goes to localStorage,
 * as before.
 */

/** IndexedDB, or what a test gives instead. */
export interface StorageBackend {
  readAll(): Promise<Map<string, string>>;
  put(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** In localStorage: the value is in IndexedDB (too big for localStorage). */
export const IN_IDB = '\u0000in-indexeddb';
/** In localStorage: this localStorage belongs with the IndexedDB copy (gone when localStorage is cleared). */
export const MARKER_KEY = 'isa-storage';
const MARKER = 'indexeddb-1';
/** What only IndexedDB had when localStorage was found cleared, kept aside under this prefix (+ time, key). */
export const CLEARED_PREFIX = 'isa-cleared:';
/** Writes to IndexedDB wait this long for more changes to the same value (the stores save on every change). */
const WRITE_DELAY_MS = 300;
/** Longer values are not tried in localStorage (it holds about 5 million characters in all). */
const LS_MAX_CHARS = 4_000_000;
/** Sets of values kept aside after a clear that stay (the latest ones; an older set is removed). */
const KEEP_CLEARED_SETS = 2;
/** IndexedDB that does not open in this time is not used (the app starts on localStorage). */
const OPEN_TIMEOUT_MS = 5000;

let mem: Map<string, string> | null = null;
let backend: StorageBackend | null = null;
const pending = new Map<string, string | null>();
/** Keys whose value is only in IndexedDB (the placeholder, or nothing, in localStorage). */
const onlyInIdb = new Set<string>();
/** IndexedDB writes started and not finished, with whether losing them loses data. */
const writing = new Map<Promise<void>, boolean>();
let timer: ReturnType<typeof setTimeout> | null = null;
let onFailure: (err: unknown, key: string) => void = () => {};
let channel: BroadcastChannel | null = null;

const ls = (): Storage | null => { try { return globalThis.localStorage ?? null; } catch { return null; } };

/** The app's storage, for the stores (appPersistStorage) and the project list. */
export const appStorage = {
  getItem(key: string): string | null {
    if (mem) return mem.get(key) ?? null;
    const v = ls()?.getItem(key) ?? null;
    return v === IN_IDB ? null : v; // IndexedDB could not be opened: its values are not here
  },
  setItem(key: string, value: string): void {
    if (!mem) {
      // never write over a value that is only in IndexedDB (it comes back when IndexedDB opens again)
      if (ls()?.getItem(key) !== IN_IDB) ls()?.setItem(key, value);
      return;
    }
    mem.set(key, value);
    mirror(key, value);
    queue(key, value);
    channel?.postMessage({ key, value });
  },
  removeItem(key: string): void {
    if (!mem) { if (ls()?.getItem(key) !== IN_IDB) ls()?.removeItem(key); return; }
    mem.delete(key);
    onlyInIdb.delete(key);
    try { ls()?.removeItem(key); } catch { /* storage blocked */ }
    queue(key, null);
    channel?.postMessage({ key, value: null });
  },
  keys(): string[] {
    if (mem) return [...mem.keys()];
    const s = ls();
    try { return s ? Object.keys(s).filter((k) => k !== MARKER_KEY && s.getItem(k) !== IN_IDB) : []; } catch { return []; }
  },
};

/** The localStorage copy: the value when it fits, else the placeholder (after freeing the old value). */
function mirror(key: string, value: string): void {
  const s = ls();
  if (!s) { onlyInIdb.add(key); return; }
  if (value.length <= LS_MAX_CHARS) {
    try { s.setItem(key, value); onlyInIdb.delete(key); return; } catch { /* too big: placeholder below */ }
  }
  onlyInIdb.add(key);
  try { s.removeItem(key); s.setItem(key, IN_IDB); } catch { /* localStorage full: the marker keeps the IndexedDB copy */ }
}

function queue(key: string, value: string | null): void {
  pending.set(key, value);
  if (!timer) timer = setTimeout(() => void flushAppStorage(), WRITE_DELAY_MS);
}

/** Start an IndexedDB write; `unsafe` when the value is in no other place (losing the write loses it). */
function track(p: Promise<void>, unsafe: boolean): Promise<void> {
  writing.set(p, unsafe);
  void p.finally(() => writing.delete(p)).catch(() => {});
  return p;
}

/** The stores' waiting states as JSON, now (appStorage.setItem queues their IndexedDB writes). */
function writeStates(): void {
  const waiting = [...states];
  states.clear();
  for (const [k, v] of waiting) appStorage.setItem(k, JSON.stringify(v));
}

/** Write everything waiting to IndexedDB now, and wait until every write started so far has finished. */
export async function flushAppStorage(): Promise<void> {
  writeStates();
  if (timer) { clearTimeout(timer); timer = null; }
  if (backend && pending.size) {
    const b = backend;
    for (const [k, v] of pending) {
      track((v === null ? b.remove(k) : b.put(k, v)).catch((err) => onFailure(err, k)), v !== null && onlyInIdb.has(k));
    }
    pending.clear();
  }
  await Promise.all(writing.keys());
}

/** True while a value kept only in IndexedDB is not written yet: closing now would lose it. */
export function storageBusy(): boolean {
  if ([...states.keys(), ...pending.keys()].some((k) => onlyInIdb.has(k))) return true;
  return [...writing.values()].some(Boolean);
}

/**
 * Load everything into memory before the stores start: IndexedDB's values, and localStorage's where it has
 * them (written straight there, or not yet in IndexedDB). The first time, localStorage's values are copied to
 * IndexedDB. Rejects (and the app stays on localStorage) when IndexedDB cannot be opened.
 */
export async function loadAppStorage(opts: { backend?: StorageBackend; onFailure?: (err: unknown, key: string) => void; now?: number } = {}): Promise<void> {
  const b = opts.backend ?? (await indexedDbBackend());
  const stored = await b.readAll();
  const s = ls();
  const lsKeys = s ? Object.keys(s).filter((k) => k !== MARKER_KEY) : [];
  const inLs = new Set(lsKeys);
  // localStorage cleared since the last start: what only IndexedDB has is from before. (Not when localStorage
  // cannot be read, and not on the first start, when IndexedDB is still empty.)
  const cleared = !!s && s.getItem(MARKER_KEY) !== MARKER && stored.size > 0;
  const out = new Map<string, string>();
  const copies: [string, string][] = [];
  // localStorage values IndexedDB is known to hold the same (only these may give way to the placeholder)
  const confirmed = new Set<string>();
  for (const k of lsKeys) {
    const v = s!.getItem(k);
    if (v === null) continue;
    if (v === IN_IDB) {
      const i = stored.get(k);
      if (i !== undefined) { out.set(k, i); onlyInIdb.add(k); }
      continue;
    }
    out.set(k, v);
    if (stored.get(k) === v) confirmed.add(k); else copies.push([k, v]);
  }
  const asideAt = opts.now ?? Date.now();
  const aside: [string, string][] = [];
  for (const [k, v] of stored) {
    if (inLs.has(k)) continue;
    // kept aside after a clear (and still found by the deep scan); else a value whose placeholder did not fit
    const key = cleared && !k.startsWith(CLEARED_PREFIX) ? `${CLEARED_PREFIX}${asideAt}:${k}` : k;
    out.set(key, v);
    onlyInIdb.add(key);
    if (key !== k) aside.push([k, key]);
  }
  // copies of localStorage's values: not waited for (they are in localStorage until written)
  for (const [k, v] of copies) track(b.put(k, v).then(() => { confirmed.add(k); }, (err) => onFailure(err, k)), false);
  // what is kept aside is written under its new key before the old one goes
  await Promise.all(aside.map(async ([k, key]) => { await b.put(key, stored.get(k)!); await b.remove(k); }));
  // only the latest sets kept aside stay (each clear adds one, and all are read in at every start)
  const setsAside = [...new Set([...out.keys()].flatMap((k) => (k.startsWith(CLEARED_PREFIX) ? [Number(k.slice(CLEARED_PREFIX.length).split(':')[0])] : [])))].sort((x, y) => y - x);
  const dropped = new Set(setsAside.slice(KEEP_CLEARED_SETS).map((t) => `${CLEARED_PREFIX}${t}:`));
  const old = [...out.keys()].filter((k) => [...dropped].some((pre) => k.startsWith(pre)));
  for (const k of old) { out.delete(k); onlyInIdb.delete(k); }
  await Promise.all(old.map((k) => b.remove(k)));
  if (s && !writeMarker(s, out, confirmed)) {
    // localStorage full: make room by replacing values IndexedDB has (once written) with the placeholder
    await Promise.all(writing.keys());
    writeMarker(s, out, confirmed, true);
  }
  mem = out;
  backend = b;
  onFailure = opts.onFailure ?? onFailure;
  listen();
}

/** The marker in localStorage; with `makeRoom`, values IndexedDB has confirmed holding give way to their placeholder. */
function writeMarker(s: Storage, values: Map<string, string>, confirmed: Set<string>, makeRoom = false): boolean {
  try { s.setItem(MARKER_KEY, MARKER); return true; } catch { if (!makeRoom) return false; }
  const big = [...values].filter(([k, v]) => confirmed.has(k) && s.getItem(k) === v && v.length > IN_IDB.length + MARKER_KEY.length + MARKER.length).sort((a, b) => b[1].length - a[1].length);
  for (const [k] of big) {
    try { s.setItem(k, IN_IDB); onlyInIdb.add(k); s.setItem(MARKER_KEY, MARKER); return true; } catch { /* next */ }
  }
  return false;
}

let listening = false;
function listen(): void {
  if (listening) return;
  listening = true;
  // a page closing writes what is waiting at once; in the browser it asks to stay while a value only IndexedDB
  // will hold is being written (the desktop app waits for the writes before it closes: flushBeforeClose)
  globalThis.addEventListener?.('pagehide', () => void flushAppStorage());
  globalThis.addEventListener?.('visibilitychange', () => { if (globalThis.document?.visibilityState === 'hidden') void flushAppStorage(); });
  globalThis.addEventListener?.('beforeunload', (e: Event) => {
    void flushAppStorage();
    if (!desktop && storageBusy()) { e.preventDefault(); (e as BeforeUnloadEvent).returnValue = ''; }
  });
  // other tabs of the app: their writes come here (they write localStorage and IndexedDB themselves)
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel('isa-app-storage');
    channel.onmessage = (e: MessageEvent<{ key: string; value: string | null }>) => {
      if (!mem) return;
      if (e.data.value === null) mem.delete(e.data.key); else mem.set(e.data.key, e.data.value);
    };
  }
}

let desktop = false;
/**
 * The desktop app: closing its window waits for this (main.cjs), so the page never asks before leaving (a reload
 * there would show the "unsaved changes" dialog for it). Registered once at the start.
 */
export function flushBeforeClose(register: (flush: () => Promise<void>) => void): void {
  desktop = true;
  register(flushAppStorage);
}

/** True when localStorage holds values that only IndexedDB has (shown empty while IndexedDB cannot be opened). */
export function valuesInIdbLeft(): boolean {
  const s = ls();
  try { return !!s && Object.keys(s).some((k) => s.getItem(k) === IN_IDB); } catch { return false; }
}

/** Back to localStorage only (tests). */
export function resetAppStorage(): void {
  mem = null; backend = null; pending.clear(); states.clear(); onlyInIdb.clear(); writing.clear();
  if (timer) { clearTimeout(timer); timer = null; }
  channel?.close(); channel = null;
}

const DB = 'isa-auto-programmer';
const STORE = 'kv';

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
}

async function indexedDbBackend(): Promise<StorageBackend> {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is not available');
  const open = indexedDB.open(DB, 1);
  open.onupgradeneeded = () => { if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE); };
  const db = await Promise.race([
    req(open),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('IndexedDB did not open')), OPEN_TIMEOUT_MS)),
  ]);
  const tx = (mode: IDBTransactionMode) => db.transaction(STORE, mode).objectStore(STORE);
  const done = (t: IDBObjectStore) => new Promise<void>((resolve, reject) => { t.transaction.oncomplete = () => resolve(); t.transaction.onerror = () => reject(t.transaction.error); t.transaction.onabort = () => reject(t.transaction.error); });
  return {
    async readAll() {
      const store = tx('readonly');
      const [keys, values] = await Promise.all([req(store.getAllKeys()), req(store.getAll())]);
      return new Map(keys.map((k, i) => [String(k), String(values[i])]));
    },
    async put(key, value) { const t = tx('readwrite'); t.put(value, key); await done(t); },
    async remove(key) { const t = tx('readwrite'); t.delete(key); await done(t); },
  };
}

/** Stores' states waiting to be turned into JSON (a burst of changes is written once). */
const states = new Map<string, StorageValue<unknown>>();

/**
 * The `storage` of every persisted store: JSON in appStorage. Once loaded, a state is turned into JSON when the
 * changes stop for a moment (a big program is tens of MB of JSON, and the stores save on every change), and
 * at once when the page closes.
 */
export const appPersistStorage = <S,>(): PersistStorage<S> => ({
  getItem: (name) => {
    const waiting = states.get(name);
    if (waiting) return waiting as StorageValue<S>;
    const text = appStorage.getItem(name);
    return text === null ? null : (JSON.parse(text) as StorageValue<S>);
  },
  setItem: (name, value) => {
    if (!mem) { appStorage.setItem(name, JSON.stringify(value)); return; }
    states.set(name, value);
    if (!timer) timer = setTimeout(() => void flushAppStorage(), WRITE_DELAY_MS);
  },
  removeItem: (name) => { states.delete(name); appStorage.removeItem(name); },
});
