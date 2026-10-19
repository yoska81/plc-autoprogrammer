import { notify } from '../store/useNoticeStore';

/**
 * The app keeps the open project in the browser's storage (about 5–10 MB). A big imported program does not fit,
 * and the stores' saving skips that quietly: the project would be gone after a restart. Any write that does not
 * fit says so, with what keeps the project instead (the project file, which is written from memory): a moment
 * after the write (the notice that follows an import or an open would hide it), then at most every 2 minutes while
 * the project still does not fit.
 */
export const STORAGE_FULL =
  'This project is too big for the app\'s own storage, so it will not be there after you close the app. It stays open now: save it as a project file to keep it (Project › Save, Ctrl+S), and open that file next time.';

let toldAt = -Infinity;
const AGAIN_MS = 120_000;

const isFull = (e: unknown) => e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22);

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
      if (isFull(e) && Date.now() - toldAt > AGAIN_MS) { toldAt = Date.now(); setTimeout(() => notify(STORAGE_FULL), 1000); }
      throw e;
    }
  };
}
