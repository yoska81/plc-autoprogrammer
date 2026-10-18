import { IS_PREVIEW } from '../preview/mode';
import { saveViaAccount } from '../preview/claudeAccount';
import { notify } from '../store/useNoticeStore';
import { desktopBridge } from '../desktop/bridge';

// Kept apart from ./files (drawings, STEP, PDF builders) so saving a project file doesn't load them.
/** Save a file: download in the browser, Save dialog in the Windows app, the account's save in the preview. */
export function saveBlobResult(name: string, blob: Blob): Promise<{ ok: boolean; path?: string }> {
  // The preview can't download directly: the viewer's Claude app offers the file.
  if (IS_PREVIEW) {
    return saveViaAccount(name, blob).then((ok) => { if (!ok) notify('Saving files is not available in this view. Run the app on your PC to download.'); return { ok }; })
      .catch((e: unknown) => { notify(e instanceof Error ? e.message : String(e)); return { ok: false }; });
  }
  // Windows app: native Save dialog.
  const save = desktopBridge()?.saveFile;
  if (save) {
    return blob.arrayBuffer().then((buf) => save(name, new Uint8Array(buf)))
      .then((r) => { if (r.ok) notify(`Saved: ${r.path ?? name}`); else if (!r.cancelled) notify(`The file could not be saved: ${r.error ?? 'unknown error'}`); return { ok: r.ok, path: r.path }; })
      .catch((e: unknown) => { notify(e instanceof Error ? e.message : String(e)); return { ok: false }; });
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return Promise.resolve({ ok: true });
}

export function saveBlob(name: string, blob: Blob): void {
  void saveBlobResult(name, blob);
}
