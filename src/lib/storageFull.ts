import { notify } from '../store/useNoticeStore';

/**
 * A project the app could not keep (IndexedDB failed; or IndexedDB cannot be used and localStorage, about 5–10 MB,
 * is full, which the stores' saving skips quietly) would be gone after a restart. That is said, with what keeps the
 * project instead (the project file, which is written from memory): a moment after the write (the notice that
 * follows an import or an open would hide it), then at most every 2 minutes while it still cannot be kept.
 */
export const STORAGE_FULL =
  'This project could not be saved in the app\'s own storage, so it will not be there after you close the app. It stays open now: save it as a project file to keep it (Project › Save, Ctrl+S), and open that file next time.';

let toldAt = -Infinity;
const AGAIN_MS = 120_000;

const isFull = (e: unknown) => e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22);

/** Say it (a moment from now, then at most every 2 minutes); a backup copy that is not kept is not the project. */
export function tellStorageFull(key = ''): void {
  if (key.startsWith('plc-backup:') || Date.now() - toldAt <= AGAIN_MS) return;
  toldAt = Date.now();
  setTimeout(() => notify(STORAGE_FULL), 1000);
}

/** localStorage only (no IndexedDB): a write that does not fit is said. */
export function installStorageFullNotice(storage: Storage | undefined = globalThis.localStorage): void {
  if (!storage) return;
  const proto = Object.getPrototypeOf(storage) as Storage & { __fullNotice?: boolean };
  if (proto.__fullNotice) return;
  proto.__fullNotice = true;
  const setItem = proto.setItem;
  proto.setItem = function (this: Storage, key: string, value: string) {
    try {
      setItem.call(this, key, value);
    } catch (e) {
      if (isFull(e) && this === storage) tellStorageFull(key);
      throw e;
    }
  };
}
