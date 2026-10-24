import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildProjectFile, openProjectFile, PROJECT_EXT } from './projectFile';
import { saveBlobResult } from '../deliverables/save';
import { desktopBridge } from '../desktop/bridge';
import { notify } from '../store/useNoticeStore';
import { useProjectsStore } from '../store/useProjectsStore';
import { useFileStore } from './useFileStore';
import { installDirtyTracking } from './dirtyTracking';

/**
 * Windows-style project files: Save (Ctrl+S) writes the open project to its .isap file
 * (asks for a name the first time), Save As (Ctrl+Shift+S) always asks, Open (Ctrl+O)
 * adds a file as a new project. The window shows * while there are unsaved changes and
 * asks before closing.
 */
export function useProjectFile(): { save: () => void; saveAs: () => void; open: () => void; input: ReactNode } {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { installDirtyTracking(); }, []);

  const write = useCallback((asNew: boolean) => {
    const id = useProjectsStore.getState().activeId;
    if (!id) return;
    const info = useFileStore.getState().byProject[id];
    void buildProjectFile().then(async ({ name, blob }) => {
      const bridge = desktopBridge();
      if (!asNew && info?.path && bridge?.writeFile) {
        const r = await bridge.writeFile(info.path, new Uint8Array(await blob.arrayBuffer()));
        if (r.ok) { useFileStore.getState().markSaved(id, { path: info.path }); notify(`Saved: ${info.path}`); return; }
      }
      const r = await saveBlobResult(info?.name && !asNew ? info.name : name, blob);
      if (r.ok) useFileStore.getState().markSaved(id, { name: r.path ? r.path.split(/[\\/]/).pop() : (info?.name ?? name), path: r.path });
    }).catch((e: unknown) => notify(`The project could not be saved: ${e instanceof Error ? e.message : String(e)}`));
  }, []);
  const save = useCallback(() => write(false), [write]);
  const saveAs = useCallback(() => write(true), [write]);

  const openBlob = useCallback((blob: Blob, fileName?: string, filePath?: string, then?: 'program') => {
    void openProjectFile(blob)
      .then(({ id, name }) => {
        useFileStore.getState().markSaved(id, { name: fileName, path: filePath || undefined });
        // handed over from the web page to send: the Program page, where Send to PLC software is
        notify(then === 'program' ? `Opened project “${name}”: press Send to PLC software to send it.` : `Opened project “${name}”.`);
        navigate(then === 'program' ? '/program' : '/spec');
      })
      .catch((e: unknown) => notify(e instanceof Error ? e.message : String(e)));
  }, [navigate]);

  const open = useCallback(() => inputRef.current?.click(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 's') { e.preventDefault(); if (e.shiftKey) saveAs(); else save(); }
      else if (k === 'o' && !e.shiftKey) { e.preventDefault(); open(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save, saveAs, open]);

  // Unsaved changes: the browser / Windows app asks before closing.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!Object.values(useFileStore.getState().byProject).some((f) => f.dirty)) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  useEffect(() => {
    const off = desktopBridge()?.onOpenFile?.((name, bytes, filePath, then) => openBlob(new Blob([bytes as BlobPart]), name, filePath, then));
    return () => { if (typeof off === 'function') off(); };
  }, [openBlob]);

  const input = (
    <input ref={inputRef} type="file" accept={`.${PROJECT_EXT},.zip`} className="hidden" data-testid="open-project-file"
      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) openBlob(f, f.name.toLowerCase().endsWith(`.${PROJECT_EXT}`) ? f.name : undefined); }} />
  );
  return { save, saveAs, open, input };
}
